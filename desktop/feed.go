package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultFeedAPIBase = "http://127.0.0.1:8090"

type feedFileRecord struct {
	ID         string `json:"id,omitempty"`
	CID        string `json:"cid"`
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	MIME       string `json:"mime"`
	Visibility string `json:"visibility"`
}

type feedPublisherRecord struct {
	DeviceID string `json:"deviceId,omitempty"`
	PeerID   string `json:"peerId,omitempty"`
}

type feedMetadataRecord struct {
	Version     int                 `json:"version"`
	Type        string              `json:"type"`
	File        feedFileRecord      `json:"file"`
	PublishedAt time.Time           `json:"publishedAt"`
	Publisher   feedPublisherRecord `json:"publisher,omitempty"`
}

type feedSubmission struct {
	MetadataCID string             `json:"metadataCid"`
	Entry       feedMetadataRecord `json:"entry"`
}

type feedSubmissionResponse struct {
	Accepted          bool   `json:"accepted"`
	ManifestPublished bool   `json:"manifestPublished"`
	ManifestCID       string `json:"manifestCid,omitempty"`
	IPNSName          string `json:"ipnsName,omitempty"`
	Warning           string `json:"warning,omitempty"`
}

func feedAPIBase() string {
	if value := strings.TrimSpace(os.Getenv("FEED_API_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	return defaultFeedAPIBase
}

func (e *DesktopEngine) publishFeedEntry(ctx context.Context, file VaultFile) (string, feedSubmissionResponse, error) {
	if file.Visibility != "public" {
		return "", feedSubmissionResponse{}, errors.New("only public files can be shared to the feed")
	}

	status, err := e.vaultStatus()
	if err != nil {
		return "", feedSubmissionResponse{}, fmt.Errorf("read publisher identity: %w", err)
	}

	entry := feedMetadataRecord{
		Version: 1,
		Type:    "13xfile.feed.entry",
		File: feedFileRecord{
			ID:         file.ID,
			CID:        file.CID,
			Name:       file.Name,
			Size:       file.Size,
			MIME:       file.MIME,
			Visibility: "public",
		},
		PublishedAt: time.Now().UTC(),
		Publisher: feedPublisherRecord{
			DeviceID: status.DeviceID,
			PeerID:   status.PeerID,
		},
	}

	raw, err := json.Marshal(entry)
	if err != nil {
		return "", feedSubmissionResponse{}, err
	}

	tmpDir := filepath.Join(e.home, "tmp")
	if err := os.MkdirAll(tmpDir, 0o700); err != nil {
		return "", feedSubmissionResponse{}, err
	}
	tmpPath := filepath.Join(tmpDir, file.ID+".feed.json")
	if err := os.WriteFile(tmpPath, append(raw, '\n'), 0o600); err != nil {
		return "", feedSubmissionResponse{}, err
	}
	defer os.Remove(tmpPath)

	metadataCID, err := e.addToIPFS(ctx, tmpPath)
	if err != nil {
		return "", feedSubmissionResponse{}, fmt.Errorf("store feed metadata on IPFS: %w", err)
	}

	body, err := json.Marshal(feedSubmission{MetadataCID: metadataCID, Entry: entry})
	if err != nil {
		return metadataCID, feedSubmissionResponse{}, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		feedAPIBase()+"/v1/feed/submissions",
		bytes.NewReader(body),
	)
	if err != nil {
		return metadataCID, feedSubmissionResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "13xfile-desktop/0.1")

	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return metadataCID, feedSubmissionResponse{}, fmt.Errorf("submit feed metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return metadataCID, feedSubmissionResponse{}, fmt.Errorf(
			"feed API: HTTP %s: %s",
			resp.Status,
			strings.TrimSpace(string(message)),
		)
	}

	var result feedSubmissionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return metadataCID, feedSubmissionResponse{}, fmt.Errorf("decode feed API response: %w", err)
	}
	if !result.Accepted {
		return metadataCID, result, errors.New("feed API did not accept metadata")
	}
	return metadataCID, result, nil
}
