package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

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
