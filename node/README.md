# 13xfile Node

`13xfile-node` is the first implemented component of 13xfile.

It is a headless Go binary that turns a machine into a dedicated 13xfile storage peer. The v0.1 prototype deliberately uses a dedicated Kubo repository instead of reimplementing IPFS networking. Kubo remains the data plane; `13xfile-node` owns the node lifecycle and 13xfile-specific operational behavior.

## Current responsibilities

- create an isolated Kubo repository at `~/.13xfile-node/ipfs`
- generate the peer's native Ed25519 Kubo identity
- bind the Kubo RPC API to localhost only
- configure a storage ceiling for Kubo garbage collection
- run Kubo as the foreground network process
- report peer/repository health
- pin and unpin 13xfile CIDs
- list connected peers
- manually run repository GC

The RPC API binds to an ephemeral port on `127.0.0.1` and is never exposed publicly. Never expose Kubo's administrative RPC API directly to the internet.

## Runtime portability

Kubo does **not** need to be installed manually. On first use, `13xfile-node` detects the current OS/CPU, downloads the pinned tested Kubo runtime, verifies its SHA-512 checksum, and stores it inside the node state directory.

Supported automatic bootstrap targets currently include Windows, Linux, and macOS on amd64/arm64.

`KUBO_BIN` is still supported as an explicit override for development or advanced deployments.

The prototype intentionally keeps Kubo as the IPFS data plane. A later milestone can replace the managed runtime with Boxo/go-libp2p for a truly self-contained single-process binary.

## Cross-platform quick start

From inside the `node/` folder, Linux, Windows, and macOS can all use the same command:

```bash
go run start.go
```

That is enough on a fresh machine. First run automatically downloads/verifies Kubo, creates the peer identity, initializes the repository with a 10 GB storage ceiling, starts the node, and starts the embedded mechanics demo at `http://127.0.0.1:8787`. Press `Ctrl+C` to stop it.

Choose a different first-run storage ceiling with:

```bash
go run start.go --storage 100GB
```

### Web mechanics demo

The embedded web UI is intentionally a protocol test, not the final desktop product. It currently proves browser upload, CID creation, file-list synchronization, automatic replication, download, and share descriptors without a 13xfile-owned central API or database.

For same-LAN phone testing, explicitly listen on the LAN:

```bash
go run start.go --web-listen 0.0.0.0:8787
```

Then open `http://<computer-lan-ip>:8787` from the phone. The prototype web UI has no authentication, so do not port-forward this port or expose it to the public internet.

On first run the node generates and prints a high-entropy demo vault join code. A second node can join the same decentralized file list with:

```bash
go run start.go --vault-code <JOIN_CODE>
```

Both nodes derive the same demo vault signing identity, synchronize a signed IPNS manifest, and automatically pin file CIDs learned from that manifest. The manifest approach is deliberately temporary; the production protocol should replace multi-writer IPNS with an append-only signed operation log / CRDT.

Files in this demo are **not encrypted yet**. Use only dummy/test data.

## Build

```bash
go test ./...
go build -o 13xfile-node ./cmd/13xfile-node
```

## Usage

```bash
13xfile-node doctor
13xfile-node start --storage 100GB
# LAN web demo:
13xfile-node start --web-listen 0.0.0.0:8787
# Join another node's demo vault:
13xfile-node start --vault-code <JOIN_CODE>
```

`start --storage` only applies when the node has not been initialized yet. Existing nodes retain their configured storage ceiling.

In another terminal while the daemon is online:

```bash
13xfile-node status
13xfile-node peers
13xfile-node pin bafy...
13xfile-node unpin bafy...
13xfile-node gc
```

## State

By default:

```text
~/.13xfile-node/
├── config.json
├── ipfs/
└── runtime/
    └── kubo/
        └── 0.43.1/
            └── ipfs[.exe]
```

Override the base directory with `THIRTEENXFILE_NODE_HOME`. This is useful for testing or running multiple isolated nodes.
