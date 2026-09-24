# 13xfile

13xfile is a decentralized encrypted storage network built around content-addressed IPFS blocks, signed device metadata operations, and independent storage peers.

## MVP layout

```text
13xfile/
├── node/       headless storage peer
├── desktop/    standalone desktop application
├── share/      static public-file receiver page
└── docs/
```

There is no 13xfile-owned account server, canonical file database, or central storage API.

## MVP protocol

Each device has its own Ed25519 device identity. Vault metadata is represented as signed append-only operations such as:

- `file.add`
- `file.remove`
- `replica.ack`

A replica is counted only after a distinct device signs a receipt after completing its IPFS pin. The desktop therefore shows real `n / target` durability instead of inferring replicas from CID/provider announcements.

IPNS is still used as the mutable discovery pointer for the merged vault operation log. The current MVP retains the shared vault publishing key derived from the recovery code; replacing that final shared writer with a stronger multi-writer discovery layer remains post-MVP work.

## Private files

New private uploads use:

1. a random 256-bit per-file key;
2. chunked AES-256-GCM encryption before IPFS;
3. a vault-derived AES-GCM key-wrap around the random file key.

Storage peers only need the encrypted CID and wrapped-key metadata. They do not need the plaintext file key.

Older private files from the first prototype remain readable through the legacy deterministic-key fallback.

## Desktop MVP

The Wails desktop client owns its own node and Kubo runtime. Current features include:

- create/join vault onboarding and recovery-code reminder
- drag/drop and multi-file uploads
- three concurrent transfer workers
- persistent transfer journal and restart recovery
- Google Drive-style transfer tray
- private-by-default encrypted uploads
- signed replica receipts and configurable replication target
- file details with individual device receipts
- search
- native save-to-download-folder
- signed metadata removal/tombstones
- system tray / close-to-background behavior
- optional start-at-login
- configurable storage allocation
- public HTTPS sharing with QR codes
- selectable independent public-IPFS download mirrors
- `x13file://` app-share deep-link support
- legacy `13xfile://` link parsing
- no central 13xfile backend

See `desktop/README.md`.

## Headless node

`13xfile-node` is the always-on/server peer. It self-manages a pinned Kubo runtime, keeps an isolated IPFS repository, follows vault metadata, pins learned CIDs, and publishes signed replica receipts after successful storage.

See `node/README.md`.

## Remaining MVP limitations

- IPNS discovery still uses shared recovery-code publishing authority.
- Every joined peer currently attempts to replicate every vault file; storage placement/leases are not yet selective.
- Private browser sharing is intentionally deferred.
- Public browser sharing currently uses a temporary static-page hosting path and best-effort public IPFS gateways.
- Mobile remains deferred until the desktop/node protocol settles.
