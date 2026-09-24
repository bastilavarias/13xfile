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

`13xfile-node` is a headless installable Go binary that turns a machine into a storage peer. The v0.1 implementation uses an isolated Kubo repo as the IPFS data plane.

The milestone is complete when independent machines can:

1. initialize stable peer identities,
2. join IPFS/libp2p,
3. reserve a bounded amount of disk,
4. pin encrypted 13xfile CIDs,
5. remain usable without any 13xfile-owned central API or database,
6. serve those blocks after the original uploader goes offline.

See `node/README.md`.
