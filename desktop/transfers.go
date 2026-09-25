package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type transferJob struct {
	ID         string `json:"id"`
	Path       string `json:"path"`
	Visibility string `json:"visibility"`
	Staged     bool   `json:"staged"`
}

type transferJournalEntry struct {
	Item Transfer    `json:"item"`
	Job  transferJob `json:"job"`
}

type transferJournal struct {
	Version int                    `json:"version"`
	Paused  bool                   `json:"paused"`
	Entries []transferJournalEntry `json:"entries"`
}

type TransferManager struct {
	ctx    context.Context
	engine *DesktopEngine

	queue chan transferJob
	wg    sync.WaitGroup

	mu          sync.RWMutex
	items       map[string]*Transfer
	jobs        map[string]transferJob
	cancel      map[string]context.CancelFunc
	paused      bool
	closed      bool
	started     bool
	workers     int
	journalPath string
}

func newTransferManager(ctx context.Context, engine *DesktopEngine, workers int) *TransferManager {
	if workers < 1 {
		workers = 1
	}
	manager := &TransferManager{
		ctx:         ctx,
		engine:      engine,
		queue:       make(chan transferJob, 256),
		items:       make(map[string]*Transfer),
		jobs:        make(map[string]transferJob),
		cancel:      make(map[string]context.CancelFunc),
		workers:     workers,
		journalPath: filepath.Join(engine.home, "transfers.json"),
	}
	manager.loadJournal()
	return manager
}

func (m *TransferManager) Start() {
	m.mu.Lock()
	if m.started || m.closed {
		m.mu.Unlock()
		return
	}
	m.started = true
	var recoverJobs []transferJob
	for id, item := range m.items {
		if item.Status != "queued" && item.Status != "running" {
			continue
		}
		job, ok := m.jobs[id]
		if !ok {
			item.Status = "failed"
			item.Stage = "Failed"
			item.Error = "transfer journal is missing source information"
			continue
		}
		if _, err := os.Stat(job.Path); err != nil {
			item.Status = "failed"
			item.Stage = "Failed"
			item.Error = "source is no longer available after restart"
			continue
		}
		item.Status = "queued"
		item.Stage = "Queued after restart"
		item.Progress = 0
		item.Error = ""
		item.UpdatedAt = time.Now().UTC()
		recoverJobs = append(recoverJobs, job)
	}
	_ = m.persistLocked()
	m.wg.Add(m.workers)
	for i := 0; i < m.workers; i++ {
		go m.worker()
	}
	m.mu.Unlock()

	for _, job := range recoverJobs {
		m.queue <- job
	}
}

func (m *TransferManager) loadJournal() {
	raw, err := os.ReadFile(m.journalPath)
	if err != nil {
		return
	}
	var journal transferJournal
	if json.Unmarshal(raw, &journal) != nil || journal.Version != 1 {
		return
	}
	m.paused = journal.Paused
	for _, entry := range journal.Entries {
		item := entry.Item
		job := entry.Job
		if item.ID == "" || job.ID == "" || item.ID != job.ID {
			continue
		}
		item.SourcePath = job.Path
		item.Staged = job.Staged
		copyItem := item
		m.items[item.ID] = &copyItem
		m.jobs[item.ID] = job
	}
}

func (m *TransferManager) persistLocked() error {
	journal := transferJournal{
		Version: 1,
		Paused:  m.paused,
		Entries: make([]transferJournalEntry, 0, len(m.items)),
	}
	items := make([]*Transfer, 0, len(m.items))
	for _, item := range m.items {
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	if len(items) > 100 {
		items = items[:100]
	}
	for _, item := range items {
		job, ok := m.jobs[item.ID]
		if !ok {
			continue
		}
		copyItem := *item
		copyItem.SourcePath = ""
		copyItem.Staged = false
		journal.Entries = append(journal.Entries, transferJournalEntry{Item: copyItem, Job: job})
	}
	raw, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(m.journalPath), 0o700); err != nil {
		return err
	}
	tmp := m.journalPath + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, m.journalPath)
}

func (m *TransferManager) Close() {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	for _, cancel := range m.cancel {
		cancel()
	}
	_ = m.persistLocked()
	m.mu.Unlock()
}

func (m *TransferManager) QueuePaths(paths []string, visibility string, staged bool) ([]Transfer, error) {
	visibility = strings.ToLower(strings.TrimSpace(visibility))
	if visibility != "public" && visibility != "private" {
		return nil, errors.New("visibility must be public or private")
	}
	var added []Transfer
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		info, err := os.Stat(path)
		if err != nil {
			return added, err
		}
		if info.IsDir() {
			continue
		}

		id, err := randomTransferID()
		if err != nil {
			return added, err
		}
		now := time.Now().UTC()
		item := &Transfer{
			ID:         id,
			Name:       filepath.Base(path),
			SourcePath: path,
			Size:       info.Size(),
			Visibility: visibility,
			Status:     "queued",
			Stage:      "Queued",
			Progress:   0,
			CreatedAt:  now,
			UpdatedAt:  now,
			Staged:     staged,
		}
		job := transferJob{ID: id, Path: path, Visibility: visibility, Staged: staged}

		m.mu.Lock()
		m.items[id] = item
		m.jobs[id] = job
		_ = m.persistLocked()
		m.mu.Unlock()

		added = append(added, *item)
		m.queue <- job
	}
	m.engine.notifyProgress()
	return added, nil
}

func (m *TransferManager) Retry(id string) error {
	m.mu.Lock()
	item, ok := m.items[id]
	job, jobOK := m.jobs[id]
	if !ok || !jobOK {
		m.mu.Unlock()
		return os.ErrNotExist
	}
	if item.Status != "failed" && item.Status != "cancelled" {
		m.mu.Unlock()
		return errors.New("transfer is not retryable")
	}
	if _, err := os.Stat(job.Path); err != nil {
		m.mu.Unlock()
		return fmt.Errorf("source is no longer available: %w", err)
	}
	item.Status = "queued"
	item.Stage = "Queued"
	item.Progress = 0
	item.Error = ""
	item.UpdatedAt = time.Now().UTC()
	_ = m.persistLocked()
	m.mu.Unlock()

	m.queue <- job
	m.engine.notifyProgress()
	return nil
}

func (m *TransferManager) Cancel(id string) error {
	m.mu.Lock()
	item, ok := m.items[id]
	if !ok {
		m.mu.Unlock()
		return os.ErrNotExist
	}
	if item.Status == "complete" || item.Status == "failed" || item.Status == "cancelled" {
		m.mu.Unlock()
		return nil
	}
	if cancel := m.cancel[id]; cancel != nil {
		cancel()
	}
	item.Status = "cancelled"
	item.Stage = "Cancelled"
	item.Error = ""
	item.UpdatedAt = time.Now().UTC()
	_ = m.persistLocked()
	m.mu.Unlock()
	m.engine.notifyProgress()
	return nil
}

func (m *TransferManager) Remove(id string) error {
	m.mu.Lock()
	item, ok := m.items[id]
	job, jobOK := m.jobs[id]
	if !ok {
		m.mu.Unlock()
		return os.ErrNotExist
	}
	if item.Status == "queued" || item.Status == "running" {
		m.mu.Unlock()
		return errors.New("active transfer must be cancelled before removal")
	}

	delete(m.items, id)
	delete(m.jobs, id)
	delete(m.cancel, id)
	err := m.persistLocked()
	m.mu.Unlock()

	if jobOK && job.Staged {
		_ = os.Remove(job.Path)
		_ = os.Remove(filepath.Dir(job.Path))
	}
	m.engine.notifyProgress()
	return err
}

func (m *TransferManager) SetPaused(paused bool) {
	m.mu.Lock()
	m.paused = paused
	_ = m.persistLocked()
	m.mu.Unlock()
	m.engine.notifyProgress()
}

func (m *TransferManager) waitWhilePaused(ctx context.Context) error {
	for {
		m.mu.RLock()
		paused := m.paused
		m.mu.RUnlock()
		if !paused {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
}

func (m *TransferManager) List() []Transfer {
	m.mu.RLock()
	items := make([]Transfer, 0, len(m.items))
	for _, item := range m.items {
		items = append(items, *item)
	}
	m.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	return items
}

func (m *TransferManager) Aggregate() (active int, progress int, summary string) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	total := 0
	for _, item := range m.items {
		switch item.Status {
		case "queued", "running":
			active++
			total += item.Progress
		}
	}
	if active > 0 {
		progress = total / active
		summary = fmt.Sprintf("%d transfer", active)
		if active != 1 {
			summary += "s"
		}
		if m.paused {
			summary += " paused"
		}
		return
	}
	summary = "Node online"
	return
}

func (m *TransferManager) worker() {
	defer m.wg.Done()
	for {
		select {
		case <-m.ctx.Done():
			return
		case job := <-m.queue:
			m.process(job)
		}
	}
}

func (m *TransferManager) process(job transferJob) {
	m.mu.RLock()
	current := m.items[job.ID]
	if current == nil || current.Status == "cancelled" {
		m.mu.RUnlock()
		return
	}
	m.mu.RUnlock()

	ctx, cancel := context.WithCancel(m.ctx)
	m.mu.Lock()
	m.cancel[job.ID] = cancel
	m.mu.Unlock()
	defer func() {
		cancel()
		m.mu.Lock()
		delete(m.cancel, job.ID)
		m.mu.Unlock()
	}()

	if err := m.waitWhilePaused(ctx); err != nil {
		m.failOrCancel(job.ID, err)
		return
	}

	info, err := os.Stat(job.Path)
	if err != nil {
		m.fail(job.ID, err)
		return
	}

	fileID, err := randomTransferID()
	if err != nil {
		m.fail(job.ID, err)
		return
	}

	m.update(job.ID, "running", "Preparing", 3, "")
	source := job.Path
	cipherName := ""
	keyWrap := ""
	var encryptedPath string

	if job.Visibility == "private" {
		code, err := m.engine.vaultCode()
		if err != nil {
			m.fail(job.ID, err)
			return
		}
		if err := m.waitWhilePaused(ctx); err != nil {
			m.failOrCancel(job.ID, err)
			return
		}

		if err := os.MkdirAll(filepath.Join(m.engine.home, "tmp"), 0o700); err != nil {
			m.fail(job.ID, err)
			return
		}
		encryptedPath = filepath.Join(m.engine.home, "tmp", fileID+".13xenc")
		key, err := generateFileKey()
		if err != nil {
			m.fail(job.ID, err)
			return
		}
		keyWrap, err = wrapFileKey(code, fileID, key)
		if err != nil {
			m.fail(job.ID, err)
			return
		}
		cipherName = privateCipherName
		m.update(job.ID, "running", "Encrypting", 5, "")
		err = encryptFile(ctx, job.Path, encryptedPath, key, m.waitWhilePaused, func(done, total int64) {
			if total <= 0 {
				return
			}
			pct := 5 + int(float64(done)/float64(total)*50)
			if pct > 55 {
				pct = 55
			}
			m.update(job.ID, "running", "Encrypting", pct, "")
		})
		if err != nil {
			m.failOrCancel(job.ID, err)
			return
		}
		defer os.Remove(encryptedPath)
		source = encryptedPath
	} else {
		m.update(job.ID, "running", "Preparing", 20, "")
	}

	if err := m.waitWhilePaused(ctx); err != nil {
		m.failOrCancel(job.ID, err)
		return
	}
	m.update(job.ID, "running", "Adding to IPFS", 65, "")
	cid, err := m.engine.addToIPFS(ctx, source)
	if err != nil {
		m.failOrCancel(job.ID, err)
		return
	}
	m.updateCID(job.ID, cid)
	m.update(job.ID, "running", "Publishing metadata", 88, "")

	mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(info.Name())))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	register := map[string]any{
		"id":         fileID,
		"name":       info.Name(),
		"cid":        cid,
		"size":       info.Size(),
		"mime":       mimeType,
		"visibility": job.Visibility,
		"cipher":     cipherName,
		"keyWrap":    keyWrap,
	}
	payload, _ := json.Marshal(register)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://"+vaultAPIAddr()+"/api/register", bytes.NewReader(payload))
	if err != nil {
		m.fail(job.ID, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 55 * time.Second}).Do(req)
	if err != nil {
		m.failOrCancel(job.ID, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		m.fail(job.ID, fmt.Errorf("publish metadata: HTTP %s", resp.Status))
		return
	}

	m.update(job.ID, "complete", "Stored & announced", 100, "")

	if job.Staged {
		_ = os.Remove(job.Path)
		_ = os.Remove(filepath.Dir(job.Path))
	}
}

func (m *TransferManager) update(id, status, stage string, progress int, message string) {
	m.mu.Lock()
	if item := m.items[id]; item != nil {
		if item.Status == "cancelled" {
			m.mu.Unlock()
			return
		}
		oldStatus := item.Status
		oldStage := item.Stage
		oldProgress := item.Progress
		item.Status = status
		item.Stage = stage
		item.Progress = progress
		item.Error = message
		item.UpdatedAt = time.Now().UTC()
		if oldStatus != status || oldStage != stage || progress == 100 || progress >= oldProgress+5 {
			_ = m.persistLocked()
		}
	}
	m.mu.Unlock()
	m.engine.notifyProgress()
}

func (m *TransferManager) updateCID(id, cid string) {
	m.mu.Lock()
	if item := m.items[id]; item != nil {
		item.CID = cid
		item.UpdatedAt = time.Now().UTC()
		_ = m.persistLocked()
	}
	m.mu.Unlock()
}

func (m *TransferManager) fail(id string, err error) {
	if err == nil {
		return
	}
	m.update(id, "failed", "Failed", 0, err.Error())
}

func (m *TransferManager) failOrCancel(id string, err error) {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		m.mu.RLock()
		item := m.items[id]
		cancelled := item != nil && item.Status == "cancelled"
		m.mu.RUnlock()
		if cancelled {
			return
		}
	}
	m.fail(id, err)
}

func randomTransferID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw[:]), nil
}
