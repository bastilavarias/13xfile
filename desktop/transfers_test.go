package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTransferQueueIgnoresFeedPublishingWhilePaused(t *testing.T) {
	home := t.TempDir()
	source := filepath.Join(home, "public-file.zip")
	if err := os.WriteFile(source, []byte("test archive"), 0o600); err != nil {
		t.Fatal(err)
	}
	engine := &DesktopEngine{home: home}
	manager := newTransferManager(context.Background(), engine, 1)
	engine.transfers = manager

	items, err := manager.QueuePaths([]string{source}, "public", false, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 queued item, got %d", len(items))
	}
	if items[0].ShareToFeed {
		t.Fatal("feed publishing must be disabled for the public transfer")
	}
	if manager.jobs[items[0].ID].ShareToFeed {
		t.Fatal("feed publishing was still enabled in the queued job")
	}

	restored := newTransferManager(context.Background(), engine, 1)
	if restored.jobs[items[0].ID].ShareToFeed {
		t.Fatal("feed publishing was persisted in the journal")
	}
}

func TestTransferRemoveDeletesTerminalEntry(t *testing.T) {
	home := t.TempDir()
	sourceDir := filepath.Join(home, "staging", "tx-remove")
	if err := os.MkdirAll(sourceDir, 0o700); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(sourceDir, "done.txt")
	if err := os.WriteFile(source, []byte("done"), 0o600); err != nil {
		t.Fatal(err)
	}

	engine := &DesktopEngine{home: home}
	manager := newTransferManager(context.Background(), engine, 1)
	now := time.Now().UTC()

	manager.mu.Lock()
	manager.items["tx-remove"] = &Transfer{
		ID:         "tx-remove",
		Name:       "done.txt",
		Size:       4,
		Visibility: "public",
		Status:     "complete",
		Stage:      "Stored & announced",
		Progress:   100,
		CreatedAt:  now,
		UpdatedAt:  now,
		Staged:     true,
	}
	manager.jobs["tx-remove"] = transferJob{
		ID:         "tx-remove",
		Path:       source,
		Visibility: "public",
		Staged:     true,
	}
	if err := manager.persistLocked(); err != nil {
		manager.mu.Unlock()
		t.Fatal(err)
	}
	manager.mu.Unlock()

	if err := manager.Remove("tx-remove"); err != nil {
		t.Fatal(err)
	}
	if _, ok := manager.items["tx-remove"]; ok {
		t.Fatal("transfer remained in memory after removal")
	}
	if _, err := os.Stat(source); !os.IsNotExist(err) {
		t.Fatalf("expected staged source cleanup, got %v", err)
	}

	restored := newTransferManager(context.Background(), engine, 1)
	if _, ok := restored.items["tx-remove"]; ok {
		t.Fatal("transfer returned after journal reload")
	}
}

func TestTransferRemoveRejectsActiveEntry(t *testing.T) {
	home := t.TempDir()
	engine := &DesktopEngine{home: home}
	manager := newTransferManager(context.Background(), engine, 1)
	now := time.Now().UTC()

	manager.mu.Lock()
	manager.items["tx-active"] = &Transfer{
		ID:         "tx-active",
		Name:       "active.txt",
		Visibility: "public",
		Status:     "running",
		Stage:      "Adding to IPFS",
		Progress:   65,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	manager.jobs["tx-active"] = transferJob{ID: "tx-active", Path: filepath.Join(home, "active.txt"), Visibility: "public"}
	manager.mu.Unlock()

	if err := manager.Remove("tx-active"); err == nil {
		t.Fatal("expected active transfer removal to fail")
	}
	if _, ok := manager.items["tx-active"]; !ok {
		t.Fatal("active transfer was removed")
	}
}

func TestTransferJournalRestoresQueuedWork(t *testing.T) {
	home := t.TempDir()
	source := filepath.Join(home, "upload.txt")
	if err := os.WriteFile(source, []byte("journal"), 0o600); err != nil {
		t.Fatal(err)
	}

	engine := &DesktopEngine{home: home}
	manager := newTransferManager(context.Background(), engine, 1)
	now := time.Now().UTC()
	manager.mu.Lock()
	manager.items["tx-1"] = &Transfer{
		ID:         "tx-1",
		Name:       "upload.txt",
		Size:       7,
		Visibility: "private",
		Status:     "running",
		Stage:      "Encrypting",
		Progress:   37,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	manager.jobs["tx-1"] = transferJob{
		ID:         "tx-1",
		Path:       source,
		Visibility: "private",
	}
	if err := manager.persistLocked(); err != nil {
		manager.mu.Unlock()
		t.Fatal(err)
	}
	manager.mu.Unlock()

	restored := newTransferManager(context.Background(), engine, 1)
	item := restored.items["tx-1"]
	if item == nil {
		t.Fatal("expected transfer to be restored")
	}
	if restored.jobs["tx-1"].Path != source {
		t.Fatalf("unexpected restored source %q", restored.jobs["tx-1"].Path)
	}
	if item.Status != "running" || item.Progress != 37 {
		t.Fatalf("unexpected restored transfer %#v", item)
	}
}
