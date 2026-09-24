package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestPrivateEncryptionRoundTrip(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "source.txt")
	encrypted := filepath.Join(dir, "source.13xenc")

	want := bytes.Repeat([]byte("13xfile-private-roundtrip\n"), 90000)
	if err := os.WriteFile(source, want, 0o600); err != nil {
		t.Fatal(err)
	}

	key := derivePrivateKey("TEST-VAULT-CODE-123456", "file-abc")
	if err := encryptFile(context.Background(), source, encrypted, key, nil, nil); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(encrypted)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(raw, []byte("13xfile-private-roundtrip")) {
		t.Fatal("encrypted payload contains plaintext marker")
	}

	var got bytes.Buffer
	file, err := os.Open(encrypted)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := decryptStream(file, &got, key); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.Bytes(), want) {
		t.Fatal("decrypted bytes do not match original")
	}
}

func TestShareLinkRoundTrip(t *testing.T) {
	public := ShareDescriptor{
		Version:    1,
		ID:         "public-id",
		Name:       "photo.jpg",
		CID:        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ge7qj3uqz2cvz7k4z2x7c4nq",
		Size:       1234,
		MIME:       "image/jpeg",
		Visibility: "public",
	}
	publicRaw, err := jsonMarshalShare(public)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := parseShareLink(publicRaw)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.CID != public.CID || parsed.Visibility != "public" {
		t.Fatalf("public share mismatch: %#v", parsed)
	}

	private := public
	private.ID = "private-id"
	private.Visibility = "private"
	private.Cipher = privateCipherName
	private.Key = encodeKey(derivePrivateKey("vault-code-123456", private.ID))
	privateRaw, err := jsonMarshalShare(private)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err = parseShareLink(privateRaw)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Visibility != "private" || parsed.Cipher != privateCipherName || parsed.Key == "" {
		t.Fatalf("private share mismatch: %#v", parsed)
	}
}

func jsonMarshalShare(desc ShareDescriptor) (string, error) {
	data, err := json.Marshal(desc)
	if err != nil {
		return "", err
	}
	return "13xfile://share/" + base64.RawURLEncoding.EncodeToString(data), nil
}
