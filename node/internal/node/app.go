package node

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type App struct {
	home       string
	configPath string
	kuboBinary string
}

type InitResult struct {
	PeerID      string
	RepoPath    string
	StorageMax  string
	KuboVersion string
}

type Status struct {
	PeerID         string
	Online         bool
	ConnectedPeers int
	RepoPath       string
	StorageMax     string
	RepoStat       string
}

type DoctorReport struct {
	KuboBinary    string
	KuboAvailable bool
	KuboVersion   string
	ConfigPresent bool
	RepoPresent   bool
	Error         string
}

func New() (*App, error) {
	home, err := defaultHome()
	if err != nil {
		return nil, err
	}
	binary, binaryErr := findKuboBinary(home)
	if binaryErr != nil {
		binary = ""
	}
	return &App{
		home:       home,
		configPath: filepath.Join(home, "config.json"),
		kuboBinary: binary,
	}, nil
}

func (a *App) requireKubo() (string, error) {
	if a.kuboBinary != "" {
		return a.kuboBinary, nil
	}

	binary, err := ensureManagedKubo(context.Background(), a.home)
	if err != nil {
		return "", fmt.Errorf("bootstrap managed Kubo: %w", err)
	}
	a.kuboBinary = binary
	return binary, nil
}

func (a *App) Init(storage string) (InitResult, error) {
	binary, err := a.requireKubo()
	if err != nil {
		return InitResult{}, err
	}

	storage, err = normalizeStorage(storage)
	if err != nil {
		return InitResult{}, err
	}

	if _, err := os.Stat(a.configPath); err == nil {
		return InitResult{}, errors.New("node is already initialized")
	} else if !errors.Is(err, os.ErrNotExist) {
		return InitResult{}, fmt.Errorf("inspect node config: %w", err)
	}

	repoPath := filepath.Join(a.home, "ipfs")
	if err := os.MkdirAll(a.home, 0o700); err != nil {
		return InitResult{}, fmt.Errorf("create node home: %w", err)
	}

	k := kubo{binary: binary, repoPath: repoPath}
	version, err := k.run(context.Background(), "version", "--number")
	if err != nil {
		return InitResult{}, err
	}

	if !repoExists(repoPath) {
		if _, err := k.run(context.Background(), "init", "--algorithm=ed25519", "--empty-repo=true"); err != nil {
			return InitResult{}, err
		}
	}

	if _, err := k.run(context.Background(), "config", "Datastore.StorageMax", storage); err != nil {
		return InitResult{}, err
	}
	// Use an ephemeral loopback RPC port. Kubo writes the actual address to
	// $IPFS_PATH/api, so all 13xfile-node commands discover it automatically
	// without exposing the administrative API or colliding with another Kubo.
	if _, err := k.run(context.Background(), "config", "Addresses.API", "/ip4/127.0.0.1/tcp/0"); err != nil {
		return InitResult{}, err
	}
	// A storage peer does not need an HTTP gateway. Disabling it avoids
	// unnecessary listeners and common port collisions on 8080.
	if _, err := k.run(context.Background(), "config", "--json", "Addresses.Gateway", "[]"); err != nil {
		return InitResult{}, err
	}

	peerID, err := readPeerID(repoPath)
	if err != nil {
		return InitResult{}, err
	}

	cfg := Config{
		Version:     configVersion,
		RepoPath:    repoPath,
		StorageMax:  storage,
		CreatedAt:   time.Now().UTC(),
		KuboVersion: version,
	}
	if err := saveConfig(a.configPath, cfg); err != nil {
		return InitResult{}, err
	}

	return InitResult{
		PeerID:      peerID,
		RepoPath:    repoPath,
		StorageMax:  storage,
		KuboVersion: version,
	}, nil
}

func (a *App) EnsureInitialized(storage string) (*InitResult, error) {
	if _, err := os.Stat(a.configPath); err == nil {
		return nil, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("inspect node config: %w", err)
	}

	result, err := a.Init(storage)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (a *App) Start(ctx context.Context, enableGC bool) error {
	binary, err := a.requireKubo()
	if err != nil {
		return err
	}
	cfg, err := loadConfig(a.configPath)
	if err != nil {
		return err
	}

	k := kubo{binary: binary, repoPath: cfg.RepoPath}
	return k.daemon(ctx, enableGC)
}

func (a *App) SetStorageMax(storage string) (string, error) {
	storage, err := normalizeStorage(storage)
	if err != nil {
		return "", err
	}
	k, err := a.loadedKubo()
	if err != nil {
		return "", err
	}
	if _, err := k.run(context.Background(), "config", "Datastore.StorageMax", storage); err != nil {
		return "", err
	}
	cfg, err := loadConfig(a.configPath)
	if err != nil {
		return "", err
	}
	cfg.StorageMax = storage
	if err := saveConfig(a.configPath, cfg); err != nil {
		return "", err
	}
	return storage, nil
}

func (a *App) Status() (Status, error) {
	binary, err := a.requireKubo()
	if err != nil {
		return Status{}, err
	}
	cfg, err := loadConfig(a.configPath)
	if err != nil {
		return Status{}, err
	}

	k := kubo{binary: binary, repoPath: cfg.RepoPath}
	peerID, err := readPeerID(cfg.RepoPath)
	if err != nil {
		return Status{}, err
	}

	status := Status{
		PeerID:     peerID,
		RepoPath:   cfg.RepoPath,
		StorageMax: cfg.StorageMax,
	}

	apiFile := filepath.Join(cfg.RepoPath, "api")
	apiData, apiErr := os.ReadFile(apiFile)
	if apiErr == nil && strings.TrimSpace(string(apiData)) != "" {
		peers, peersErr := k.run(context.Background(), "swarm", "peers")
		if peersErr == nil {
			status.Online = true
			status.ConnectedPeers = countNonEmptyLines(peers)
		}

		repoStat, statErr := k.run(context.Background(), "repo", "stat")
		if statErr == nil {
			status.RepoStat = repoStat
		}
	}

	return status, nil
}

func (a *App) Pin(path string) (string, error) {
	k, err := a.loadedKubo()
	if err != nil {
		return "", err
	}
	path, err = validateIPFSPath(path)
	if err != nil {
		return "", err
	}
	return k.run(context.Background(), "pin", "add", "--recursive=true", "--name=13xfile", "--fast-provide-root", path)
}

func (a *App) Unpin(path string) (string, error) {
	k, err := a.loadedKubo()
	if err != nil {
		return "", err
	}
	path, err = validateIPFSPath(path)
	if err != nil {
		return "", err
	}
	return k.run(context.Background(), "pin", "rm", path)
}

func (a *App) Peers() ([]string, error) {
	k, err := a.loadedKubo()
	if err != nil {
		return nil, err
	}
	output, err := k.run(context.Background(), "swarm", "peers")
	if err != nil {
		return nil, err
	}
	return splitNonEmptyLines(output), nil
}

func (a *App) GC() (string, error) {
	k, err := a.loadedKubo()
	if err != nil {
		return "", err
	}
	return k.run(context.Background(), "repo", "gc")
}

func (a *App) loadedKubo() (kubo, error) {
	binary, err := a.requireKubo()
	if err != nil {
		return kubo{}, err
	}
	cfg, err := loadConfig(a.configPath)
	if err != nil {
		return kubo{}, err
	}
	return kubo{binary: binary, repoPath: cfg.RepoPath}, nil
}

func (a *App) Doctor() DoctorReport {
	if a.kuboBinary == "" {
		binary, err := ensureManagedKubo(context.Background(), a.home)
		if err != nil {
			return DoctorReport{Error: fmt.Sprintf("bootstrap managed Kubo: %v", err)}
		}
		a.kuboBinary = binary
	}

	report := DoctorReport{KuboBinary: a.kuboBinary}

	probe := kubo{binary: a.kuboBinary, repoPath: filepath.Join(a.home, "ipfs")}
	version, err := probe.run(context.Background(), "version", "--number")
	if err != nil {
		report.Error = err.Error()
		return report
	}
	report.KuboAvailable = true
	report.KuboVersion = version

	cfg, err := loadConfig(a.configPath)
	if err != nil {
		if strings.Contains(err.Error(), "not initialized") {
			return report
		}
		report.Error = err.Error()
		return report
	}
	report.ConfigPresent = true
	report.RepoPresent = repoExists(cfg.RepoPath)
	return report
}

func validateIPFSPath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("CID/path cannot be empty")
	}
	if strings.ContainsAny(value, " \t\r\n") {
		return "", errors.New("CID/path cannot contain whitespace")
	}
	if strings.HasPrefix(value, "/ipfs/") || strings.HasPrefix(value, "/ipns/") {
		return value, nil
	}
	return "/ipfs/" + value, nil
}

func splitNonEmptyLines(value string) []string {
	var lines []string
	for _, line := range strings.Split(value, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func countNonEmptyLines(value string) int {
	return len(splitNonEmptyLines(value))
}
