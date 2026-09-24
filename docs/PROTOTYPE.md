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

1. install Kubo and `13xfile-node`,
2. initialize each node,
3. start the peers,
4. add/pin encrypted test content,
5. verify another node can fetch and retain it,
6. disconnect the original source,
7. verify the retained peer can still provide the CID.

No 13xfile-owned central API, SQL database, Firebase project, or S3/object-store is allowed in the path.

## Later phases

Only after Phase 1 is proven:

- desktop vault client
- recovery/master-key identity
- encrypted manifest/IPNS discovery
- automatic replication protocol
- multi-device metadata/CRDT
- mobile light peer
