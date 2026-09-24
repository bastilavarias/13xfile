package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	privateCipherName = "aes-256-gcm-chunked-v1"
	privateKeyWrap    = "aes-256-gcm-keywrap-v1"
	privateChunkSize  = 1 << 20
)

var privateMagic = [8]byte{'1', '3', 'X', 'E', 'N', 'C', '0', '1'}

func derivePrivateKey(vaultCode, fileID string) []byte {
	sum := sha256.Sum256([]byte("13xfile-private/v1\x00" + vaultCode + "\x00" + fileID))
	return sum[:]
}

func generateFileKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}

func deriveVaultWrapKey(vaultCode string) []byte {
	sum := sha256.Sum256([]byte("13xfile-vault-wrap/v1\x00" + vaultCode))
	return sum[:]
}

func wrapFileKey(vaultCode, fileID string, fileKey []byte) (string, error) {
	if len(fileKey) != 32 {
		return "", errors.New("file key must be 32 bytes")
	}
	block, err := aes.NewCipher(deriveVaultWrapKey(vaultCode))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	aad := []byte("13xfile-keywrap/v1\x00" + fileID)
	sealed := gcm.Seal(nil, nonce, fileKey, aad)
	payload := append(append([]byte{}, nonce...), sealed...)
	return privateKeyWrap + ":" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func unwrapFileKey(vaultCode, fileID, wrapped string) ([]byte, error) {
	prefix := privateKeyWrap + ":"
	if !strings.HasPrefix(wrapped, prefix) {
		return nil, errors.New("unsupported private key wrap")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(wrapped, prefix))
	if err != nil {
		return nil, errors.New("invalid private key wrap")
	}
	block, err := aes.NewCipher(deriveVaultWrapKey(vaultCode))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(payload) < gcm.NonceSize()+gcm.Overhead() {
		return nil, errors.New("private key wrap is incomplete")
	}
	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	aad := []byte("13xfile-keywrap/v1\x00" + fileID)
	key, err := gcm.Open(nil, nonce, ciphertext, aad)
	if err != nil || len(key) != 32 {
		return nil, errors.New("private key wrap authentication failed")
	}
	return key, nil
}

func encodeKey(key []byte) string {
	return base64.RawURLEncoding.EncodeToString(key)
}

func decodeKey(value string) ([]byte, error) {
	key, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(key) != 32 {
		return nil, errors.New("invalid private share key")
	}
	return key, nil
}

func encryptFile(ctx context.Context, source, destination string, key []byte, wait func(context.Context) error, progress func(int64, int64)) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()

	info, err := in.Stat()
	if err != nil {
		return err
	}

	out, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()

	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	var noncePrefix [8]byte
	if _, err := rand.Read(noncePrefix[:]); err != nil {
		return err
	}
	if _, err := out.Write(privateMagic[:]); err != nil {
		return err
	}
	if err := binary.Write(out, binary.BigEndian, uint32(privateChunkSize)); err != nil {
		return err
	}
	if _, err := out.Write(noncePrefix[:]); err != nil {
		return err
	}

	buf := make([]byte, privateChunkSize)
	var counter uint32
	var done int64

	for {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		if wait != nil {
			if err := wait(ctx); err != nil {
				return err
			}
		}

		n, readErr := io.ReadFull(in, buf)
		if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) && !errors.Is(readErr, io.EOF) {
			return readErr
		}
		if n == 0 {
			break
		}

		nonce := make([]byte, gcm.NonceSize())
		copy(nonce[:8], noncePrefix[:])
		binary.BigEndian.PutUint32(nonce[8:], counter)
		counter++

		sealed := gcm.Seal(nil, nonce, buf[:n], nil)
		if err := binary.Write(out, binary.BigEndian, uint32(len(sealed))); err != nil {
			return err
		}
		if _, err := out.Write(sealed); err != nil {
			return err
		}

		done += int64(n)
		if progress != nil {
			progress(done, info.Size())
		}
		if errors.Is(readErr, io.ErrUnexpectedEOF) || errors.Is(readErr, io.EOF) {
			break
		}
	}

	return out.Sync()
}

func decryptStream(source io.Reader, destination io.Writer, key []byte) error {
	var magic [8]byte
	if _, err := io.ReadFull(source, magic[:]); err != nil {
		return err
	}
	if magic != privateMagic {
		return errors.New("not a 13xfile encrypted stream")
	}

	var chunkSize uint32
	if err := binary.Read(source, binary.BigEndian, &chunkSize); err != nil {
		return err
	}
	if chunkSize == 0 || chunkSize > 16<<20 {
		return fmt.Errorf("invalid encrypted chunk size %d", chunkSize)
	}

	var noncePrefix [8]byte
	if _, err := io.ReadFull(source, noncePrefix[:]); err != nil {
		return err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	var counter uint32
	for {
		var length uint32
		err := binary.Read(source, binary.BigEndian, &length)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if length == 0 || length > chunkSize+uint32(gcm.Overhead()) {
			return errors.New("invalid encrypted chunk")
		}

		sealed := make([]byte, length)
		if _, err := io.ReadFull(source, sealed); err != nil {
			return err
		}

		nonce := make([]byte, gcm.NonceSize())
		copy(nonce[:8], noncePrefix[:])
		binary.BigEndian.PutUint32(nonce[8:], counter)
		counter++

		plain, err := gcm.Open(nil, nonce, sealed, nil)
		if err != nil {
			return errors.New("private file authentication failed")
		}
		if _, err := destination.Write(plain); err != nil {
			return err
		}
	}
}
