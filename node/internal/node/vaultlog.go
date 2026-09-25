package node

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	deviceIdentityVersion     = 1
	vaultOpVersion            = 1
	deviceHeartbeatVersion    = 1
	replicaHeartbeatInterval  = 2 * time.Minute
	replicaHeartbeatFreshness = 10 * time.Minute

	vaultOpFileAdd    = "file.add"
	vaultOpFileRemove = "file.remove"
	vaultOpReplicaAck = "replica.ack"
)

type deviceIdentity struct {
	Version    int    `json:"version"`
	DeviceID   string `json:"deviceId"`
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
}

type VaultOp struct {
	Version   int       `json:"version"`
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	DeviceID  string    `json:"deviceId"`
	PeerID    string    `json:"peerId,omitempty"`
	PublicKey string    `json:"publicKey"`
	CreatedAt time.Time `json:"createdAt"`

	File   *DemoFile `json:"file,omitempty"`
	FileID string    `json:"fileId,omitempty"`
	CID    string    `json:"cid,omitempty"`

	Signature string `json:"signature"`
}

type ReplicaReceipt struct {
	DeviceID string    `json:"deviceId"`
	PeerID   string    `json:"peerId,omitempty"`
	CID      string    `json:"cid"`
	StoredAt time.Time `json:"storedAt,omitempty"`
	At       time.Time `json:"at"`
}

type DeviceHeartbeat struct {
	Version   int       `json:"version"`
	DeviceID  string    `json:"deviceId"`
	PeerID    string    `json:"peerId,omitempty"`
	PublicKey string    `json:"publicKey"`
	At        time.Time `json:"at"`
	Signature string    `json:"signature"`
}

func ensureDeviceIdentity(home string) (deviceIdentity, error) {
	path := filepath.Join(home, "device-identity.json")
	if raw, err := os.ReadFile(path); err == nil {
		var identity deviceIdentity
		if err := json.Unmarshal(raw, &identity); err != nil {
			return deviceIdentity{}, fmt.Errorf("parse device identity: %w", err)
		}
		if err := validateDeviceIdentity(identity); err != nil {
			return deviceIdentity{}, err
		}
		return identity, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return deviceIdentity{}, fmt.Errorf("read device identity: %w", err)
	}

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return deviceIdentity{}, fmt.Errorf("generate device identity: %w", err)
	}
	sum := sha256.Sum256(publicKey)
	identity := deviceIdentity{
		Version:    deviceIdentityVersion,
		DeviceID:   hex.EncodeToString(sum[:12]),
		PublicKey:  base64.RawURLEncoding.EncodeToString(publicKey),
		PrivateKey: base64.RawURLEncoding.EncodeToString(privateKey),
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return deviceIdentity{}, err
	}
	raw, err := json.MarshalIndent(identity, "", "  ")
	if err != nil {
		return deviceIdentity{}, err
	}
	if err := os.WriteFile(path, append(raw, '\n'), 0o600); err != nil {
		return deviceIdentity{}, fmt.Errorf("save device identity: %w", err)
	}
	return identity, nil
}

func validateDeviceIdentity(identity deviceIdentity) error {
	if identity.Version != deviceIdentityVersion {
		return fmt.Errorf("unsupported device identity version %d", identity.Version)
	}
	publicKey, err := base64.RawURLEncoding.DecodeString(identity.PublicKey)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return errors.New("device identity has invalid public key")
	}
	privateKey, err := base64.RawURLEncoding.DecodeString(identity.PrivateKey)
	if err != nil || len(privateKey) != ed25519.PrivateKeySize {
		return errors.New("device identity has invalid private key")
	}
	sum := sha256.Sum256(publicKey)
	if identity.DeviceID != hex.EncodeToString(sum[:12]) {
		return errors.New("device identity ID does not match public key")
	}
	if !ed25519.PublicKey(publicKey).Equal(ed25519.PrivateKey(privateKey).Public()) {
		return errors.New("device identity keypair does not match")
	}
	return nil
}

func (identity deviceIdentity) signOp(op VaultOp) (VaultOp, error) {
	if err := validateDeviceIdentity(identity); err != nil {
		return VaultOp{}, err
	}
	if op.ID == "" {
		var raw [16]byte
		if _, err := rand.Read(raw[:]); err != nil {
			return VaultOp{}, err
		}
		op.ID = hex.EncodeToString(raw[:])
	}
	if op.CreatedAt.IsZero() {
		op.CreatedAt = time.Now().UTC()
	}
	op.Version = vaultOpVersion
	op.DeviceID = identity.DeviceID
	op.PublicKey = identity.PublicKey
	op.Signature = ""

	payload, err := canonicalVaultOp(op)
	if err != nil {
		return VaultOp{}, err
	}
	privateKey, _ := base64.RawURLEncoding.DecodeString(identity.PrivateKey)
	op.Signature = base64.RawURLEncoding.EncodeToString(ed25519.Sign(ed25519.PrivateKey(privateKey), payload))
	return op, nil
}

func (identity deviceIdentity) signHeartbeat(peerID string, at time.Time) (DeviceHeartbeat, error) {
	if err := validateDeviceIdentity(identity); err != nil {
		return DeviceHeartbeat{}, err
	}
	if at.IsZero() {
		at = time.Now().UTC()
	}
	heartbeat := DeviceHeartbeat{
		Version:   deviceHeartbeatVersion,
		DeviceID:  identity.DeviceID,
		PeerID:    strings.TrimSpace(peerID),
		PublicKey: identity.PublicKey,
		At:        at.UTC(),
	}
	payload, err := canonicalDeviceHeartbeat(heartbeat)
	if err != nil {
		return DeviceHeartbeat{}, err
	}
	privateKey, _ := base64.RawURLEncoding.DecodeString(identity.PrivateKey)
	heartbeat.Signature = base64.RawURLEncoding.EncodeToString(
		ed25519.Sign(ed25519.PrivateKey(privateKey), payload),
	)
	return heartbeat, nil
}

func verifyDeviceHeartbeat(heartbeat DeviceHeartbeat) error {
	if heartbeat.Version != deviceHeartbeatVersion {
		return fmt.Errorf("unsupported device heartbeat version %d", heartbeat.Version)
	}
	if heartbeat.DeviceID == "" || heartbeat.PublicKey == "" || heartbeat.Signature == "" || heartbeat.At.IsZero() {
		return errors.New("device heartbeat is incomplete")
	}
	publicKey, err := base64.RawURLEncoding.DecodeString(heartbeat.PublicKey)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return errors.New("device heartbeat has invalid public key")
	}
	sum := sha256.Sum256(publicKey)
	if heartbeat.DeviceID != hex.EncodeToString(sum[:12]) {
		return errors.New("device heartbeat device ID does not match public key")
	}
	signature, err := base64.RawURLEncoding.DecodeString(heartbeat.Signature)
	if err != nil || len(signature) != ed25519.SignatureSize {
		return errors.New("device heartbeat has invalid signature")
	}
	unsigned := heartbeat
	unsigned.Signature = ""
	payload, err := canonicalDeviceHeartbeat(unsigned)
	if err != nil {
		return err
	}
	if !ed25519.Verify(ed25519.PublicKey(publicKey), payload, signature) {
		return errors.New("device heartbeat signature verification failed")
	}
	return nil
}

func canonicalDeviceHeartbeat(heartbeat DeviceHeartbeat) ([]byte, error) {
	heartbeat.Signature = ""
	return json.Marshal(heartbeat)
}

func mergeDeviceHeartbeats(existing, incoming map[string]DeviceHeartbeat) map[string]DeviceHeartbeat {
	result := make(map[string]DeviceHeartbeat, len(existing)+len(incoming))
	for deviceID, heartbeat := range existing {
		if verifyDeviceHeartbeat(heartbeat) == nil && heartbeat.DeviceID == deviceID {
			result[deviceID] = heartbeat
		}
	}
	for deviceID, heartbeat := range incoming {
		if verifyDeviceHeartbeat(heartbeat) != nil || heartbeat.DeviceID != deviceID {
			continue
		}
		current, ok := result[deviceID]
		if !ok || heartbeat.At.After(current.At) {
			result[deviceID] = heartbeat
		}
	}
	return result
}

func verifyVaultOp(op VaultOp) error {
	if op.Version != vaultOpVersion {
		return fmt.Errorf("unsupported vault op version %d", op.Version)
	}
	if op.ID == "" || op.Type == "" || op.DeviceID == "" || op.PublicKey == "" || op.Signature == "" {
		return errors.New("vault op is incomplete")
	}
	if op.CreatedAt.IsZero() {
		return errors.New("vault op is missing createdAt")
	}
	publicKey, err := base64.RawURLEncoding.DecodeString(op.PublicKey)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return errors.New("vault op has invalid public key")
	}
	sum := sha256.Sum256(publicKey)
	if op.DeviceID != hex.EncodeToString(sum[:12]) {
		return errors.New("vault op device ID does not match public key")
	}
	signature, err := base64.RawURLEncoding.DecodeString(op.Signature)
	if err != nil || len(signature) != ed25519.SignatureSize {
		return errors.New("vault op has invalid signature")
	}
	unsigned := op
	unsigned.Signature = ""
	payload, err := canonicalVaultOp(unsigned)
	if err != nil {
		return err
	}
	if !ed25519.Verify(ed25519.PublicKey(publicKey), payload, signature) {
		return errors.New("vault op signature verification failed")
	}
	switch op.Type {
	case vaultOpFileAdd:
		if op.File == nil || strings.TrimSpace(op.File.ID) == "" || strings.TrimSpace(op.File.CID) == "" || strings.TrimSpace(op.File.Name) == "" {
			return errors.New("file.add op is incomplete")
		}
	case vaultOpFileRemove:
		if strings.TrimSpace(op.FileID) == "" {
			return errors.New("file.remove op is missing file ID")
		}
	case vaultOpReplicaAck:
		if strings.TrimSpace(op.FileID) == "" || strings.TrimSpace(op.CID) == "" {
			return errors.New("replica.ack op is incomplete")
		}
	default:
		return fmt.Errorf("unsupported vault op type %q", op.Type)
	}
	return nil
}

func canonicalVaultOp(op VaultOp) ([]byte, error) {
	return json.Marshal(op)
}

func mergeVerifiedOps(existing []VaultOp, incoming []VaultOp) ([]VaultOp, bool, error) {
	index := make(map[string]VaultOp, len(existing)+len(incoming))
	for _, op := range existing {
		if err := verifyVaultOp(op); err != nil {
			continue
		}
		index[op.ID] = op
	}
	changed := false
	for _, op := range incoming {
		if err := verifyVaultOp(op); err != nil {
			return nil, false, fmt.Errorf("verify vault op %q: %w", op.ID, err)
		}
		if _, ok := index[op.ID]; ok {
			continue
		}
		index[op.ID] = op
		changed = true
	}
	merged := make([]VaultOp, 0, len(index))
	for _, op := range index {
		merged = append(merged, op)
	}
	sort.SliceStable(merged, func(i, j int) bool {
		if merged[i].CreatedAt.Equal(merged[j].CreatedAt) {
			return merged[i].ID < merged[j].ID
		}
		return merged[i].CreatedAt.Before(merged[j].CreatedAt)
	})
	return merged, changed, nil
}

func applyVaultOps(base []DemoFile, ops []VaultOp) []DemoFile {
	files := make(map[string]DemoFile, len(base))
	for _, file := range base {
		if file.ID == "" || file.CID == "" {
			continue
		}
		files[file.ID] = file
	}
	sorted := append([]VaultOp(nil), ops...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].CreatedAt.Equal(sorted[j].CreatedAt) {
			return sorted[i].ID < sorted[j].ID
		}
		return sorted[i].CreatedAt.Before(sorted[j].CreatedAt)
	})
	for _, op := range sorted {
		if verifyVaultOp(op) != nil {
			continue
		}
		switch op.Type {
		case vaultOpFileAdd:
			if op.File == nil {
				continue
			}
			file := *op.File
			file.Local = false
			file.Share = ""
			file.ReplicaCount = 0
			file.Replicas = nil
			files[file.ID] = file
		case vaultOpFileRemove:
			delete(files, op.FileID)
		}
	}
	result := make([]DemoFile, 0, len(files))
	for _, file := range files {
		result = append(result, file)
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].AddedAt.Equal(result[j].AddedAt) {
			return result[i].ID < result[j].ID
		}
		return result[i].AddedAt.After(result[j].AddedAt)
	})
	return result
}

func replicaReceiptsFor(ops []VaultOp, fileID, cid string, heartbeats map[string]DeviceHeartbeat, now time.Time) []ReplicaReceipt {
	type storedReceipt struct {
		receipt ReplicaReceipt
		stored  time.Time
	}
	latest := make(map[string]storedReceipt)
	for _, op := range ops {
		if op.Type != vaultOpReplicaAck || op.FileID != fileID || op.CID != cid {
			continue
		}
		if verifyVaultOp(op) != nil {
			continue
		}
		current, ok := latest[op.DeviceID]
		if ok && !op.CreatedAt.After(current.stored) {
			continue
		}
		latest[op.DeviceID] = storedReceipt{
			receipt: ReplicaReceipt{
				DeviceID: op.DeviceID,
				PeerID:   op.PeerID,
				CID:      op.CID,
				StoredAt: op.CreatedAt,
			},
			stored: op.CreatedAt,
		}
	}

	if now.IsZero() {
		now = time.Now().UTC()
	}
	result := make([]ReplicaReceipt, 0, len(latest))
	for deviceID, stored := range latest {
		heartbeat, ok := heartbeats[deviceID]
		if !ok || verifyDeviceHeartbeat(heartbeat) != nil {
			continue
		}
		age := now.Sub(heartbeat.At)
		if age < -5*time.Minute || age > replicaHeartbeatFreshness {
			continue
		}
		receipt := stored.receipt
		if heartbeat.PeerID != "" {
			receipt.PeerID = heartbeat.PeerID
		}
		receipt.At = heartbeat.At
		result = append(result, receipt)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].At.After(result[j].At) })
	return result
}
