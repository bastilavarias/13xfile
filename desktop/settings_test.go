package main

import (
	"path/filepath"
	"testing"
)

func TestSettingsStoreRoundTrip(t *testing.T) {
	home := t.TempDir()
	store := newSettingsStore(home)
	value := store.Get()
	if value.ReplicationTarget != 3 {
		t.Fatalf("unexpected default replication target %d", value.ReplicationTarget)
	}
	value.ReplicationTarget = 4
	value.StorageMax = "50GB"
	value.DownloadDir = filepath.Join(home, "downloads")
	value.KeepRunningOnClose = false
	if err := store.Save(value); err != nil {
		t.Fatal(err)
	}

	reloaded := newSettingsStore(home).Get()
	if reloaded.ReplicationTarget != 4 || reloaded.StorageMax != "50GB" || reloaded.KeepRunningOnClose {
		t.Fatalf("unexpected reloaded settings %#v", reloaded)
	}
	if reloaded.DownloadDir != value.DownloadDir {
		t.Fatalf("unexpected download dir %q", reloaded.DownloadDir)
	}
}
