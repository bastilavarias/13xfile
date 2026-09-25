package node

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base32"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	demoManifestVersion = 2
	demoConfigVersion   = 1
	demoMaxUpload       = int64(512 << 20) // 512 MiB
)

type DemoFile struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	CID          string           `json:"cid"`
	Size         int64            `json:"size"`
	MIME         string           `json:"mime"`
	AddedAt      time.Time        `json:"addedAt"`
	AddedBy      string           `json:"addedBy"`
	Share        string           `json:"share,omitempty"`
	Visibility   string           `json:"visibility,omitempty"`
	Cipher       string           `json:"cipher,omitempty"`
	KeyWrap      string           `json:"keyWrap,omitempty"`
	Local        bool             `json:"local"`
	ReplicaCount int              `json:"replicaCount,omitempty"`
	Replicas     []ReplicaReceipt `json:"replicas,omitempty"`
}

type demoManifest struct {
	Version   int                        `json:"version"`
	VaultID   string                     `json:"vaultId"`
	UpdatedAt time.Time                  `json:"updatedAt"`
	Files     []DemoFile                 `json:"files"`
	Ops       []VaultOp                  `json:"ops,omitempty"`
	Devices   map[string]DeviceHeartbeat `json:"devices,omitempty"`
}

type demoConfig struct {
	Version int    `json:"version"`
	Code    string `json:"code"`
	KeyName string `json:"keyName"`
	VaultID string `json:"vaultId"`
}

type demoService struct {
	app          *App
	kubo         kubo
	cfg          demoConfig
	device       deviceIdentity
	manifestPath string
	mu           sync.RWMutex
	manifest     demoManifest
	local        map[string]bool
	replicating  map[string]bool
	lastSync     time.Time
	lastError    string
}

type demoStatus struct {
	PeerID       string     `json:"peerId"`
	DeviceID     string     `json:"deviceId"`
	VaultID      string     `json:"vaultId"`
	JoinCode     string     `json:"joinCode"`
	Files        []DemoFile `json:"files"`
	LastSync     time.Time  `json:"lastSync,omitempty"`
	LastError    string     `json:"lastError,omitempty"`
	Warning      string     `json:"warning"`
	ManifestMode string     `json:"manifestMode"`
}

type demoShare struct {
	Version int    `json:"v"`
	Name    string `json:"name"`
	CID     string `json:"cid"`
	Size    int64  `json:"size"`
	MIME    string `json:"mime"`
}

func (a *App) RunWebDemo(ctx context.Context, listenAddr, vaultCode string) error {
	cfg, err := loadConfig(a.configPath)
	if err != nil {
		return err
	}
	binary, err := a.requireKubo()
	if err != nil {
		return err
	}
	k := kubo{binary: binary, repoPath: cfg.RepoPath}

	if err := waitForKuboDaemon(ctx, k, 45*time.Second); err != nil {
		return err
	}

	service, err := newDemoService(ctx, a, k, vaultCode)
	if err != nil {
		return err
	}

	fmt.Printf("13xfile web demo: http://%s\n", displayListenAddress(listenAddr))
	fmt.Printf("Vault ID: %s\n", service.cfg.VaultID)
	fmt.Printf("Join code: %s\n", service.cfg.Code)
	if strings.HasPrefix(listenAddr, "0.0.0.0:") || strings.HasPrefix(listenAddr, ":") {
		fmt.Println("Web demo is listening on the LAN. Prototype has no web authentication; do not port-forward it to the public internet.")
	}

	go service.syncLoop(ctx)
	go func() {
		publishCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		_ = service.publishManifest(publishCtx)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/", service.handleIndex)
	mux.HandleFunc("/api/status", service.handleStatus)
	mux.HandleFunc("/api/upload", service.handleUpload)
	mux.HandleFunc("/api/register", service.handleRegister)
	mux.HandleFunc("/api/remove", service.handleRemove)
	mux.HandleFunc("/api/import-share", service.handleImportShare)
	mux.HandleFunc("/file/", service.handleFile)
	mux.HandleFunc("/share/", service.handleFile)

	server := &http.Server{
		Addr:              listenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	err = server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func waitForKuboDaemon(ctx context.Context, k kubo, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	apiPath := filepath.Join(k.repoPath, "api")
	for {
		if data, err := os.ReadFile(apiPath); err == nil && strings.TrimSpace(string(data)) != "" {
			probeCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			_, probeErr := k.run(probeCtx, "id")
			cancel()
			if probeErr == nil {
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("Kubo daemon did not become ready within %s", timeout)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func newDemoService(ctx context.Context, app *App, k kubo, requestedCode string) (*demoService, error) {
	cfg, err := ensureDemoConfig(ctx, app.home, k, requestedCode)
	if err != nil {
		return nil, err
	}
	device, err := ensureDeviceIdentity(app.home)
	if err != nil {
		return nil, err
	}

	vaultDir := filepath.Join(app.home, "vaults", cfg.VaultID)
	if err := os.MkdirAll(vaultDir, 0o700); err != nil {
		return nil, fmt.Errorf("create demo vault directory: %w", err)
	}

	s := &demoService{
		app:          app,
		kubo:         k,
		cfg:          cfg,
		device:       device,
		manifestPath: filepath.Join(vaultDir, "manifest.json"),
		local:        make(map[string]bool),
		replicating:  make(map[string]bool),
	}
	if err := s.loadManifest(); err != nil {
		return nil, err
	}
	if _, err := s.recordDeviceHeartbeat(); err != nil {
		return nil, err
	}
	s.replicateMissing()

	syncCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	syncErr := s.syncFromNetwork(syncCtx)
	cancel()
	if syncErr != nil {
		publishCtx, publishCancel := context.WithTimeout(ctx, 45*time.Second)
		_ = s.publishManifest(publishCtx)
		publishCancel()
	}

	return s, nil
}

func ensureDemoConfig(ctx context.Context, home string, k kubo, requestedCode string) (demoConfig, error) {
	path := filepath.Join(home, "web-demo.json")
	var existing demoConfig
	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &existing); err != nil {
			return demoConfig{}, fmt.Errorf("parse web demo config: %w", err)
		}
	}

	code := strings.TrimSpace(requestedCode)
	if code == "" {
		code = strings.TrimSpace(existing.Code)
	}
	if code == "" {
		var raw [18]byte
		if _, err := rand.Read(raw[:]); err != nil {
			return demoConfig{}, fmt.Errorf("generate vault join code: %w", err)
		}
		code = base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw[:])
	}
	if len(code) < 12 {
		return demoConfig{}, errors.New("vault join code must be at least 12 characters")
	}

	sum := sha256.Sum256([]byte("13xfile-demo-vault/v1:" + code))
	keyName := "13xfile-demo-" + hex.EncodeToString(sum[:5])

	keyID, err := ensureVaultKey(ctx, k, keyName, sum[:])
	if err != nil {
		return demoConfig{}, err
	}

	cfg := demoConfig{
		Version: demoConfigVersion,
		Code:    code,
		KeyName: keyName,
		VaultID: keyID,
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return demoConfig{}, err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o600); err != nil {
		return demoConfig{}, fmt.Errorf("save web demo config: %w", err)
	}
	return cfg, nil
}

func ensureVaultKey(ctx context.Context, k kubo, keyName string, seed []byte) (string, error) {
	output, err := k.run(ctx, "key", "list", "-l")
	if err != nil {
		return "", err
	}
	for _, line := range splitNonEmptyLines(output) {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[len(fields)-1] == keyName {
			return fields[0], nil
		}
	}

	privateKey := ed25519.NewKeyFromSeed(seed)
	der, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return "", fmt.Errorf("marshal demo vault key: %w", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	if len(pemBytes) == 0 {
		return "", errors.New("encode demo vault key")
	}

	tmp, err := os.CreateTemp("", "13xfile-vault-key-*.pem")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if _, err := tmp.Write(pemBytes); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	keyID, err := k.run(ctx, "key", "import", "--format=pem-pkcs8-cleartext", keyName, tmpName)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(keyID), nil
}

func (s *demoService) loadManifest() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.manifestPath)
	if errors.Is(err, os.ErrNotExist) {
		s.manifest = demoManifest{
			Version: demoManifestVersion,
			VaultID: s.cfg.VaultID,
			Files:   []DemoFile{},
			Devices: make(map[string]DeviceHeartbeat),
		}
		return s.saveManifestLocked()
	}
	if err != nil {
		return fmt.Errorf("read local vault manifest: %w", err)
	}
	if err := json.Unmarshal(data, &s.manifest); err != nil {
		return fmt.Errorf("parse local vault manifest: %w", err)
	}
	if s.manifest.Version < 1 || s.manifest.Version > demoManifestVersion {
		return fmt.Errorf("unsupported local manifest version %d", s.manifest.Version)
	}
	if s.manifest.VaultID != "" && s.manifest.VaultID != s.cfg.VaultID {
		return errors.New("local manifest belongs to a different vault")
	}
	s.manifest.VaultID = s.cfg.VaultID
	s.manifest.Version = demoManifestVersion
	if s.manifest.Devices == nil {
		s.manifest.Devices = make(map[string]DeviceHeartbeat)
	}
	s.manifest.Files = applyVaultOps(s.manifest.Files, s.manifest.Ops)
	return s.saveManifestLocked()
}

func (s *demoService) saveManifestLocked() error {
	s.manifest.Version = demoManifestVersion
	s.manifest.VaultID = s.cfg.VaultID
	s.manifest.UpdatedAt = time.Now().UTC()
	sort.SliceStable(s.manifest.Files, func(i, j int) bool {
		return s.manifest.Files[i].AddedAt.After(s.manifest.Files[j].AddedAt)
	})
	data, err := json.MarshalIndent(s.manifest, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.manifestPath + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.manifestPath)
}

func (s *demoService) syncLoop(ctx context.Context) {
	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()
	republish := time.NewTicker(45 * time.Minute)
	defer republish.Stop()
	heartbeat := time.NewTicker(replicaHeartbeatInterval)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			syncCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
			_ = s.syncFromNetwork(syncCtx)
			cancel()
		case <-republish.C:
			publishCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
			_ = s.publishManifest(publishCtx)
			cancel()
		case <-heartbeat.C:
			changed, err := s.recordDeviceHeartbeat()
			if err != nil {
				s.setSyncResult(err)
				continue
			}
			if changed {
				publishCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
				_ = s.publishManifest(publishCtx)
				cancel()
			}
		}
	}
}

func (s *demoService) syncFromNetwork(ctx context.Context) error {
	resolved, err := s.kubo.run(ctx, "name", "resolve", "--nocache", "--dht-timeout=12s", "/ipns/"+s.cfg.VaultID)
	if err != nil {
		s.setSyncResult(err)
		return err
	}
	resolved = strings.TrimSpace(resolved)
	if !strings.HasPrefix(resolved, "/ipfs/") {
		err := fmt.Errorf("unexpected IPNS resolution %q", resolved)
		s.setSyncResult(err)
		return err
	}

	payload, err := s.kubo.run(ctx, "cat", resolved)
	if err != nil {
		s.setSyncResult(err)
		return err
	}
	var remote demoManifest
	if err := json.Unmarshal([]byte(payload), &remote); err != nil {
		s.setSyncResult(err)
		return err
	}
	if remote.VaultID != s.cfg.VaultID || remote.Version < 1 || remote.Version > demoManifestVersion {
		err := errors.New("resolved manifest does not match this vault")
		s.setSyncResult(err)
		return err
	}

	if _, _, err := s.mergeManifest(remote); err != nil {
		s.setSyncResult(err)
		return err
	}
	s.setSyncResult(nil)
	s.replicateMissing()
	return nil
}

func (s *demoService) mergeManifest(remote demoManifest) ([]DemoFile, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	legacy := make(map[string]DemoFile, len(s.manifest.Files)+len(remote.Files))
	for _, file := range s.manifest.Files {
		if file.ID == "" || file.CID == "" || file.Name == "" {
			continue
		}
		legacy[file.ID] = file
	}
	for _, file := range remote.Files {
		if file.ID == "" || file.CID == "" || file.Name == "" {
			continue
		}
		if _, exists := legacy[file.ID]; !exists {
			file.Local = false
			file.Share = ""
			file.ReplicaCount = 0
			file.Replicas = nil
			legacy[file.ID] = file
		}
	}

	mergedOps, opsChanged, err := mergeVerifiedOps(s.manifest.Ops, remote.Ops)
	if err != nil {
		return nil, false, err
	}
	mergedDevices := mergeDeviceHeartbeats(s.manifest.Devices, remote.Devices)
	devicesChanged := len(mergedDevices) != len(s.manifest.Devices)
	if !devicesChanged {
		for deviceID, heartbeat := range mergedDevices {
			current, ok := s.manifest.Devices[deviceID]
			if !ok || current.Signature != heartbeat.Signature {
				devicesChanged = true
				break
			}
		}
	}

	before := make(map[string]DemoFile, len(s.manifest.Files))
	for _, file := range s.manifest.Files {
		before[file.ID] = file
	}
	base := make([]DemoFile, 0, len(legacy))
	for _, file := range legacy {
		base = append(base, file)
	}
	s.manifest.Ops = mergedOps
	s.manifest.Devices = mergedDevices
	s.manifest.Files = applyVaultOps(base, mergedOps)

	var newFiles []DemoFile
	for _, file := range s.manifest.Files {
		if _, existed := before[file.ID]; !existed {
			newFiles = append(newFiles, file)
		}
	}

	changed := opsChanged || devicesChanged || len(newFiles) > 0 || len(s.manifest.Files) != len(before)
	if !changed {
		return nil, false, nil
	}
	if err := s.saveManifestLocked(); err != nil {
		return nil, false, err
	}
	return newFiles, true, nil
}

func (s *demoService) replicateMissing() {
	s.mu.Lock()
	var pending []DemoFile
	for _, file := range s.manifest.Files {
		if s.local[file.ID] || s.replicating[file.ID] {
			continue
		}
		s.replicating[file.ID] = true
		pending = append(pending, file)
	}
	s.mu.Unlock()

	for _, file := range pending {
		file := file
		go s.pinRemote(file)
	}
}

func (s *demoService) pinRemote(file DemoFile) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	_, err := s.kubo.run(ctx, "pin", "add", "--recursive=true", "--name=13xfile-web-demo", "--fast-provide-root", "/ipfs/"+file.CID)

	s.mu.Lock()
	delete(s.replicating, file.ID)
	if err == nil {
		s.local[file.ID] = true
	} else {
		s.lastError = "replication " + file.Name + ": " + err.Error()
	}
	s.mu.Unlock()

	if err != nil {
		return
	}
	added, ackErr := s.recordReplicaAck(file)
	if ackErr != nil {
		s.mu.Lock()
		s.lastError = "replica receipt " + file.Name + ": " + ackErr.Error()
		s.mu.Unlock()
		return
	}
	if added {
		publishCtx, publishCancel := context.WithTimeout(context.Background(), 45*time.Second)
		_ = s.publishManifest(publishCtx)
		publishCancel()
	}
}

func (s *demoService) recordDeviceHeartbeat() (bool, error) {
	heartbeat, err := s.device.signHeartbeat(localPeerID(s.app), time.Now().UTC())
	if err != nil {
		return false, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.manifest.Devices == nil {
		s.manifest.Devices = make(map[string]DeviceHeartbeat)
	}
	current, ok := s.manifest.Devices[s.device.DeviceID]
	if ok && !heartbeat.At.After(current.At) {
		return false, nil
	}
	s.manifest.Devices[s.device.DeviceID] = heartbeat
	if err := s.saveManifestLocked(); err != nil {
		return false, err
	}
	return true, nil
}

func (s *demoService) recordReplicaAck(file DemoFile) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, op := range s.manifest.Ops {
		if op.Type == vaultOpReplicaAck && op.DeviceID == s.device.DeviceID && op.FileID == file.ID && op.CID == file.CID {
			return false, nil
		}
	}
	op, err := s.device.signOp(VaultOp{
		Type:   vaultOpReplicaAck,
		PeerID: localPeerID(s.app),
		FileID: file.ID,
		CID:    file.CID,
	})
	if err != nil {
		return false, err
	}
	s.manifest.Ops = append(s.manifest.Ops, op)
	if err := s.saveManifestLocked(); err != nil {
		return false, err
	}
	return true, nil
}

func (s *demoService) setSyncResult(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastSync = time.Now().UTC()
	if err != nil {
		s.lastError = err.Error()
	} else {
		s.lastError = ""
	}
}

func (s *demoService) publishManifest(ctx context.Context) error {
	_ = s.syncFromNetwork(ctx)

	s.mu.RLock()
	copyManifest := s.manifest
	copyManifest.Files = append([]DemoFile(nil), s.manifest.Files...)
	s.mu.RUnlock()
	for i := range copyManifest.Files {
		copyManifest.Files[i].Local = false
		copyManifest.Files[i].Share = ""
		copyManifest.Files[i].ReplicaCount = 0
		copyManifest.Files[i].Replicas = nil
	}

	data, err := json.MarshalIndent(copyManifest, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp("", "13xfile-manifest-*.json")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	cid, err := s.kubo.run(ctx, "add", "--pin=true", "-Q", name)
	if err != nil {
		return err
	}
	sequence := fmt.Sprintf("%d", time.Now().UTC().UnixNano())
	_, err = s.kubo.run(
		ctx,
		"name", "publish",
		"--key="+s.cfg.KeyName,
		"--ttl=5s",
		"--lifetime=24h",
		"--sequence="+sequence,
		"/ipfs/"+strings.TrimSpace(cid),
	)
	if err != nil {
		s.setSyncResult(err)
		return err
	}
	s.setSyncResult(nil)
	return nil
}

func (s *demoService) addLocalFile(file DemoFile) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.manifest.Files {
		if existing.ID == file.ID {
			s.local[file.ID] = true
			return nil
		}
	}

	signedFile := file
	signedFile.Local = false
	signedFile.Share = ""
	signedFile.ReplicaCount = 0
	signedFile.Replicas = nil

	addOp, err := s.device.signOp(VaultOp{
		Type:   vaultOpFileAdd,
		PeerID: localPeerID(s.app),
		File:   &signedFile,
	})
	if err != nil {
		return err
	}
	ackOp, err := s.device.signOp(VaultOp{
		Type:   vaultOpReplicaAck,
		PeerID: localPeerID(s.app),
		FileID: file.ID,
		CID:    file.CID,
	})
	if err != nil {
		return err
	}

	s.manifest.Ops = append(s.manifest.Ops, addOp, ackOp)
	s.manifest.Files = applyVaultOps(s.manifest.Files, s.manifest.Ops)
	s.local[file.ID] = true
	return s.saveManifestLocked()
}

func (s *demoService) removeLocalFile(fileID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fileID = strings.TrimSpace(fileID)
	if fileID == "" {
		return errors.New("file ID is required")
	}
	found := false
	for _, file := range s.manifest.Files {
		if file.ID == fileID {
			found = true
			break
		}
	}
	if !found {
		return os.ErrNotExist
	}

	op, err := s.device.signOp(VaultOp{
		Type:   vaultOpFileRemove,
		PeerID: localPeerID(s.app),
		FileID: fileID,
	})
	if err != nil {
		return err
	}
	s.manifest.Ops = append(s.manifest.Ops, op)
	s.manifest.Files = applyVaultOps(s.manifest.Files, s.manifest.Ops)
	delete(s.local, fileID)
	delete(s.replicating, fileID)
	return s.saveManifestLocked()
}

func (s *demoService) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, demoHTML)
}

func (s *demoService) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cfg, _ := loadConfig(s.app.configPath)
	peerID, _ := readPeerID(cfg.RepoPath)

	s.mu.RLock()
	files := append([]DemoFile(nil), s.manifest.Files...)
	ops := append([]VaultOp(nil), s.manifest.Ops...)
	devices := make(map[string]DeviceHeartbeat, len(s.manifest.Devices))
	for deviceID, heartbeat := range s.manifest.Devices {
		devices[deviceID] = heartbeat
	}
	lastSync := s.lastSync
	lastError := s.lastError
	local := make(map[string]bool, len(s.local))
	for k, v := range s.local {
		local[k] = v
	}
	s.mu.RUnlock()

	if files == nil {
		files = []DemoFile{}
	}
	for i := range files {
		files[i].Local = local[files[i].ID]
		files[i].Share = encodeShare(files[i])
		files[i].Replicas = replicaReceiptsFor(ops, files[i].ID, files[i].CID, devices, time.Now().UTC())
		files[i].ReplicaCount = len(files[i].Replicas)
	}
	writeJSON(w, http.StatusOK, demoStatus{
		PeerID:       peerID,
		DeviceID:     s.device.DeviceID,
		VaultID:      s.cfg.VaultID,
		JoinCode:     s.cfg.Code,
		Files:        files,
		LastSync:     lastSync,
		LastError:    lastError,
		Warning:      "MVP protocol: signed device operations and replica receipts enabled.",
		ManifestMode: "IPNS pointer + signed append-only vault operations",
	})
}

func (s *demoService) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, demoMaxUpload)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "upload is invalid or exceeds 512 MiB", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	tmp, err := os.CreateTemp("", "13xfile-upload-*")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	size, err := io.Copy(tmp, file)
	if closeErr := tmp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		http.Error(w, "store upload: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	cid, err := s.kubo.run(ctx, "add", "--pin=true", "--pin-name=13xfile-web-demo", "-Q", tmpName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	id, err := randomID()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	name := safeFilename(header)
	fileMeta := DemoFile{
		ID:         id,
		Name:       name,
		CID:        strings.TrimSpace(cid),
		Size:       size,
		MIME:       contentType(header, name),
		Visibility: "public",
		AddedAt:    time.Now().UTC(),
		AddedBy:    localPeerID(s.app),
		Local:      true,
	}
	if err := s.addLocalFile(fileMeta); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	fileMeta.Share = encodeShare(fileMeta)

	publishCtx, publishCancel := context.WithTimeout(context.Background(), 45*time.Second)
	err = s.publishManifest(publishCtx)
	publishCancel()
	if err != nil {
		s.mu.Lock()
		s.lastError = "publish: " + err.Error()
		s.mu.Unlock()
	}

	writeJSON(w, http.StatusCreated, fileMeta)
}

func (s *demoService) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		CID        string `json:"cid"`
		Size       int64  `json:"size"`
		MIME       string `json:"mime"`
		Visibility string `json:"visibility"`
		Cipher     string `json:"cipher"`
		KeyWrap    string `json:"keyWrap"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	body.ID = strings.TrimSpace(body.ID)
	body.Name = strings.TrimSpace(body.Name)
	body.CID = strings.TrimSpace(body.CID)
	body.Visibility = strings.ToLower(strings.TrimSpace(body.Visibility))
	if body.ID == "" {
		var err error
		body.ID, err = randomID()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	if body.Name == "" || body.CID == "" {
		http.Error(w, "name and cid are required", http.StatusBadRequest)
		return
	}
	if _, err := validateIPFSPath(body.CID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.Visibility == "" {
		body.Visibility = "public"
	}
	if body.Visibility != "public" && body.Visibility != "private" {
		http.Error(w, "visibility must be public or private", http.StatusBadRequest)
		return
	}

	meta := DemoFile{
		ID:         body.ID,
		Name:       filepath.Base(body.Name),
		CID:        body.CID,
		Size:       body.Size,
		MIME:       strings.TrimSpace(body.MIME),
		Visibility: body.Visibility,
		Cipher:     strings.TrimSpace(body.Cipher),
		KeyWrap:    strings.TrimSpace(body.KeyWrap),
		AddedAt:    time.Now().UTC(),
		AddedBy:    localPeerID(s.app),
		Local:      true,
	}
	if meta.MIME == "" {
		meta.MIME = "application/octet-stream"
	}
	if err := s.addLocalFile(meta); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	publishCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	err := s.publishManifest(publishCtx)
	cancel()
	if err != nil {
		s.mu.Lock()
		s.lastError = "publish: " + err.Error()
		s.mu.Unlock()
	}

	meta.Share = encodeShare(meta)
	writeJSON(w, http.StatusCreated, meta)
}

func (s *demoService) handleRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := s.removeLocalFile(body.ID); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	publishCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	err := s.publishManifest(publishCtx)
	cancel()
	if err != nil {
		s.mu.Lock()
		s.lastError = "publish removal: " + err.Error()
		s.mu.Unlock()
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *demoService) handleImportShare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Share string `json:"share"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	shared, err := decodeShare(strings.TrimSpace(body.Share))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id, err := randomID()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	meta := DemoFile{
		ID:      id,
		Name:    shared.Name,
		CID:     shared.CID,
		Size:    shared.Size,
		MIME:    shared.MIME,
		AddedAt: time.Now().UTC(),
		AddedBy: "shared",
		Local:   false,
	}
	if err := s.addLocalFile(meta); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	s.mu.Lock()
	s.local[meta.ID] = false
	s.mu.Unlock()
	go s.pinRemote(meta)

	publishCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	_ = s.publishManifest(publishCtx)
	cancel()

	meta.Share = encodeShare(meta)
	writeJSON(w, http.StatusCreated, meta)
}

func (s *demoService) handleFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(r.URL.Path, "/file/"), "/share/"))
	if id == "" {
		http.NotFound(w, r)
		return
	}

	s.mu.RLock()
	var target DemoFile
	for _, file := range s.manifest.Files {
		if file.ID == id {
			target = file
			break
		}
	}
	s.mu.RUnlock()
	if target.ID == "" {
		http.NotFound(w, r)
		return
	}

	if target.MIME != "" {
		w.Header().Set("Content-Type", target.MIME)
	}
	if disposition := mime.FormatMediaType("attachment", map[string]string{"filename": target.Name}); disposition != "" {
		w.Header().Set("Content-Disposition", disposition)
	}
	if target.Size > 0 {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", target.Size))
	}

	cmd := s.kubo.command(r.Context(), "cat", "/ipfs/"+target.CID)
	cmd.Stdout = w
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if !headersWritten(w) {
			http.Error(w, "fetch failed: "+stderr.String(), http.StatusBadGateway)
		}
	}
}

func safeFilename(header *multipart.FileHeader) string {
	name := filepath.Base(strings.TrimSpace(header.Filename))
	if name == "" || name == "." {
		return "upload.bin"
	}
	return name
}

func contentType(header *multipart.FileHeader, name string) string {
	if value := strings.TrimSpace(header.Header.Get("Content-Type")); value != "" {
		return value
	}
	if value := mime.TypeByExtension(filepath.Ext(name)); value != "" {
		return value
	}
	return "application/octet-stream"
}

func localPeerID(app *App) string {
	cfg, err := loadConfig(app.configPath)
	if err != nil {
		return ""
	}
	id, _ := readPeerID(cfg.RepoPath)
	return id
}

func randomID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw[:]), nil
}

func encodeShare(file DemoFile) string {
	payload := demoShare{
		Version: 1,
		Name:    file.Name,
		CID:     file.CID,
		Size:    file.Size,
		MIME:    file.MIME,
	}
	data, _ := json.Marshal(payload)
	return "13xfile://share/" + base64.RawURLEncoding.EncodeToString(data)
}

func decodeShare(value string) (demoShare, error) {
	const prefix = "13xfile://share/"
	if !strings.HasPrefix(value, prefix) {
		return demoShare{}, errors.New("share descriptor must start with 13xfile://share/")
	}
	data, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, prefix))
	if err != nil {
		return demoShare{}, errors.New("invalid share descriptor")
	}
	var shared demoShare
	if err := json.Unmarshal(data, &shared); err != nil {
		return demoShare{}, errors.New("invalid share descriptor")
	}
	if shared.Version != 1 || shared.CID == "" || shared.Name == "" {
		return demoShare{}, errors.New("unsupported or incomplete share descriptor")
	}
	if _, err := validateIPFSPath(shared.CID); err != nil {
		return demoShare{}, err
	}
	return shared, nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

type trackingWriter interface {
	Written() bool
}

func headersWritten(w http.ResponseWriter) bool {
	if tw, ok := w.(trackingWriter); ok {
		return tw.Written()
	}
	return false
}

func displayListenAddress(addr string) string {
	if strings.HasPrefix(addr, ":") {
		return "127.0.0.1" + addr
	}
	if strings.HasPrefix(addr, "0.0.0.0:") {
		return strings.Replace(addr, "0.0.0.0:", "127.0.0.1:", 1)
	}
	return addr
}

func shareDownloadURL(base string, id string) string {
	u, _ := url.Parse(base)
	u.Path = "/share/" + id
	return u.String()
}

const demoHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>13xfile Web Demo</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f6f6f4}
*{box-sizing:border-box}body{margin:0}.wrap{max-width:980px;margin:0 auto;padding:34px 20px 70px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}
h1{font-size:28px;margin:0;letter-spacing:-.04em}.sub{color:#666;margin-top:5px;font-size:14px}
.badge{font-size:12px;border:1px solid #d9d9d5;background:white;border-radius:999px;padding:7px 10px}
.panel{background:white;border:1px solid #dfdfdb;border-radius:14px;padding:18px;margin-bottom:16px}
.drop{border:1.5px dashed #b7b7b0;border-radius:12px;padding:28px;text-align:center;background:#fbfbfa}
input[type=file]{max-width:100%}button{border:0;background:#171717;color:white;border-radius:9px;padding:10px 14px;font-weight:650;cursor:pointer}
button.secondary{background:#eee;color:#222}button.small{padding:7px 10px;font-size:12px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:#666}
.meta code{display:block;color:#222;margin-top:4px;word-break:break-all}
.files{display:flex;flex-direction:column}.file{display:grid;grid-template-columns:minmax(0,1fr) 120px 105px 210px;gap:10px;align-items:center;padding:14px 2px;border-top:1px solid #ecece8}
.file:first-child{border-top:0}.name{font-weight:650;overflow:hidden;text-overflow:ellipsis}.cid{font-family:ui-monospace,monospace;color:#777;font-size:11px;overflow:hidden;text-overflow:ellipsis}
.size,.stored{font-size:13px;color:#666}.ok{color:#247a42}.pending{color:#9a6b10}.actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}
.warn{font-size:12px;color:#8a5b12;background:#fff8df;border:1px solid #efe0a6;padding:10px 12px;border-radius:9px;margin-bottom:16px}
.sync{font-size:12px;color:#777}.error{color:#a33}.empty{padding:26px 0;color:#777;text-align:center}
input[type=text]{width:min(100%,650px);border:1px solid #d8d8d3;border-radius:9px;padding:10px;background:white}
@media(max-width:760px){header{display:block}.badge{display:inline-block;margin-top:10px}.meta{grid-template-columns:1fr}.file{grid-template-columns:1fr}.actions{justify-content:flex-start}}
</style>
</head>
<body>
<div class="wrap">
<header><div><h1>13xfile</h1><div class="sub">Decentralized storage mechanics demo</div></div><div class="badge" id="peerBadge">connecting…</div></header>
<div class="warn">Prototype only — file contents are not encrypted yet. Use dummy/test files.</div>
<section class="panel">
<div class="drop">
<form id="uploadForm">
<p><strong>Upload to this node</strong></p>
<p><input id="fileInput" name="file" type="file" required></p>
<button type="submit">Upload & publish</button>
<span id="uploadState" class="sync"></span>
</form>
</div>
</section>
<section class="panel">
<div class="meta">
<div>Vault ID<code id="vaultId">—</code></div>
<div>Join code (treat as demo secret)<code id="joinCode">—</code></div>
</div>
</section>
<section class="panel">
<div class="row" style="justify-content:space-between;margin-bottom:10px"><strong>Files</strong><span id="sync" class="sync">syncing…</span></div>
<div id="files" class="files"><div class="empty">No files yet.</div></div>
</section>
<section class="panel">
<strong>Import a share descriptor</strong>
<p class="sub">Paste a <code>13xfile://share/…</code> descriptor from another vault.</p>
<div class="row"><input id="shareInput" type="text" placeholder="13xfile://share/..."><button id="importBtn">Import</button></div>
</section>
</div>
<script>
const $=s=>document.querySelector(s);
function fmt(n){if(!n)return"0 B";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}
function short(s){return s&&s.length>18?s.slice(0,10)+"…"+s.slice(-6):s}
async function refresh(){
 try{
  const r=await fetch("/api/status",{cache:"no-store"});const d=await r.json();
  $("#peerBadge").textContent="peer "+short(d.peerId);
  $("#vaultId").textContent=d.vaultId;$("#joinCode").textContent=d.joinCode;
  $("#sync").textContent=d.lastError?"sync issue: "+d.lastError:(d.lastSync?"last sync "+new Date(d.lastSync).toLocaleTimeString():"waiting for first network sync");
  $("#sync").className=d.lastError?"sync error":"sync";
  const root=$("#files");root.innerHTML="";
  if(!d.files.length){root.innerHTML='<div class="empty">No files yet.</div>';return}
  d.files.forEach(f=>{
    const el=document.createElement("div");el.className="file";
    el.innerHTML='<div><div class="name"></div><div class="cid"></div></div><div class="size"></div><div class="stored"></div><div class="actions"></div>';
    el.querySelector(".name").textContent=f.name;
    el.querySelector(".cid").textContent=f.cid;
    el.querySelector(".size").textContent=fmt(f.size);
    const st=el.querySelector(".stored");st.textContent=f.local?"stored here":"replicating";st.className="stored "+(f.local?"ok":"pending");
    const a=el.querySelector(".actions");
    const dl=document.createElement("button");dl.className="small secondary";dl.textContent="Download";dl.onclick=()=>location.href="/file/"+encodeURIComponent(f.id);a.appendChild(dl);
    const sh=document.createElement("button");sh.className="small";sh.textContent="Copy share";sh.onclick=async()=>{await navigator.clipboard.writeText(f.share);sh.textContent="Copied";setTimeout(()=>sh.textContent="Copy share",1000)};a.appendChild(sh);
    root.appendChild(el);
  })
 }catch(e){$("#sync").textContent="web API unavailable";$("#sync").className="sync error"}
}
$("#uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();const file=$("#fileInput").files[0];if(!file)return;
 const fd=new FormData();fd.append("file",file);$("#uploadState").textContent=" uploading…";
 try{const r=await fetch("/api/upload",{method:"POST",body:fd});if(!r.ok)throw new Error(await r.text());$("#uploadState").textContent=" uploaded + published";$("#fileInput").value="";await refresh()}
 catch(e){$("#uploadState").textContent=" "+e.message}
});
$("#importBtn").onclick=async()=>{
 const share=$("#shareInput").value.trim();if(!share)return;
 const r=await fetch("/api/import-share",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({share})});
 if(!r.ok){alert(await r.text());return}$("#shareInput").value="";await refresh();
};
refresh();setInterval(refresh,3000);
</script>
</body>
</html>`
