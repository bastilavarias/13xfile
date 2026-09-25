# 13xfile Feed API

This folder is the centralized **discovery/indexing service** for the public 13xfile feed.

It does not store public file bytes in SQLite. Files remain on IPFS.

Accepted desktop submissions already contain an IPFS CID for their immutable metadata record. The API:

1. stores a searchable SQLite projection,
2. pins the metadata CID when a Kubo RPC is configured,
3. creates an immutable feed manifest on IPFS,
4. chains it to the previous manifest,
5. publishes the latest manifest through IPNS.

That makes the SQLite database replaceable. A future indexer can walk the IPNS manifest chain and rebuild its own searchable database.

## Run locally

```bash
cd api
go run .
```

Default address:

```text
http://127.0.0.1:8090
```

## Environment

```text
ADDR=:8090
DATABASE_PATH=./data/feed.db

# Optional but required for decentralized manifest publishing.
IPFS_RPC_URL=http://127.0.0.1:5001
FEED_IPNS_KEY=13xfile-feed
FEED_IPNS_NAME=

CORS_ORIGIN=*
```

The Kubo RPC must remain private. Do not expose its administrative API to the public internet.

Before using `FEED_IPNS_KEY=13xfile-feed`, create that key in the Kubo repo used by the API:

```bash
ipfs key gen --type=ed25519 13xfile-feed
```

## HTTP endpoints

```text
GET  /health
GET  /v1/feed
GET  /v1/feed/root
GET  /v1/feed/entries/{metadataCid}
POST /v1/feed/submissions
```

Feed query parameters:

```text
q=
category=all|images|video|audio|documents|archives
sort=latest|oldest|name|size
page=1
limit=20
```

The API intentionally indexes only `public` feed entries.

## Rebuild after database loss

If the SQLite index is lost but the IPNS feed name and Kubo node are available, rebuild it from the decentralized manifest chain:

```bash
FEED_IPNS_NAME=<k51...> IPFS_RPC_URL=http://127.0.0.1:5001 go run . reindex
```

The reindex command resolves the current IPNS root, walks every linked manifest, fetches each immutable metadata record from IPFS, and reconstructs SQLite.
