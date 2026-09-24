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

## Requirements for v0.1

Kubo must currently be installed separately and available as `ipfs`, or its executable path must be supplied through `KUBO_BIN`.

This dependency is intentional for the prototype. Once the 13xfile storage protocol is proven, we can either bundle a known Kubo release with the node installer or migrate the data plane into the Go binary using Boxo/go-libp2p.

## Cross-platform quick start

From inside the `node/` folder, Linux, Windows, and macOS can all use the same command:

```bash
go run start.go
```

This launches the already-initialized node in the foreground and enables Kubo garbage collection. Press `Ctrl+C` to stop it.

The node still needs to be initialized once first:

```bash
go run ./cmd/13xfile-node init --storage 10GB
```

## Build

```bash
go test ./...
go build -o 13xfile-node ./cmd/13xfile-node
```

## Usage

```bash
13xfile-node doctor
13xfile-node init --storage 500GB
13xfile-node start
```

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
└── ipfs/
```

Override the base directory with `THIRTEENXFILE_NODE_HOME`. This is useful for testing or running multiple isolated nodes.
