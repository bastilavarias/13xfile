# 13xfile MVP Architecture

## Identity and vault authority

```text
Vault recovery code
      |
      +--> deterministic IPNS publishing identity (current MVP discovery)
      |
      +--> vault key-wrapping key

Each device
      |
      +--> independent Ed25519 device identity
             |
             +--> signs file.add
             +--> signs file.remove
             +--> signs replica.ack
```

The recovery code is still powerful in the MVP because it controls the shared IPNS discovery identity. Signed device operations prevent unsigned/corrupted metadata from being counted, but possession of the recovery code is effectively vault membership.

## Metadata

The mutable vault document contains an append-only set of signed device operations plus a compatibility file snapshot.

```text
IPNS vault name
      |
      v
manifest CID
      |
      +--> signed file.add operations
      +--> signed file.remove tombstones
      +--> signed replica.ack receipts
      +--> compatibility file snapshot
```

Peers verify each operation signature before merging it. Ordering is deterministic by operation timestamp then operation ID.

The shared IPNS writer remains a transitional discovery mechanism. A future version can replace it with per-device heads / CRDT discovery while preserving the signed operation format.

## File encryption

```text
random 256-bit file key
      |
      +--> chunked AES-256-GCM encrypt(file)
      |           |
      |           v
      |      encrypted IPFS CID
      |
      +--> AES-GCM wrap with vault wrapping key
                  |
                  v
              keyWrap metadata
```

Storage peers pin encrypted blocks without learning the plaintext file key.

## Replication

A CID existing in a manifest is not considered a replica.

```text
peer learns file CID
      |
      v
ipfs pin add completes
      |
      v
device signs replica.ack(file ID, CID, peer ID)
      |
      v
receipt published into vault op log
      |
      v
other devices verify signature
      |
      v
replica count increases
```

A desktop marks a file Safe only when the number of distinct verified device receipts meets its configured replication target.

## Public sharing

```text
Desktop
   |
   +--> CID + public metadata
   |
   +--> static HTTPS share descriptor in URL fragment
             |
             v
       recipient browser
             |
             +--> probes independent public IPFS gateways
             +--> selects/recommends a working origin
             +--> downloads by CID
```

The static share page has no 13xfile account/file database.

## Components

### desktop

Wails application containing the Go node supervisor, transfer journal, encryption/decryption, vault UI, tray/background lifecycle, settings, and sharing UX.

### node

Headless always-on peer used for servers and durability. It follows the same signed vault protocol and emits replica receipts.

### share

Static public-file receiver UI. Transport is isolated so direct browser P2P or community 13xfile gateways can be inserted ahead of public gateways later.

### mobile

Deferred. Mobile is expected to be an opportunistic/light peer rather than a durability peer.
