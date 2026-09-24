package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
)

type ShareDescriptor struct {
	Version    int    `json:"v"`
	ID         string `json:"id"`
	Name       string `json:"name"`
	CID        string `json:"cid"`
	Size       int64  `json:"size"`
	MIME       string `json:"mime"`
	Visibility string `json:"visibility"`
	Cipher     string `json:"cipher,omitempty"`
	Key        string `json:"key,omitempty"`
}

const (
	publicWebShareBase = "https://htmlpreview.github.io/?https://raw.githubusercontent.com/bastilavarias/13xfile/prototype/share/index.html"
	appSharePrefix     = "x13file://share/"
	legacySharePrefix  = "13xfile://share/"
)

func (e *DesktopEngine) shareLinks(file VaultFile) (string, string, error) {
	desc := ShareDescriptor{
		Version:    1,
		ID:         file.ID,
		Name:       file.Name,
		CID:        file.CID,
		Size:       file.Size,
		MIME:       file.MIME,
		Visibility: file.Visibility,
		Cipher:     file.Cipher,
	}
	if desc.Visibility == "" {
		desc.Visibility = "public"
	}
	if desc.Visibility == "private" {
		key, err := e.privateFileKey(file)
		if err != nil {
			return "", "", err
		}
		desc.Key = encodeKey(key)
	}
	data, err := json.Marshal(desc)
	if err != nil {
		return "", "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(data)
	appLink := appSharePrefix + payload
	webLink := ""
	if desc.Visibility == "public" {
		webLink = publicWebShareBase + "#" + payload
	}
	return appLink, webLink, nil
}

func parseShareLink(value string) (ShareDescriptor, error) {
	value = strings.TrimSpace(value)
	prefix := ""
	switch {
	case strings.HasPrefix(value, appSharePrefix):
		prefix = appSharePrefix
	case strings.HasPrefix(value, legacySharePrefix):
		prefix = legacySharePrefix
	default:
		return ShareDescriptor{}, errors.New("invalid 13xfile share link")
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, prefix))
	if err != nil {
		return ShareDescriptor{}, errors.New("invalid 13xfile share payload")
	}
	var desc ShareDescriptor
	if err := json.Unmarshal(raw, &desc); err != nil {
		return ShareDescriptor{}, errors.New("invalid 13xfile share payload")
	}
	if desc.Version != 1 || desc.CID == "" || desc.Name == "" {
		return ShareDescriptor{}, errors.New("unsupported 13xfile share link")
	}
	if desc.Visibility == "" {
		desc.Visibility = "public"
	}
	if desc.Visibility == "private" {
		if desc.Cipher != privateCipherName {
			return ShareDescriptor{}, errors.New("unsupported private file cipher")
		}
		if _, err := decodeKey(desc.Key); err != nil {
			return ShareDescriptor{}, err
		}
	}
	return desc, nil
}

func (e *DesktopEngine) privateFileKey(file VaultFile) ([]byte, error) {
	if file.Visibility != "private" {
		return nil, errors.New("file is not private")
	}
	if file.Cipher != privateCipherName {
		return nil, errors.New("unsupported private file cipher")
	}
	code, err := e.vaultCode()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(file.KeyWrap) != "" {
		return unwrapFileKey(code, file.ID, file.KeyWrap)
	}
	// Backward compatibility with the first desktop prototype.
	return derivePrivateKey(code, file.ID), nil
}

func (e *DesktopEngine) streamVaultFile(ctx context.Context, file VaultFile, w io.Writer) error {
	var key []byte
	if file.Visibility == "private" {
		var err error
		key, err = e.privateFileKey(file)
		if err != nil {
			return err
		}
	}
	return e.streamCID(ctx, file.CID, file.Visibility, key, w)
}

func (e *DesktopEngine) streamSharedFile(ctx context.Context, share ShareDescriptor, w io.Writer) error {
	var key []byte
	var err error
	if share.Visibility == "private" {
		key, err = decodeKey(share.Key)
		if err != nil {
			return err
		}
	}
	return e.streamCID(ctx, share.CID, share.Visibility, key, w)
}

func (e *DesktopEngine) streamCID(ctx context.Context, cid, visibility string, key []byte, w io.Writer) error {
	cmd, err := e.kuboCommand(ctx, "cat", "/ipfs/"+strings.TrimSpace(cid))
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return err
	}

	var streamErr error
	if visibility == "private" {
		streamErr = decryptStream(stdout, w, key)
	} else {
		_, streamErr = io.Copy(w, stdout)
	}
	waitErr := cmd.Wait()
	if streamErr != nil {
		return streamErr
	}
	if waitErr != nil {
		return fmt.Errorf("ipfs cat: %s", strings.TrimSpace(stderr.String()))
	}
	return nil
}

func setDownloadHeaders(w http.ResponseWriter, name, mimeType string, size int64) {
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", sanitizeDownloadName(name)))
	if size > 0 {
		w.Header().Set("X-13xfile-Original-Size", fmt.Sprintf("%d", size))
	}
}

func sanitizeDownloadName(name string) string {
	name = strings.ReplaceAll(name, "\r", "")
	name = strings.ReplaceAll(name, "\n", "")
	name = strings.ReplaceAll(name, "\"", "'")
	if name == "" {
		return "13xfile-download"
	}
	return name
}

var _ *exec.Cmd
