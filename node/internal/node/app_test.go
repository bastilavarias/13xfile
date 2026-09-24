//go:build !windows

package node

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFakeKubo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "ipfs")
	script := `#!/bin/sh
set -eu

cmd="$1"
shift || true

case "$cmd" in
  version)
    echo "0.43.1"
    ;;
  init)
    mkdir -p "$IPFS_PATH"
    printf '{"Identity":{"PeerID":"12D3KooW13xfileFakePeer"}}' > "$IPFS_PATH/config"
    echo "generating ED25519 keypair...done"
    ;;
  config)
    if [ "$1" = "Identity.PeerID" ]; then
      echo "12D3KooW13xfileFakePeer"
    fi
    ;;
  swarm)
    if [ "$1" = "peers" ]; then
      echo "/ip4/10.0.0.2/tcp/4001/p2p/peerA"
      echo "/ip4/10.0.0.3/tcp/4001/p2p/peerB"
    fi
    ;;
  repo)
    case "$1" in
      stat)
        echo "RepoSize: 12345"
        echo "StorageMax: 500000000000"
        ;;
      gc)
        echo "removed bafygarbage"
        ;;
    esac
    ;;
  pin)
    action="$1"
    shift
    case "$action" in
      add)
        last=""
        for arg in "$@"; do last="$arg"; done
        echo "pinned $last recursively"
        ;;
      rm)
        echo "unpinned $1"
        ;;
    esac
    ;;
  daemon)
    echo "Daemon is ready"
    ;;
  *)
    echo "unsupported fake kubo command: $cmd" >&2
    exit 2
    ;;
esac
`
	if err := os.WriteFile(path, []byte(script), 0o700); err != nil {
		t.Fatal(err)
	}
	return path
}

func newTestApp(t *testing.T) *App {
	t.Helper()
	home := filepath.Join(t.TempDir(), "node-home")
	kuboPath := writeFakeKubo(t)
	t.Setenv("THIRTEENXFILE_NODE_HOME", home)
	t.Setenv("KUBO_BIN", kuboPath)

	app, err := New()
	if err != nil {
		t.Fatal(err)
	}
	return app
}

func TestInitStatusPinAndDoctor(t *testing.T) {
	app := newTestApp(t)

	initResult, err := app.Init("500GB")
	if err != nil {
		t.Fatalf("Init: %v", err)
	}
	if initResult.PeerID != "12D3KooW13xfileFakePeer" {
		t.Fatalf("unexpected peer ID %q", initResult.PeerID)
	}
	if initResult.StorageMax != "500GB" {
		t.Fatalf("unexpected storage %q", initResult.StorageMax)
	}
	if !repoExists(initResult.RepoPath) {
		t.Fatal("expected fake Kubo repo to exist")
	}

	updatedStorage, err := app.SetStorageMax("750GB")
	if err != nil {
		t.Fatalf("SetStorageMax: %v", err)
	}
	if updatedStorage != "750GB" {
		t.Fatalf("unexpected updated storage %q", updatedStorage)
	}

	status, err := app.Status()
	if err != nil {
		t.Fatalf("Status before daemon: %v", err)
	}
	if status.Online || status.ConnectedPeers != 0 {
		t.Fatalf("expected initialized node to remain offline before daemon readiness: %+v", status)
	}
	if status.StorageMax != "750GB" {
		t.Fatalf("status did not persist updated storage: %+v", status)
	}

	if err := os.WriteFile(filepath.Join(initResult.RepoPath, "api"), []byte("/ip4/127.0.0.1/tcp/5001\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	status, err = app.Status()
	if err != nil {
		t.Fatalf("Status after daemon readiness: %v", err)
	}
	if !status.Online || status.ConnectedPeers != 2 {
		t.Fatalf("unexpected online status: %+v", status)
	}
	if !strings.Contains(status.RepoStat, "RepoSize: 12345") {
		t.Fatalf("missing repo stat: %q", status.RepoStat)
	}

	pinned, err := app.Pin("bafytest")
	if err != nil {
		t.Fatalf("Pin: %v", err)
	}
	if !strings.Contains(pinned, "/ipfs/bafytest") {
		t.Fatalf("unexpected pin output %q", pinned)
	}

	unpinned, err := app.Unpin("/ipfs/bafytest")
	if err != nil {
		t.Fatalf("Unpin: %v", err)
	}
	if !strings.Contains(unpinned, "/ipfs/bafytest") {
		t.Fatalf("unexpected unpin output %q", unpinned)
	}

	peers, err := app.Peers()
	if err != nil {
		t.Fatalf("Peers: %v", err)
	}
	if len(peers) != 2 {
		t.Fatalf("unexpected peers %#v", peers)
	}

	gcOutput, err := app.GC()
	if err != nil {
		t.Fatalf("GC: %v", err)
	}
	if !strings.Contains(gcOutput, "removed bafygarbage") {
		t.Fatalf("unexpected GC output %q", gcOutput)
	}

	doctor := app.Doctor()
	if !doctor.KuboAvailable || !doctor.ConfigPresent || !doctor.RepoPresent {
		t.Fatalf("unexpected doctor report %+v", doctor)
	}
}

func TestInitIsNotRepeated(t *testing.T) {
	app := newTestApp(t)
	if _, err := app.Init("100GB"); err != nil {
		t.Fatal(err)
	}
	if _, err := app.Init("100GB"); err == nil {
		t.Fatal("expected second init to fail")
	}
}
