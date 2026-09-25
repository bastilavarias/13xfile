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
	"strings"
	"sync"
	"time"
)

type ipfsPublisher struct {
	rpc     string
	ipnsKey string
	store   *store
	client  *http.Client
	mu      sync.Mutex
}

func newIPFSPublisher(rpc, ipnsKey string, store *store) *ipfsPublisher {
	rpc = strings.TrimRight(strings.TrimSpace(rpc), "/")
	if rpc == "" {
		return nil
	}
	return &ipfsPublisher{
		rpc:     rpc,
		ipnsKey: strings.TrimSpace(ipnsKey),
		store:   store,
		client:  &http.Client{Timeout: 45 * time.Second},
	}
}

func (p *ipfsPublisher) publishManifest(ctx context.Context, input submission) (string, string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	metadataRaw, err := json.Marshal(input.Entry)
	if err != nil {
		return "", "", err
	}
	metadataRaw = append(metadataRaw, '\n')

	storedMetadataCID, err := p.addJSON(ctx, "13xfile-feed-entry.json", metadataRaw)
	if err != nil {
		return "", "", fmt.Errorf("store metadata on feed IPFS: %w", err)
	}
	if storedMetadataCID != input.MetadataCID {
		return "", "", fmt.Errorf(
			"metadata CID mismatch: desktop=%s feed=%s",
			input.MetadataCID,
			storedMetadataCID,
		)
	}

	previous, err := p.store.state("latest_manifest_cid")
	if err != nil {
		return "", "", err
	}

	raw, err := json.Marshal(manifest{
		Version:   1,
		Type:      "13xfile.feed.manifest",
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Previous:  previous,
		Entries:   []string{input.MetadataCID},
	})
	if err != nil {
		return "", "", err
	}

	cid, err := p.addJSON(ctx, "13xfile-feed-manifest.json", raw)
	if err != nil {
		return "", "", err
	}
	if err := p.store.setState("latest_manifest_cid", cid); err != nil {
		return "", "", err
	}

	ipnsName := ""
	if p.ipnsKey != "" {
		ipnsName, err = p.publishIPNS(ctx, cid)
		if err != nil {
			return cid, "", fmt.Errorf("manifest stored but IPNS publish failed: %w", err)
		}
		if ipnsName != "" {
			_ = p.store.setState("ipns_name", ipnsName)
		}
	}

	return cid, ipnsName, nil
}

func (p *ipfsPublisher) addJSON(ctx context.Context, name string, raw []byte) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", name)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(raw); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		p.rpc+"/api/v0/add?pin=true&cid-version=1&quieter=true",
		&body,
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return "", fmt.Errorf("IPFS add: HTTP %s: %s", resp.Status, strings.TrimSpace(string(message)))
	}

	var result struct {
		Hash string `json:"Hash"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if !looksLikeCID(result.Hash) {
		return "", errors.New("IPFS add returned invalid CID")
	}
	return result.Hash, nil
}

func (p *ipfsPublisher) cat(ctx context.Context, path string, target any) error {
	endpoint, err := url.Parse(p.rpc + "/api/v0/cat")
	if err != nil {
		return err
	}
	query := endpoint.Query()
	query.Set("arg", path)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), nil)
	if err != nil {
		return err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return fmt.Errorf("IPFS cat: HTTP %s: %s", resp.Status, strings.TrimSpace(string(message)))
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(target)
}

func (p *ipfsPublisher) resolveIPNS(ctx context.Context, name string) (string, error) {
	endpoint, err := url.Parse(p.rpc + "/api/v0/name/resolve")
	if err != nil {
		return "", err
	}
	query := endpoint.Query()
	query.Set("arg", "/ipns/"+strings.TrimSpace(name))
	query.Set("recursive", "true")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return "", fmt.Errorf("IPNS resolve: HTTP %s: %s", resp.Status, strings.TrimSpace(string(message)))
	}
	var result struct {
		Path string `json:"Path"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	path := strings.TrimSpace(result.Path)
	if !strings.HasPrefix(path, "/ipfs/") {
		return "", fmt.Errorf("IPNS resolved to unsupported path %q", path)
	}
	return strings.TrimPrefix(path, "/ipfs/"), nil
}

func (p *ipfsPublisher) publishIPNS(ctx context.Context, cid string) (string, error) {
	endpoint, err := url.Parse(p.rpc + "/api/v0/name/publish")
	if err != nil {
		return "", err
	}
	query := endpoint.Query()
	query.Set("arg", "/ipfs/"+cid)
	query.Set("key", p.ipnsKey)
	query.Set("allow-offline", "true")
	query.Set("lifetime", "168h")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return "", fmt.Errorf("IPNS publish: HTTP %s: %s", resp.Status, strings.TrimSpace(string(message)))
	}

	var result struct {
		Name string `json:"Name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return strings.TrimSpace(result.Name), nil
}
