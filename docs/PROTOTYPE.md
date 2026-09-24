# 13xfile prototype order

13xfile is node-first.

## Phase 1 — 13xfile Node

Build and prove the headless storage peer before implementing any client.

Current node responsibilities:

- dedicated peer identity
- isolated Kubo repo
- localhost-only Kubo RPC management endpoint
- configurable storage ceiling
- foreground daemon lifecycle suitable for service managers
- peer/network status
- CID pin/unpin
- repository garbage collection

### Node acceptance test

Using two or more independent machines:

1. run `13xfile-node start` on each machine; the node self-bootstraps its pinned Kubo runtime and initializes itself on first use,
2. verify the peers join IPFS/libp2p,
3. add/pin encrypted test content,
4. verify another node can fetch and retain it,
5. disconnect the original source,
6. verify the retained peer can still provide the CID.

No 13xfile-owned central API, SQL database, Firebase project, or S3/object-store is allowed in the path.

## Later phases

Only after Phase 1 is proven:

- desktop vault client
- recovery/master-key identity
- encrypted manifest/IPNS discovery
- automatic replication protocol
- multi-device metadata/CRDT
- mobile light peer
