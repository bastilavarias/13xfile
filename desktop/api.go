package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (e *DesktopEngine) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeDesktopJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/api/state", e.handleState)
	mux.HandleFunc("/api/settings", e.handleSettings)
	mux.HandleFunc("/api/vault", e.handleVault)
	mux.HandleFunc("/api/uploads/paths", e.handleUploadPaths)
	mux.HandleFunc("/api/uploads/files", e.handleUploadFiles)
	mux.HandleFunc("/api/transfers/", e.handleTransferAction)
	mux.HandleFunc("/api/pause", e.handlePause)
	mux.HandleFunc("/api/files/", e.handleFileAction)
	mux.HandleFunc("/api/share/content", e.handleSharedContent)
	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if !desktopOriginAllowed(origin) {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}

		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func desktopOriginAllowed(origin string) bool {
	if origin == "" {
		// Non-browser local clients such as the app's integration tests and
		// command-line diagnostics do not send Origin.
		return true
	}

	if configured := strings.TrimSpace(os.Getenv("THIRTEENXFILE_DESKTOP_DEV_ORIGIN")); configured != "" && origin == configured {
		return true
	}

	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	switch parsed.Scheme {
	case "http", "https":
		return strings.EqualFold(parsed.Hostname(), "wails.localhost")
	case "wails":
		host := strings.ToLower(parsed.Hostname())
		return host == "wails" || host == "localhost"
	default:
		return false
	}
}

func (e *DesktopEngine) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeDesktopJSON(w, http.StatusOK, e.state())
}

func (e *DesktopEngine) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeDesktopJSON(w, http.StatusOK, e.settings.Get())
	case http.MethodPost:
		var next Settings
		if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&next); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if err := e.applySettings(next); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeDesktopJSON(w, http.StatusOK, e.settings.Get())
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (e *DesktopEngine) handleVault(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if existing := e.savedVaultCode(); existing != "" {
		if err := e.startVault(existing); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		status, err := e.vaultStatus()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		writeDesktopJSON(w, http.StatusOK, status)
		return
	}

	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := e.startVault(strings.TrimSpace(body.Code)); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	status, err := e.vaultStatus()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeDesktopJSON(w, http.StatusCreated, status)
}

func (e *DesktopEngine) handleUploadPaths(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := e.vaultCode(); err != nil {
		http.Error(w, "create or join a vault first", http.StatusConflict)
		return
	}
	var body struct {
		Paths      []string `json:"paths"`
		Visibility string   `json:"visibility"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	items, err := e.transfers.QueuePaths(body.Paths, body.Visibility, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeDesktopJSON(w, http.StatusAccepted, items)
}

func (e *DesktopEngine) handleUploadFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := e.vaultCode(); err != nil {
		http.Error(w, "create or join a vault first", http.StatusConflict)
		return
	}

	visibility := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("visibility")))
	if visibility == "" {
		visibility = "private"
	}
	if visibility != "public" && visibility != "private" {
		http.Error(w, "visibility must be public or private", http.StatusBadRequest)
		return
	}

	reader, err := r.MultipartReader()
	if err != nil {
		http.Error(w, "multipart upload required", http.StatusBadRequest)
		return
	}
	stageDir := filepath.Join(e.home, "staging")
	if err := os.MkdirAll(stageDir, 0o700); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var staged []string
	cleanup := func() {
		for _, path := range staged {
			_ = os.Remove(path)
		}
	}

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			cleanup()
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if part.FileName() == "" {
			_ = part.Close()
			continue
		}
		path, err := stageMultipartFile(stageDir, part)
		_ = part.Close()
		if err != nil {
			cleanup()
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		staged = append(staged, path)
	}
	if len(staged) == 0 {
		http.Error(w, "no files uploaded", http.StatusBadRequest)
		return
	}

	items, err := e.transfers.QueuePaths(staged, visibility, true)
	if err != nil {
		cleanup()
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeDesktopJSON(w, http.StatusAccepted, items)
}

func stageMultipartFile(stageDir string, part *multipart.Part) (string, error) {
	id, err := randomTransferID()
	if err != nil {
		return "", err
	}
	name := filepath.Base(strings.TrimSpace(part.FileName()))
	if name == "" || name == "." {
		name = "upload.bin"
	}
	dir := filepath.Join(stageDir, id)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	out, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	_, copyErr := io.Copy(out, part)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(path)
		return "", copyErr
	}
	if closeErr != nil {
		_ = os.Remove(path)
		return "", closeErr
	}
	return path, nil
}

func (e *DesktopEngine) handleTransferAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/transfers/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	id, action := parts[0], parts[1]
	var err error
	switch action {
	case "cancel":
		err = e.transfers.Cancel(id)
	case "retry":
		err = e.transfers.Retry(id)
	default:
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeDesktopJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (e *DesktopEngine) handlePause(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Paused bool `json:"paused"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	e.setPaused(body.Paused)
	writeDesktopJSON(w, http.StatusOK, map[string]any{"paused": body.Paused})
}

func (e *DesktopEngine) handleFileAction(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/files/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	file, err := e.findFile(parts[0])
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	switch parts[1] {
	case "content":
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		setDownloadHeaders(w, file.Name, file.MIME, file.Size)
		if err := e.streamVaultFile(r.Context(), file, w); err != nil {
			if !strings.Contains(err.Error(), "context canceled") {
				e.setFatal(fmt.Errorf("download %s: %w", file.Name, err))
			}
		}
	case "share":
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		appLink, webLink, err := e.shareLinks(file)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeDesktopJSON(w, http.StatusOK, map[string]any{
			"link":    appLink,
			"webLink": webLink,
		})
	case "save":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		path, err := e.saveVaultFile(r.Context(), file)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		writeDesktopJSON(w, http.StatusOK, map[string]any{"path": path})
	case "remove":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := e.removeVaultFile(r.Context(), file.ID); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		writeDesktopJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		http.NotFound(w, r)
	}
}

func (e *DesktopEngine) saveVaultFile(ctx context.Context, file VaultFile) (string, error) {
	dir := e.settings.Get().DownloadDir
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := uniqueDownloadPath(dir, file.Name)
	tmp := path + ".13xpart"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	streamErr := e.streamVaultFile(ctx, file, out)
	closeErr := out.Close()
	if streamErr != nil {
		_ = os.Remove(tmp)
		return "", streamErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return "", closeErr
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	return path, nil
}

func uniqueDownloadPath(dir, name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "" || name == "." {
		name = "13xfile-download"
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return path
	}
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	for i := 1; i < 10000; i++ {
		candidate := filepath.Join(dir, fmt.Sprintf("%s (%d)%s", base, i, ext))
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate
		}
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%d%s", base, time.Now().UnixNano(), ext))
}

func (e *DesktopEngine) removeVaultFile(ctx context.Context, id string) error {
	payload, _ := json.Marshal(map[string]string{"id": id})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://"+vaultAPIAddr()+"/api/remove", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 55 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return fmt.Errorf("remove metadata: HTTP %s: %s", resp.Status, strings.TrimSpace(string(raw)))
	}
	return nil
}

func (e *DesktopEngine) handleSharedContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	link := r.URL.Query().Get("link")
	desc, err := parseShareLink(link)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	setDownloadHeaders(w, desc.Name, desc.MIME, desc.Size)
	if err := e.streamSharedFile(r.Context(), desc, w); err != nil {
		e.setFatal(fmt.Errorf("shared download %s: %w", desc.Name, err))
	}
}

func writeDesktopJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func uniqueStagingName(name string) string {
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), filepath.Base(name))
}

var _ = uniqueStagingName
