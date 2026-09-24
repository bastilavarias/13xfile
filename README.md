# 13xfile

13xfile is being rebuilt as a decentralized encrypted storage network.

## Current prototype

```text
13xfile/
├── node/       headless storage peer + web mechanics demo
├── desktop/    standalone desktop client
└── docs/
```

There is no 13xfile-owned central API or database in the current architecture.

## Headless node

`13xfile-node` turns a server or computer into a storage peer. It self-manages a pinned, checksum-verified Kubo runtime and keeps an isolated IPFS repo.

Current node capabilities include:

- stable peer identity
- IPFS/libp2p connectivity
- bounded local storage
- pin/unpin/GC/status
- decentralized demo vault metadata through IPNS
- automatic pinning of file CIDs learned from the vault
- embedded web mechanics demo

See `node/README.md`.

## Desktop prototype

`/desktop` is the first standalone client experience. It owns its own node lifecycle rather than requiring a separately launched `13xfile-node`.

Current desktop capabilities include:

- Wails v3 native desktop shell
- React + TypeScript + Tailwind + shadcn-style UI
- system tray and close-to-background behavior
- multiple drag/drop uploads
- concurrent transfer queue + mini transfer tray
- public files
- private files encrypted locally before IPFS with chunked AES-256-GCM
- decentralized vault file-list sync
- automatic local replication of learned CIDs
- public/private `13xfile://share/...` descriptors
- static HTTPS one-click sharing for public files with selectable public-IPFS mirror origins
- private link decryption capability inside the desktop client
- no central 13xfile API/database

See `desktop/README.md`.

## Prototype limitations

The current IPNS shared-manifest design is intentionally temporary. It proves decentralized file discovery and synchronization but is not the final multi-writer metadata architecture. The intended production direction is a signed append-only operation log / CRDT.

The protocol also does not yet have durable replication acknowledgements, so the clients must not claim an exact replica count until peers can explicitly prove they completed storage.

Mobile remains deferred until the desktop/node protocol is stable.
