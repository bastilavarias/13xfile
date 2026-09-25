package main

import "time"

type feedFile struct {
	ID         string `json:"id,omitempty"`
	CID        string `json:"cid"`
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	MIME       string `json:"mime"`
	Visibility string `json:"visibility"`
}

type publisher struct {
	DeviceID string `json:"deviceId,omitempty"`
	PeerID   string `json:"peerId,omitempty"`
}

type feedEntry struct {
	Version     int       `json:"version"`
	Type        string    `json:"type"`
	File        feedFile  `json:"file"`
	PublishedAt time.Time `json:"publishedAt"`
	Publisher   publisher `json:"publisher,omitempty"`
	Signature   string    `json:"signature,omitempty"`
}

type submission struct {
	MetadataCID string    `json:"metadataCid"`
	Entry       feedEntry `json:"entry"`
}

type feedItem struct {
	MetadataCID string    `json:"metadataCid"`
	Entry       feedEntry `json:"entry"`
}

type manifest struct {
	Version   int      `json:"version"`
	Type      string   `json:"type"`
	CreatedAt string   `json:"createdAt"`
	Previous  string   `json:"previous,omitempty"`
	Entries   []string `json:"entries"`
}
