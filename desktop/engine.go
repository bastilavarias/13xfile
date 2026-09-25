package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	nodeengine "github.com/13xfile/13xfile/node/internal/node"
)

const (
	defaultDesktopAPIAddr = "127.0.0.1:8791"
	defaultVaultAPIAddr   = "127.0.0.1:8790"
)

func desktopAPIAddr() string {
	if value := strings.TrimSpace(os.Getenv("THIRTEENXFILE_DESKTOP_API_ADDR")); value != "" {
		return value
	}
	return defaultDesktopAPIAddr
}

func vaultAPIAddr() string {
	if value := strings.TrimSpace(os.Getenv("THIRTEENXFILE_VAULT_API_ADDR")); value != "" {
		return value
	}
	return defaultVaultAPIAddr
}

type DesktopEngine struct {
	ctx  context.Context
	home string
	node *nodeengine.App

	mu             sync.RWMutex
	nodeOnline     bool
	connectedPeers int
	peerID         string
	fatal          string
	paused         bool

	vaultMu      sync.Mutex
	vaultStarted bool
	vaultErr     error

	transfers *TransferManager
	settings  *settingsStore

	autostartMu      sync.RWMutex
	autostartHandler func(bool) error

	apiServer *http.Server

	progressMu       sync.RWMutex
	progressCallback func(active int, progress int, summary string)
}

func newDesktopEngine(ctx context.Context, home string, nodeApp *nodeengine.App) (*DesktopEngine, error) {
	engine := &DesktopEngine{
		ctx:      ctx,
		home:     home,
		node:     nodeApp,
		settings: newSettingsStore(home),
	}
	engine.transfers = newTransferManager(ctx, engine, 3)
	engine.apiServer = &http.Server{
		Addr:              desktopAPIAddr(),
		Handler:           engine.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	if code := engine.savedVaultCode(); code != "" {
		go func() {
			if err := engine.startVault(code); err != nil {
				engine.vaultMu.Lock()
				engine.vaultErr = err
				engine.vaultMu.Unlock()
			}
		}()
	}

	return engine, nil
}

func (e *DesktopEngine) Run() {
	e.transfers.Start()

	go func() {
		<-e.ctx.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = e.apiServer.Shutdown(ctx)
	}()

	if err := e.apiServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		e.setFatal(fmt.Errorf("desktop API: %w", err))
	}
}

func (e *DesktopEngine) Close() {
	if e.transfers != nil {
		e.transfers.Close()
	}
}

func (e *DesktopEngine) SetAutostartHandler(handler func(bool) error) {
	e.autostartMu.Lock()
	e.autostartHandler = handler
	e.autostartMu.Unlock()
}

func (e *DesktopEngine) applySettings(next Settings) error {
	current := e.settings.Get()
	if next.ReplicationTarget < 1 || next.ReplicationTarget > 10 {
		return errors.New("replication target must be between 1 and 10")
	}
	if strings.TrimSpace(next.DownloadDir) == "" {
		return errors.New("download directory is required")
	}
	if err := os.MkdirAll(next.DownloadDir, 0o755); err != nil {
		return fmt.Errorf("create download directory: %w", err)
	}
	if !strings.EqualFold(strings.TrimSpace(current.StorageMax), strings.TrimSpace(next.StorageMax)) {
		normalized, err := e.node.SetStorageMax(next.StorageMax)
		if err != nil {
			return fmt.Errorf("update storage allocation: %w", err)
		}
		next.StorageMax = normalized
	}

	if current.StartOnLogin != next.StartOnLogin {
		e.autostartMu.RLock()
		handler := e.autostartHandler
		e.autostartMu.RUnlock()
		if handler == nil {
			return errors.New("start-at-login integration is not ready")
		}
		if err := handler(next.StartOnLogin); err != nil {
			return fmt.Errorf("update start-at-login: %w", err)
		}
	}

	return e.settings.Save(next)
}

func (e *DesktopEngine) keepRunningOnClose() bool {
	return e.settings.Get().KeepRunningOnClose
}

func (e *DesktopEngine) SetProgressCallback(callback func(active int, progress int, summary string)) {
	e.progressMu.Lock()
	e.progressCallback = callback
	e.progressMu.Unlock()
}

func (e *DesktopEngine) notifyProgress() {
	active, progress, summary := e.transfers.Aggregate()
	e.progressMu.RLock()
	callback := e.progressCallback
	e.progressMu.RUnlock()
	if callback != nil {
		callback(active, progress, summary)
	}
}

func (e *DesktopEngine) setPeerStatus(online bool, peers int, peerID string) {
	e.mu.Lock()
	e.nodeOnline = online
	e.connectedPeers = peers
	e.peerID = peerID
	if online {
		e.fatal = ""
	}
	e.mu.Unlock()
}

func (e *DesktopEngine) setFatal(err error) {
	if err == nil {
		return
	}
	e.mu.Lock()
	e.fatal = err.Error()
	e.mu.Unlock()
}

func (e *DesktopEngine) setPaused(paused bool) {
	e.mu.Lock()
	e.paused = paused
	e.mu.Unlock()
	e.transfers.SetPaused(paused)
}

func (e *DesktopEngine) state() AppState {
	e.mu.RLock()
	state := AppState{
		NodeOnline:     e.nodeOnline,
		ConnectedPeers: e.connectedPeers,
		PeerID:         e.peerID,
		Paused:         e.paused,
		Settings:       e.settings.Get(),
		Fatal:          e.fatal,
	}
	e.mu.RUnlock()

	state.Transfers = e.transfers.List()
	vault, err := e.vaultStatus()
	if err == nil {
		state.Vault = vault
		state.NeedsVault = false
	} else {
		state.NeedsVault = e.savedVaultCode() == ""
	}
	return state
}

func (e *DesktopEngine) nodeHome() string {
	return filepath.Join(e.home, "node")
}

func (e *DesktopEngine) vaultConfigPath() string {
	return filepath.Join(e.nodeHome(), "web-demo.json")
}

func (e *DesktopEngine) savedVaultCode() string {
	data, err := os.ReadFile(e.vaultConfigPath())
	if err != nil {
		return ""
	}
	var cfg struct {
		Code string `json:"code"`
	}
	if json.Unmarshal(data, &cfg) != nil {
		return ""
	}
	return strings.TrimSpace(cfg.Code)
}

func (e *DesktopEngine) startVault(code string) error {
	e.vaultMu.Lock()
	if e.vaultStarted {
		e.vaultMu.Unlock()
		return nil
	}
	e.vaultStarted = true
	e.vaultErr = nil
	e.vaultMu.Unlock()

	go func() {
		if err := e.node.RunWebDemo(e.ctx, vaultAPIAddr(), strings.TrimSpace(code)); err != nil && e.ctx.Err() == nil {
			e.vaultMu.Lock()
			e.vaultErr = err
			e.vaultStarted = false
			e.vaultMu.Unlock()
		}
	}()

	deadline := time.Now().Add(60 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := e.vaultStatus(); err == nil {
			return nil
		}
		select {
		case <-e.ctx.Done():
			return e.ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}

	e.vaultMu.Lock()
	e.vaultStarted = false
	e.vaultMu.Unlock()
	return errors.New("vault did not become ready")
}

func (e *DesktopEngine) vaultStatus() (*VaultStatus, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get("http://" + vaultAPIAddr() + "/api/status")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vault status HTTP %s", resp.Status)
	}
	var status VaultStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	if status.Files == nil {
		status.Files = []VaultFile{}
	}
	for i := range status.Files {
		if status.Files[i].Visibility == "" {
			status.Files[i].Visibility = "public"
		}
	}
	return &status, nil
}

func (e *DesktopEngine) vaultCode() (string, error) {
	status, err := e.vaultStatus()
	if err == nil && status.JoinCode != "" {
		return status.JoinCode, nil
	}
	code := e.savedVaultCode()
	if code == "" {
		return "", errors.New("no vault configured")
	}
	return code, nil
}

func (e *DesktopEngine) kuboBinary() (string, error) {
	if explicit := strings.TrimSpace(os.Getenv("KUBO_BIN")); explicit != "" {
		if info, err := os.Stat(explicit); err == nil && !info.IsDir() {
			return explicit, nil
		}
	}

	base := filepath.Join(e.nodeHome(), "runtime", "kubo")
	name := "ipfs"
	if runtime.GOOS == "windows" {
		name = "ipfs.exe"
	}
	matches, err := filepath.Glob(filepath.Join(base, "*", name))
	if err != nil {
		return "", err
	}
	sort.Strings(matches)
	for i := len(matches) - 1; i >= 0; i-- {
		info, statErr := os.Stat(matches[i])
		if statErr == nil && !info.IsDir() {
			return matches[i], nil
		}
	}
	return "", errors.New("managed Kubo runtime not found")
}

func (e *DesktopEngine) kuboCommand(ctx context.Context, args ...string) (*exec.Cmd, error) {
	binary, err := e.kuboBinary()
	if err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Env = append(os.Environ(), "IPFS_PATH="+filepath.Join(e.nodeHome(), "ipfs"))
	return cmd, nil
}

func (e *DesktopEngine) addToIPFS(ctx context.Context, path string) (string, error) {
	cmd, err := e.kuboCommand(ctx, "add", "--pin=true", "--pin-name=13xfile-desktop", "--cid-version=1", "-Q", path)
	if err != nil {
		return "", err
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ipfs add: %s", strings.TrimSpace(string(output)))
	}
	cid := strings.TrimSpace(string(output))
	if cid == "" {
		return "", errors.New("ipfs add returned empty CID")
	}
	return cid, nil
}

func (e *DesktopEngine) findFile(id string) (VaultFile, error) {
	status, err := e.vaultStatus()
	if err != nil {
		return VaultFile{}, err
	}
	for _, file := range status.Files {
		if file.ID == id {
			return file, nil
		}
	}
	return VaultFile{}, os.ErrNotExist
}
