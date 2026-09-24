# 13xfile

13xfile is being rebuilt as a decentralized encrypted storage network.

## Current implementation status

Only the storage peer is being implemented right now:

```text
13xfile/
├── node/
└── docs/
```

The desktop and mobile clients are intentionally deferred until the node/data-plane prototype is proven.

## First milestone

`13xfile-node` is a headless installable Go binary that turns a machine into a storage peer. The v0.1 implementation uses an isolated Kubo repo as the IPFS data plane and self-manages a pinned, checksum-verified Kubo runtime on Windows, Linux, and macOS.

The current prototype lets independent machines:

1. initialize stable peer identities,
2. join IPFS/libp2p,
3. reserve a bounded amount of disk,
4. pin and retrieve 13xfile CIDs,
5. run an embedded browser mechanics demo for upload/list/download/share,
6. synchronize a demo vault file list through a signed IPNS manifest,
7. automatically replicate CIDs learned from that manifest,
8. remain usable without any 13xfile-owned central API or database.

The web demo is deliberately temporary protocol scaffolding, not the final desktop product. File encryption and the production multi-writer metadata protocol are still pending.

See `node/README.md`.
