# Architecture

```text
Recovery seed (256-bit)
        |
        +-- HKDF("ipns-ed25519") --> deterministic Ed25519 private key
        |                              |
        |                              +--> stable IPNS vault name
        |
        +-- HKDF("vault-key") ------> AES-256 vault key

Stable IPNS name
        |
        v
encrypted manifest CID
        |
        +-- logical file UUID
        +-- filename / size / hash
        +-- encrypted file CID
        +-- per-file AES key
        +-- AES-GCM IV/tag

encrypted file CID
        |
        v
IPFS / Kubo provider network
```

CIDs are never used as logical file IDs. A file keeps a UUID across versions; each content version gets a new CID.

## Components

### desktop

The v0.1 desktop component is a CLI so protocol work can be validated before a GUI is built. It talks only to the local Kubo RPC API.

### node

The v0.1 node binary is a small Go control/supervisor layer around Kubo. Kubo remains the mature IPFS networking runtime while 13xfile's replication protocol is still being proven. The node can initialize its own IPFS repo, start the daemon, report status, and pin/unpin CIDs.

A later node version can replace the external Kubo dependency with Boxo/go-libp2p while retaining the same 13xfile protocol.

### mobile

Mobile will be a light/opportunistic peer. It will share identity/protocol semantics but will not be relied upon as an always-on durability peer.
