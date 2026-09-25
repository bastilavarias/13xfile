package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type config struct {
	Addr        string
	Database    string
	IPFSRPC     string
	IPNSKey     string
	PublicIPNS  string
	AllowedCORS string
}

type server struct {
	cfg       config
	store     *store
	publisher *ipfsPublisher
}

func main() {
	cfg := loadConfig()
	if err := os.MkdirAll(filepath.Dir(cfg.Database), 0o755); err != nil {
		log.Fatal(err)
	}

	db, err := sql.Open("sqlite", cfg.Database)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	index := newStore(db)
	if err := index.migrate(); err != nil {
		log.Fatal(err)
	}

	s := &server{
		cfg:       cfg,
		store:     index,
		publisher: newIPFSPublisher(cfg.IPFSRPC, cfg.IPNSKey, index),
	}

	if len(os.Args) > 1 && os.Args[1] == "reindex" {
		if s.publisher == nil {
			log.Fatal("reindex requires IPFS_RPC_URL")
		}
		count, rootCID, err := s.publisher.rebuildIndex(context.Background(), cfg.PublicIPNS)
		if err != nil {
			log.Fatal(err)
		}
		log.Printf("rebuilt feed index from IPNS: %d records, root %s", count, rootCID)
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc("/v1/feed", s.feed)
	mux.HandleFunc("/v1/feed/root", s.root)
	mux.HandleFunc("/v1/feed/submissions", s.submissions)
	mux.HandleFunc("/v1/feed/entries/", s.entry)

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           s.cors(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("13xfile feed API listening on %s", cfg.Addr)
	if s.publisher == nil {
		log.Printf("decentralized manifest publishing disabled; set IPFS_RPC_URL")
	}
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func loadConfig() config {
	return config{
		Addr:        env("ADDR", ":8090"),
		Database:    env("DATABASE_PATH", "./data/feed.db"),
		IPFSRPC:     strings.TrimRight(strings.TrimSpace(os.Getenv("IPFS_RPC_URL")), "/"),
		IPNSKey:     env("FEED_IPNS_KEY", "13xfile-feed"),
		PublicIPNS:  strings.TrimSpace(os.Getenv("FEED_IPNS_NAME")),
		AllowedCORS: env("CORS_ORIGIN", "*"),
	}
}

func env(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"manifestWriter": s.publisher != nil,
	})
}

func (s *server) submissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var input submission
	if err := json.NewDecoder(io.LimitReader(r.Body, 256<<10)).Decode(&input); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := validateSubmission(input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Entry.PublishedAt.IsZero() {
		input.Entry.PublishedAt = time.Now().UTC()
	}
	if err := s.store.upsert(input); err != nil {
		http.Error(w, "store feed entry", http.StatusInternalServerError)
		return
	}

	manifestQueued := s.publisher != nil
	if s.publisher != nil {
		queued := input
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			manifestCID, ipnsName, err := s.publisher.publishManifest(ctx, queued)
			if err != nil {
				log.Printf("publish manifest for %s: %v", queued.MetadataCID, err)
				return
			}
			log.Printf("published feed manifest %s for metadata %s via IPNS %s", manifestCID, queued.MetadataCID, ipnsName)
		}()
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"accepted":          true,
		"metadataCid":       input.MetadataCID,
		"manifestQueued":    manifestQueued,
		"manifestPublished": false,
	})
}

func (s *server) feed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	page := clampInt(parseInt(r.URL.Query().Get("page"), 1), 1, 1_000_000)
	limit := clampInt(parseInt(r.URL.Query().Get("limit"), 20), 1, 100)
	items, total, err := s.store.list(
		strings.TrimSpace(r.URL.Query().Get("q")),
		strings.TrimSpace(r.URL.Query().Get("category")),
		strings.TrimSpace(r.URL.Query().Get("sort")),
		page,
		limit,
	)
	if err != nil {
		http.Error(w, "query feed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"page":  page,
		"limit": limit,
		"total": total,
	})
}

func (s *server) entry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cid := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/v1/feed/entries/"))
	if !looksLikeCID(cid) {
		http.Error(w, "invalid metadata CID", http.StatusBadRequest)
		return
	}
	item, err := s.store.get(cid)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "read feed entry", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *server) root(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	manifestCID, _ := s.store.state("latest_manifest_cid")
	ipnsName := s.cfg.PublicIPNS
	if stored, _ := s.store.state("ipns_name"); stored != "" {
		ipnsName = stored
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"manifestCid": manifestCID,
		"ipnsName":    ipnsName,
	})
}

func (s *server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.cfg.AllowedCORS)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func parseInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
