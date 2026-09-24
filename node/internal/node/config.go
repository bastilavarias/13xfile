package node

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const configVersion = 1

type Config struct {
	Version     int       `json:"version"`
	RepoPath    string    `json:"repoPath"`
	StorageMax  string    `json:"storageMax"`
	CreatedAt   time.Time `json:"createdAt"`
	KuboVersion string    `json:"kuboVersion"`
}

func defaultHome() (string, error) {
	if configured := os.Getenv("THIRTEENXFILE_NODE_HOME"); configured != "" {
		return filepath.Abs(configured)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".13xfile-node"), nil
}

func loadConfig(path string) (Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Config{}, fmt.Errorf("node is not initialized; run \"13xfile-node init\"")
		}
		return Config{}, fmt.Errorf("read node config: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode node config: %w", err)
	}
	if cfg.Version != configVersion {
		return Config{}, fmt.Errorf("unsupported node config version %d", cfg.Version)
	}
	return cfg, nil
}

func readPeerID(repoPath string) (string, error) {
	raw, err := os.ReadFile(filepath.Join(repoPath, "config"))
	if err != nil {
		return "", fmt.Errorf("read Kubo config: %w", err)
	}

	var kuboConfig struct {
		Identity struct {
			PeerID string `json:"PeerID"`
		} `json:"Identity"`
	}
	if err := json.Unmarshal(raw, &kuboConfig); err != nil {
		return "", fmt.Errorf("decode Kubo config: %w", err)
	}
	if kuboConfig.Identity.PeerID == "" {
		return "", errors.New("Kubo config is missing Identity.PeerID")
	}
	return kuboConfig.Identity.PeerID, nil
}

func saveConfig(path string, cfg Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create node home: %w", err)
	}
	raw, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("encode node config: %w", err)
	}
	raw = append(raw, '\n')
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return fmt.Errorf("write node config: %w", err)
	}
	return nil
}
