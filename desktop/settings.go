package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Settings struct {
	ReplicationTarget  int    `json:"replicationTarget"`
	StorageMax         string `json:"storageMax"`
	KeepRunningOnClose bool   `json:"keepRunningOnClose"`
	StartOnLogin       bool   `json:"startOnLogin"`
	DownloadDir        string `json:"downloadDir"`
}

type settingsStore struct {
	path string
	mu   sync.RWMutex
	data Settings
}

func newSettingsStore(home string) *settingsStore {
	store := &settingsStore{
		path: filepath.Join(home, "settings.json"),
		data: defaultSettings(),
	}
	store.load()
	return store
}

func defaultSettings() Settings {
	downloadDir := ""
	if home, err := os.UserHomeDir(); err == nil {
		downloadDir = filepath.Join(home, "Downloads")
	}
	return Settings{
		ReplicationTarget:  3,
		StorageMax:         "20GB",
		KeepRunningOnClose: true,
		StartOnLogin:       false,
		DownloadDir:        downloadDir,
	}
}

func (s *settingsStore) load() {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var value Settings
	if json.Unmarshal(raw, &value) != nil {
		return
	}
	if value.ReplicationTarget < 1 {
		value.ReplicationTarget = 3
	}
	if strings.TrimSpace(value.StorageMax) == "" {
		value.StorageMax = "20GB"
	}
	if strings.TrimSpace(value.DownloadDir) == "" {
		value.DownloadDir = defaultSettings().DownloadDir
	}
	s.data = value
}

func (s *settingsStore) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data
}

func (s *settingsStore) Save(value Settings) error {
	if value.ReplicationTarget < 1 || value.ReplicationTarget > 10 {
		return errors.New("replication target must be between 1 and 10")
	}
	value.StorageMax = strings.ToUpper(strings.TrimSpace(value.StorageMax))
	if value.StorageMax == "" {
		return errors.New("storage allocation is required")
	}
	value.DownloadDir = strings.TrimSpace(value.DownloadDir)
	if value.DownloadDir == "" {
		return errors.New("download directory is required")
	}
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return err
	}
	s.mu.Lock()
	s.data = value
	s.mu.Unlock()
	return nil
}
