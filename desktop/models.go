package main

import "time"

type ReplicaReceipt struct {
	DeviceID string    `json:"deviceId"`
	PeerID   string    `json:"peerId,omitempty"`
	CID      string    `json:"cid"`
	At       time.Time `json:"at"`
}

type VaultFile struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	CID          string           `json:"cid"`
	Size         int64            `json:"size"`
	MIME         string           `json:"mime"`
	AddedAt      time.Time        `json:"addedAt"`
	AddedBy      string           `json:"addedBy"`
	Visibility   string           `json:"visibility,omitempty"`
	Cipher       string           `json:"cipher,omitempty"`
	KeyWrap      string           `json:"keyWrap,omitempty"`
	Local        bool             `json:"local"`
	ReplicaCount int              `json:"replicaCount,omitempty"`
	Replicas     []ReplicaReceipt `json:"replicas,omitempty"`
}

type VaultStatus struct {
	PeerID    string      `json:"peerId"`
	DeviceID  string      `json:"deviceId"`
	VaultID   string      `json:"vaultId"`
	JoinCode  string      `json:"joinCode"`
	Files     []VaultFile `json:"files"`
	LastSync  time.Time   `json:"lastSync,omitempty"`
	LastError string      `json:"lastError,omitempty"`
}

type Transfer struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	SourcePath string    `json:"-"`
	Size       int64     `json:"size"`
	Visibility string    `json:"visibility"`
	Status     string    `json:"status"`
	Stage      string    `json:"stage"`
	Progress   int       `json:"progress"`
	CID        string    `json:"cid,omitempty"`
	Error      string    `json:"error,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	Staged     bool      `json:"-"`
}

type AppState struct {
	NodeOnline     bool         `json:"nodeOnline"`
	ConnectedPeers int          `json:"connectedPeers"`
	PeerID         string       `json:"peerId,omitempty"`
	NeedsVault     bool         `json:"needsVault"`
	Vault          *VaultStatus `json:"vault,omitempty"`
	Transfers      []Transfer   `json:"transfers"`
	Paused         bool         `json:"paused"`
	Settings       Settings     `json:"settings"`
	Fatal          string       `json:"fatal,omitempty"`
}
