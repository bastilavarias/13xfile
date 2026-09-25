package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	nodeengine "github.com/13xfile/13xfile/node/internal/node"
)

func TestDesktopEndToEnd(t *testing.T) {
	if os.Getenv("THIRTEENXFILE_DESKTOP_INTEGRATION") != "1" {
		t.Skip("set THIRTEENXFILE_DESKTOP_INTEGRATION=1")
	}

	root := t.TempDir()
	nodeHome := filepath.Join(root, "node")
	kubo := os.Getenv("KUBO_BIN")
	if kubo == "" {
		t.Fatal("KUBO_BIN is required for integration test")
	}

	t.Setenv("THIRTEENXFILE_NODE_HOME", nodeHome)
	t.Setenv("THIRTEENXFILE_DESKTOP_API_ADDR", freeLoopbackAddr(t))
	t.Setenv("THIRTEENXFILE_VAULT_API_ADDR", freeLoopbackAddr(t))
	swarmAddr := freeLoopbackAddr(t)
	_, swarmPort, err := net.SplitHostPort(swarmAddr)
	if err != nil {
		t.Fatal(err)
	}

	nodeApp, err := nodeengine.New()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := nodeApp.EnsureInitialized("1GB"); err != nil {
		t.Fatal(err)
	}

	ipfsEnv := append(os.Environ(), "IPFS_PATH="+filepath.Join(nodeHome, "ipfs"))
	config := exec.Command(kubo, "config", "--json", "Addresses.Swarm", fmt.Sprintf(`[%q,%q]`, "/ip4/0.0.0.0/tcp/"+swarmPort, "/ip4/0.0.0.0/udp/"+swarmPort+"/quic-v1"))
	config.Env = ipfsEnv
	if output, err := config.CombinedOutput(); err != nil {
		t.Fatalf("configure swarm: %v: %s", err, output)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		_ = nodeApp.Start(ctx, true)
	}()
	waitUntil(t, 30*time.Second, func() bool {
		status, err := nodeApp.Status()
		return err == nil && status.Online
	})

	engine, err := newDesktopEngine(ctx, root, nodeApp)
	if err != nil {
		t.Fatal(err)
	}
	defer engine.Close()
	go engine.Run()

	waitHTTP(t, "http://"+desktopAPIAddr()+"/api/health", 10*time.Second)

	req, _ := http.NewRequest(http.MethodPost, "http://"+desktopAPIAddr()+"/api/vault", bytes.NewBufferString(`{"code":""}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("create vault: %s: %s", resp.Status, body)
	}
	resp.Body.Close()

	privateSource := filepath.Join(root, "secret.txt")
	publicSource := filepath.Join(root, "hello.txt")
	privateBytes := bytes.Repeat([]byte("PRIVATE-13XFILE\n"), 20000)
	publicBytes := []byte("PUBLIC-13XFILE\n")
	if err := os.WriteFile(privateSource, privateBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(publicSource, publicBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	postJSON(t, "/uploads/paths", map[string]any{"paths": []string{privateSource}, "visibility": "private"})
	postJSON(t, "/uploads/paths", map[string]any{"paths": []string{publicSource}, "visibility": "public"})

	var state AppState
	waitUntil(t, 90*time.Second, func() bool {
		response, err := http.Get("http://" + desktopAPIAddr() + "/api/state")
		if err != nil {
			return false
		}
		defer response.Body.Close()
		if json.NewDecoder(response.Body).Decode(&state) != nil {
			return false
		}
		if len(state.Transfers) < 2 {
			return false
		}
		for _, transfer := range state.Transfers {
			if transfer.Status == "failed" {
				t.Fatalf("transfer failed: %s: %s", transfer.Name, transfer.Error)
			}
			if transfer.Status != "complete" {
				return false
			}
		}
		return state.Vault != nil && len(state.Vault.Files) >= 2
	})

	var privateFile *VaultFile
	for i := range state.Vault.Files {
		if state.Vault.Files[i].Name == "secret.txt" {
			privateFile = &state.Vault.Files[i]
			break
		}
	}
	if privateFile == nil {
		t.Fatal("private file not found in vault")
	}
	if privateFile.Visibility != "private" || privateFile.Cipher != privateCipherName {
		t.Fatalf("unexpected private metadata: %#v", privateFile)
	}
	if privateFile.KeyWrap == "" {
		t.Fatal("private file is missing wrapped random file key")
	}
	if privateFile.ReplicaCount < 1 || len(privateFile.Replicas) < 1 {
		t.Fatalf("expected signed local replica receipt, got %#v", privateFile.Replicas)
	}
	if state.Vault.DeviceID == "" {
		t.Fatal("vault status is missing device identity")
	}

	download, err := http.Get("http://" + desktopAPIAddr() + "/api/files/" + privateFile.ID + "/content")
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(download.Body)
	download.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, privateBytes) {
		t.Fatalf("private download mismatch: got %d bytes want %d", len(got), len(privateBytes))
	}

	shareResponse, err := http.Get("http://" + desktopAPIAddr() + "/api/files/" + privateFile.ID + "/share")
	if err != nil {
		t.Fatal(err)
	}
	var sharePayload struct {
		Link string `json:"link"`
	}
	if err := json.NewDecoder(shareResponse.Body).Decode(&sharePayload); err != nil {
		shareResponse.Body.Close()
		t.Fatal(err)
	}
	shareResponse.Body.Close()
	if _, err := parseShareLink(sharePayload.Link); err != nil {
		t.Fatalf("parse generated private share link: %v", err)
	}

	sharedDownload, err := http.Get("http://" + desktopAPIAddr() + "/api/share/content?link=" + url.QueryEscape(sharePayload.Link))
	if err != nil {
		t.Fatal(err)
	}
	sharedBytes, err := io.ReadAll(sharedDownload.Body)
	sharedDownload.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(sharedBytes, privateBytes) {
		t.Fatalf("private shared download mismatch: got %d bytes want %d", len(sharedBytes), len(privateBytes))
	}
}

func freeLoopbackAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return listener.Addr().String()
}

func postJSON(t *testing.T, path string, body any) {
	t.Helper()
	data, _ := json.Marshal(body)
	resp, err := http.Post("http://"+desktopAPIAddr()+"/api"+path, "application/json", bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("%s: %s: %s", path, resp.Status, raw)
	}
}

func waitHTTP(t *testing.T, url string, timeout time.Duration) {
	t.Helper()
	waitUntil(t, timeout, func() bool {
		resp, err := http.Get(url)
		if err != nil {
			return false
		}
		resp.Body.Close()
		return resp.StatusCode == http.StatusOK
	})
}

func waitUntil(t *testing.T, timeout time.Duration, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if check() {
			return
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatal("timed out waiting for condition")
}
