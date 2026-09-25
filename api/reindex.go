package main

import (
	"context"
	"fmt"
	"strings"
)

func (p *ipfsPublisher) rebuildIndex(ctx context.Context, ipnsName string) (int, string, error) {
	ipnsName = strings.TrimSpace(ipnsName)
	if ipnsName == "" {
		return 0, "", fmt.Errorf("FEED_IPNS_NAME is required")
	}

	rootCID, err := p.resolveIPNS(ctx, ipnsName)
	if err != nil {
		return 0, "", err
	}

	seen := map[string]struct{}{}
	current := rootCID
	count := 0

	for current != "" {
		if _, exists := seen[current]; exists {
			return count, rootCID, fmt.Errorf("manifest loop detected at %s", current)
		}
		seen[current] = struct{}{}

		var m manifest
		if err := p.cat(ctx, "/ipfs/"+current, &m); err != nil {
			return count, rootCID, fmt.Errorf("read manifest %s: %w", current, err)
		}
		if m.Version != 1 || m.Type != "13xfile.feed.manifest" {
			return count, rootCID, fmt.Errorf("unsupported manifest %s", current)
		}

		for _, metadataCID := range m.Entries {
			metadataCID = strings.TrimSpace(metadataCID)
			if !looksLikeCID(metadataCID) {
				continue
			}

			var entry feedEntry
			if err := p.cat(ctx, "/ipfs/"+metadataCID, &entry); err != nil {
				return count, rootCID, fmt.Errorf("read metadata %s: %w", metadataCID, err)
			}
			input := submission{MetadataCID: metadataCID, Entry: entry}
			if err := validateSubmission(input); err != nil {
				return count, rootCID, fmt.Errorf("invalid metadata %s: %w", metadataCID, err)
			}
			if err := p.store.upsert(input); err != nil {
				return count, rootCID, fmt.Errorf("index metadata %s: %w", metadataCID, err)
			}
			count++
		}

		current = strings.TrimSpace(m.Previous)
	}

	if err := p.store.setState("latest_manifest_cid", rootCID); err != nil {
		return count, rootCID, err
	}
	if err := p.store.setState("ipns_name", ipnsName); err != nil {
		return count, rootCID, err
	}
	return count, rootCID, nil
}
