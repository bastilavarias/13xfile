package main

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

type store struct {
	db *sql.DB
}

func newStore(db *sql.DB) *store {
	return &store{db: db}
}

func (s *store) migrate() error {
	statements := []string{
		"PRAGMA journal_mode=WAL",
		"CREATE TABLE IF NOT EXISTS feed_entries (" +
			"metadata_cid TEXT PRIMARY KEY," +
			"file_id TEXT NOT NULL DEFAULT ''," +
			"file_cid TEXT NOT NULL," +
			"file_name TEXT NOT NULL," +
			"file_size INTEGER NOT NULL," +
			"mime TEXT NOT NULL," +
			"visibility TEXT NOT NULL," +
			"published_at TEXT NOT NULL," +
			"publisher_device_id TEXT NOT NULL DEFAULT ''," +
			"publisher_peer_id TEXT NOT NULL DEFAULT ''," +
			"signature TEXT NOT NULL DEFAULT ''," +
			"hidden INTEGER NOT NULL DEFAULT 0," +
			"created_at TEXT NOT NULL" +
			")",
		"CREATE INDEX IF NOT EXISTS idx_feed_published_at ON feed_entries(published_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_feed_name ON feed_entries(file_name)",
		"CREATE INDEX IF NOT EXISTS idx_feed_mime ON feed_entries(mime)",
		"CREATE TABLE IF NOT EXISTS feed_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
	}
	for _, statement := range statements {
		if _, err := s.db.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

func (s *store) upsert(input submission) error {
	entry := input.Entry
	if entry.PublishedAt.IsZero() {
		entry.PublishedAt = time.Now().UTC()
	}
	_, err := s.db.Exec(
		"INSERT INTO feed_entries ("+
			"metadata_cid,file_id,file_cid,file_name,file_size,mime,visibility,published_at,"+
			"publisher_device_id,publisher_peer_id,signature,created_at"+
			") VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "+
			"ON CONFLICT(metadata_cid) DO UPDATE SET "+
			"file_id=excluded.file_id,file_cid=excluded.file_cid,file_name=excluded.file_name,"+
			"file_size=excluded.file_size,mime=excluded.mime,visibility=excluded.visibility,"+
			"published_at=excluded.published_at,publisher_device_id=excluded.publisher_device_id,"+
			"publisher_peer_id=excluded.publisher_peer_id,signature=excluded.signature",
		input.MetadataCID,
		entry.File.ID,
		entry.File.CID,
		entry.File.Name,
		entry.File.Size,
		entry.File.MIME,
		entry.File.Visibility,
		entry.PublishedAt.UTC().Format(time.RFC3339Nano),
		entry.Publisher.DeviceID,
		entry.Publisher.PeerID,
		entry.Signature,
		time.Now().UTC().Format(time.RFC3339Nano),
	)
	return err
}

func (s *store) list(query, category, sortName string, page, limit int) ([]feedItem, int, error) {
	where := []string{"hidden = 0"}
	args := []any{}

	if query != "" {
		where = append(where, "(file_name LIKE ? OR file_cid LIKE ?)")
		needle := "%" + query + "%"
		args = append(args, needle, needle)
	}

	if clause, values := categoryClause(category); clause != "" {
		where = append(where, clause)
		args = append(args, values...)
	}

	whereSQL := strings.Join(where, " AND ")
	var total int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM feed_entries WHERE "+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	rows, err := s.db.Query(
		"SELECT metadata_cid,file_id,file_cid,file_name,file_size,mime,visibility,published_at,"+
			"publisher_device_id,publisher_peer_id,signature "+
			"FROM feed_entries WHERE "+whereSQL+" ORDER BY "+sortClause(sortName)+" LIMIT ? OFFSET ?",
		append(args, limit, offset)...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]feedItem, 0, limit)
	for rows.Next() {
		item, err := scanFeedItem(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *store) get(metadataCID string) (feedItem, error) {
	row := s.db.QueryRow(
		"SELECT metadata_cid,file_id,file_cid,file_name,file_size,mime,visibility,published_at,"+
			"publisher_device_id,publisher_peer_id,signature "+
			"FROM feed_entries WHERE metadata_cid = ? AND hidden = 0",
		metadataCID,
	)
	return scanFeedItem(row)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanFeedItem(row scanner) (feedItem, error) {
	var item feedItem
	var published string
	err := row.Scan(
		&item.MetadataCID,
		&item.Entry.File.ID,
		&item.Entry.File.CID,
		&item.Entry.File.Name,
		&item.Entry.File.Size,
		&item.Entry.File.MIME,
		&item.Entry.File.Visibility,
		&published,
		&item.Entry.Publisher.DeviceID,
		&item.Entry.Publisher.PeerID,
		&item.Entry.Signature,
	)
	if err != nil {
		return feedItem{}, err
	}
	item.Entry.Version = 1
	item.Entry.Type = "13xfile.feed.entry"
	item.Entry.PublishedAt, _ = time.Parse(time.RFC3339Nano, published)
	return item, nil
}

func (s *store) state(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM feed_state WHERE key = ?", key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return value, err
}

func (s *store) setState(key, value string) error {
	_, err := s.db.Exec(
		"INSERT INTO feed_state(key,value) VALUES(?,?) "+
			"ON CONFLICT(key) DO UPDATE SET value=excluded.value",
		key,
		value,
	)
	return err
}

func categoryClause(category string) (string, []any) {
	switch category {
	case "images":
		return "mime LIKE ?", []any{"image/%"}
	case "video":
		return "mime LIKE ?", []any{"video/%"}
	case "audio":
		return "mime LIKE ?", []any{"audio/%"}
	case "documents":
		return "(mime LIKE ? OR mime = ? OR mime LIKE ?)", []any{"text/%", "application/pdf", "application/%document%"}
	case "archives":
		return "(mime LIKE ? OR mime LIKE ? OR mime LIKE ?)", []any{"%zip%", "%tar%", "%compressed%"}
	case "", "all":
		return "", nil
	default:
		return "1 = 0", nil
	}
}

func sortClause(sortName string) string {
	switch sortName {
	case "oldest":
		return "published_at ASC"
	case "name":
		return "LOWER(file_name) ASC, published_at DESC"
	case "size":
		return "file_size DESC, published_at DESC"
	default:
		return "published_at DESC"
	}
}

func validateSubmission(input submission) error {
	if !looksLikeCID(input.MetadataCID) {
		return errors.New("metadataCid is invalid")
	}
	if input.Entry.Version != 1 || input.Entry.Type != "13xfile.feed.entry" {
		return errors.New("unsupported feed entry")
	}
	if input.Entry.File.Visibility != "public" {
		return errors.New("only public files can be submitted to the feed")
	}
	if !looksLikeCID(input.Entry.File.CID) {
		return errors.New("file CID is invalid")
	}
	name := strings.TrimSpace(input.Entry.File.Name)
	if name == "" || len(name) > 512 {
		return errors.New("file name is invalid")
	}
	if input.Entry.File.Size < 0 {
		return errors.New("file size is invalid")
	}
	if strings.TrimSpace(input.Entry.File.MIME) == "" {
		return errors.New("file MIME is required")
	}
	return nil
}

func looksLikeCID(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) < 10 || len(value) > 256 {
		return false
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}
		return false
	}
	return true
}

func clampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
