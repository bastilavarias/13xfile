# 13xfile — Project Context & Working Instructions

> **Purpose:** This file is the persistent working context for anyone (human or AI) making changes to 13xfile. Read it before touching the project so the user does not have to repeatedly explain the project path, architecture, workflow, branch rules, local setup, or product decisions.
>
> Treat this document as operational guidance. If the repository and this file ever disagree about implementation details, inspect the current code and update this document as part of the same successful change.

---

## 1. Project identity

**Project name:** 13xfile

13xfile is a desktop-first decentralized file storage and sharing project built around IPFS.

The core product idea is:

- actual file bytes live on IPFS rather than a central 13xfile file server;
- each desktop client is also a 13xfile/IPFS peer;
- public files can be shared through browser links;
- sensitive files can be encrypted locally before entering IPFS;
- file replication is tracked using signed device receipts;
- public discovery is provided by a feed layer;
- the feed's fast search/index can be centralized, but feed metadata and manifest history are also persisted through IPFS/IPNS so the centralized database is replaceable.

A useful one-line mental model is:

> **13xfile = decentralized storage + replaceable discovery/indexing + desktop-first UX.**

---

## 2. Canonical project location

### SEBASTECH server

The canonical working checkout on the SEBASTECH server is:

```text
/home/sebastech/projects/13xfile
```

Equivalent home-relative path:

```text
~/projects/13xfile
```

Do **not** use:

```text
/projects/13xfile
```

That root-level path is wrong on this server.

### SEBASTECH / DevSpace workflow

When using the SEBASTECH MCP/DevSpace integration:

1. Open `/home/sebastech/projects/13xfile` once if no valid workspace is already open.
2. Reuse the returned workspace ID for all work in this checkout.
3. Do not repeatedly call `open_workspace` for the same project.
4. Only open a new workspace when intentionally changing project, checkout/worktree, or when the current workspace is rejected.
5. Prefer SEBASTECH `read`, `grep`, `ls`, `glob`, `edit`, and `write` for project inspection/changes.
6. Use shell execution primarily for Git inspection, builds, tests, Docker, and commands that genuinely belong in the shell.

---

## 3. Git repository and branches

GitHub remote:

```text
git@github.com:bastilavarias/13xfile.git
```

Repository:

```text
github.com/bastilavarias/13xfile
```

### Active branches

The intended branch model is deliberately simple:

```text
main
old-2024
```

- **`main`** — active development branch and source of truth.
- **`old-2024`** — historical backup branch. Treat it as read-only unless the user explicitly asks otherwise.

The old `prototype` branch has been deleted. Do not recreate it and do not target it in code, links, workflows, or documentation.

---

## 4. Default change workflow

Unless the user explicitly asks for a different workflow, use this process for every 13xfile change.

### Before making changes

1. Confirm you are working in:
   ```text
   /home/sebastech/projects/13xfile
   ```
2. Confirm the current branch is `main`.
3. Inspect `git status`.
4. Preserve user changes. Never overwrite unrelated uncommitted work.
5. Pull the latest `main` with fast-forward only when the working tree is safe:
   ```bash
   git pull --ff-only origin main
   ```
6. Inspect the current implementation before editing. Do not rely only on memory or old conversation context.

### During implementation

- Make the smallest coherent change that fully satisfies the request.
- Keep existing working behavior unless the user asks to change it.
- Do not silently redesign protocols, persistence, encryption, or decentralization boundaries for a cosmetic request.
- Keep `web/`, `feed/`, `share/`, and `api/` separate. Do not merge them into one `web` folder.
- Use the current 13xfile visual language rather than introducing unrelated design systems.
- When touching generated desktop frontend output, remember that `desktop/frontend/dist` is committed because the Wails binary embeds it.

### Validation

Run the relevant tests/builds for the changed area before calling the work complete.

Typical validation commands:

```bash
# Desktop frontend
cd desktop/frontend
npm run build

# Desktop Windows cross-build from Linux server
cd desktop
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/13xfile-desktop.exe .

# Node
cd node
go test ./...

# Feed API
cd api
go test ./...
go build ./...

# Static JS
node --check feed/app.js
node --check feed/config.js
node --check share/app.js
node --check web/app.js

# Docker configuration
docker compose config

# Git whitespace validation
git diff --check
```

Use more specific tests when the touched code has them.

### Commit and push policy

For a successful, validated project change:

1. Commit it with a concise descriptive commit message.
2. Push it to:
   ```text
   origin/main
   ```

This is the default project behavior because the user wants successful work reflected on `main` without repeatedly asking to push.

Do **not** push:

- broken or unvalidated code;
- partial experiments the user did not approve;
- unrelated local changes;
- secrets or credentials;
- generated junk that is not intentionally tracked.

If the user explicitly says not to commit or not to push, follow that instruction.

---

## 5. Repository layout

Current high-level layout:

```text
13xfile/
├── desktop/    native desktop application
├── node/       headless storage peer / shared node engine
├── web/        main product website
├── feed/       public feed frontend
├── share/      public browser share/download page
├── api/        feed discovery/index API
├── docker/     shared Docker configuration
├── docs/       project docs and screenshots
├── compose.yaml
├── pages.cmd   Windows wrapper for Docker local stack
├── dev.cmd     Windows desktop development launcher
├── pull.cmd    Windows safe pull helper
└── README.md
```

### Important separation rule

These are intentionally separate applications/surfaces:

```text
13xfile.app        -> web/
feed.13xfile.app   -> feed/
share.13xfile.app  -> share/
api.13xfile.app    -> api/
```

Do not put feed/share/API code inside `web/`.

At the current development stage, the production subdomains are design targets; local testing is the primary supported workflow.

---

## 6. Technology stack

### Desktop

Location:

```text
desktop/
```

Stack:

- Go 1.26+
- Wails v3
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Radix/shadcn-style UI primitives
- Lucide icons
- managed Kubo/IPFS runtime

Key characteristics:

- desktop app owns its own node/runtime;
- no separately installed local IPFS daemon is required;
- first launch can bootstrap the managed Kubo binary;
- desktop UI assets are embedded from `desktop/frontend/dist`.

Desktop local state:

```text
~/.13xfile-desktop/
```

On Windows this resolves roughly to:

```text
C:\Users\<user>\.13xfile-desktop
```

### Headless node

Location:

```text
node/
```

Stack:

- Go
- managed Kubo/IPFS
- signed device/vault metadata logic
- replication receipt logic

The desktop imports/reuses the node package instead of reimplementing the protocol separately.

### Feed API

Location:

```text
api/
```

Stack:

- Go 1.24+
- `modernc.org/sqlite`
- SQLite searchable index
- Kubo RPC integration
- IPFS metadata persistence
- IPFS feed manifests
- IPNS latest-root publication

The API is a discovery/index service, **not** central file storage.

### Main website

Location:

```text
web/
```

Current implementation:

- static HTML/CSS/JavaScript
- Nginx container for local testing

Purpose:

- product homepage
- About
- How it works
- links into Feed and other 13xfile surfaces

### Feed frontend

Location:

```text
feed/
```

Current implementation:

- static HTML/CSS/JavaScript
- fast path through the feed API
- fallback support for IPNS/IPFS feed reconstruction
- search
- filtering
- sorting
- pagination

### Share page

Location:

```text
share/
```

Current implementation:

- static HTML/CSS/JavaScript
- browser-friendly public file download
- probes public IPFS gateways
- uses the file CID directly
- exposes the 13xfile app link and CID
- QR capability still exists in code but is currently hidden in UI

### Docker

Local web/feed infrastructure uses:

- Docker Compose
- Nginx for static sites
- Kubo `v0.43.1`
- feed API container
- persistent named volumes for:
  - feed SQLite data
  - feed-side IPFS repository

---

## 7. Current local service map

Start the local web/feed stack:

### Windows

```powershell
.\pages.cmd
```

### macOS / Linux

```bash
docker compose up --build
```

Local addresses:

```text
Main      http://127.0.0.1:8080/
Feed      http://127.0.0.1:8081/
Share     http://127.0.0.1:8082/
Feed API  http://127.0.0.1:8090/health
IPFS      internal Docker service
```

Important development rule:

> The desktop **Share to feed** path must use the local feed API at `http://127.0.0.1:8090` during local development.

The desktop code currently defaults to this local endpoint and still supports overriding it with:

```text
FEED_API_URL
```

Do not casually change the local default back to `https://api.13xfile.app` while that production API is not deployed.

---

## 8. Core product architecture

### 8.1 Public file upload

Simplified flow:

```text
Desktop
   |
   v
Kubo/IPFS add
   |
   v
CID
   |
   +--> vault metadata operation
   |
   +--> replication workflow
   |
   +--> optional public browser share descriptor
```

The central 13xfile feed service does not own the file bytes.

### 8.2 Encrypted upload

New encrypted/private uploads use:

1. random 256-bit per-file key;
2. chunked AES-256-GCM encryption before IPFS;
3. vault-derived AES-GCM key wrapping around the random file key.

Storage peers receive encrypted content and wrapped-key metadata. They do not require the plaintext key.

Legacy encrypted files remain readable through the earlier deterministic-key fallback.

In the UI the user-facing term is **Encrypted**. Backend compatibility may still use the `private` visibility value. Do not rename backend values casually without checking compatibility.

### 8.3 Replication

Each device has an Ed25519 identity.

A replica only counts when:

- a distinct device successfully pins the CID;
- that device signs a `replica.ack` operation;
- the device has a sufficiently recent signed heartbeat.

The UI therefore displays active durability such as:

```text
1 / 3 Replicating
2 / 3 Replicating
3 / 3 Safe
```

Do not replace this with simple provider-count logic.

### 8.4 Public browser sharing

Current desktop-generated public web share base:

```text
https://htmlpreview.github.io/?https://raw.githubusercontent.com/bastilavarias/13xfile/main/share/index.html
```

This is temporary until the real share domain is deployed.

Public share descriptors ultimately contain enough information to resolve/download the CID without a central file database.

Canonical native app deep-link scheme:

```text
x13file://
```

Legacy `13xfile://` parsing remains for backward compatibility.

### 8.5 Share to feed

When **Share to feed** is enabled for a Public upload:

```text
Desktop
  |
  +--> file bytes -> desktop IPFS -> file CID
  |
  +--> feed metadata JSON -> desktop IPFS -> metadata CID
  |
  +--> POST metadata CID + searchable projection to Feed API
                                  |
                                  +--> SQLite fast index
                                  |
                                  +--> async metadata persistence on feed-side IPFS
                                  |
                                  +--> immutable feed manifest on IPFS
                                  |
                                  +--> IPNS pointer to latest manifest
```

Only Public files can be published to the public feed.

The API acknowledges the desktop after the searchable projection is stored. Slow IPNS publication must not block the desktop upload request.

### 8.6 Feed read path

Normal fast path:

```text
feed frontend
   |
   v
Feed API
   |
   v
SQLite index
```

Decentralized/fallback concept:

```text
IPNS
  |
  v
latest feed manifest CID
  |
  v
manifest chain
  |
  v
metadata CIDs
  |
  v
IPFS metadata records
```

The central SQLite database is intended to be a replaceable searchable materialized view.

### 8.7 Rebuilding the feed index

If SQLite is lost but the IPNS feed name and feed Kubo repository remain available, the API supports rebuilding from IPFS/IPNS:

```bash
FEED_IPNS_NAME=<k51...> \
IPFS_RPC_URL=http://127.0.0.1:5001 \
go run . reindex
```

The design goal is that loss of the search database should be an operational outage, not permanent loss of feed history.

---

## 9. Decentralization boundaries

13xfile intentionally uses a hybrid architecture.

### Decentralized / independently addressable

- file bytes on IPFS
- file CIDs
- public feed metadata records on IPFS
- feed manifest history on IPFS
- latest feed root through IPNS
- device identities/signatures
- vault replication receipts

### Centralized convenience layers

- official product website
- official feed UI
- feed submission endpoint
- SQLite search/index database
- moderation/indexing policy

This is deliberate.

Do not try to force live SQL/search workloads directly into IPFS just to make every component "decentralized."

A central database is acceptable **only if it remains replaceable and is not the sole owner of critical file-addressing data**.

---

## 10. Feed API endpoints

Current feed API:

```text
GET  /health
GET  /v1/feed
GET  /v1/feed/root
GET  /v1/feed/entries/{metadataCid}
POST /v1/feed/submissions
```

Useful feed query parameters:

```text
q=
category=all|images|video|audio|documents|archives
sort=latest|oldest|name|size
page=1
limit=20
```

Do not expose the Kubo administrative RPC publicly.

---

## 11. UI and product decisions to preserve

### Desktop navigation

Current product direction favors a simpler desktop UI.

Primary desktop navigation:

- Vault
- Settings

Dedicated Transfers and Activity pages were removed.

Transfers are represented through the compact transfer drawer instead.

### Upload defaults

Current upload order/default:

1. **Public**
2. **Encrypted**

Public is the default selection.

There is an optional:

```text
Share to feed
```

checkbox for Public uploads.

If the user changes visibility to Encrypted, feed publishing must not be active.

### QR

QR generation capability remains in the codebase, but QR presentation is intentionally hidden for now.

Do not re-enable it unless requested.

### Themes

The desktop supports both light and dark themes.

Current interface screenshots are stored under:

```text
docs/images/
```

### Branding

Keep the 13xfile electric-blue visual identity and current wordmark/emblem treatment.

Avoid generic "AI dashboard" aesthetics, excessive gradients, random accent colors, or unrelated design systems.

---

## 12. Desktop transfer behavior

Transfer history is persisted.

Important consequence:

> Old failures remain visible with their original error text even after the underlying problem is fixed.

Do not interpret an old saved transfer error as evidence that a new upload is still failing.

For feed debugging, always test with a **new upload** after restarting the current desktop build.

The transfer drawer supports removing terminal history items.

---

## 13. Windows development helpers

### Pull latest changes

From repo root:

```powershell
.\pull.cmd
```

This safely fast-forwards `main` and protects real uncommitted work.

### Start Docker local stack

```powershell
.\pages.cmd
```

### Start desktop development app

```powershell
.\dev.cmd -NoPull
```

The Windows development launcher:

- uses the local feed API;
- builds the desktop frontend;
- starts the desktop app;
- prevents stale older 13xfile desktop processes from silently winning the single-instance handoff.

### Manual Windows desktop run

PowerShell:

```powershell
cd desktop
$env:FEED_API_URL="http://127.0.0.1:8090"
go run .
```

Command Prompt:

```cmd
cd desktop
set FEED_API_URL=http://127.0.0.1:8090
go run .
```

Do not mix PowerShell environment-variable syntax with `cmd.exe`.

---

## 14. macOS and Linux local development

Start Docker stack:

```bash
docker compose up --build
```

Then in another terminal:

```bash
export FEED_API_URL=http://127.0.0.1:8090
cd desktop
go run .
```

### macOS

Install Xcode Command Line Tools if needed:

```bash
xcode-select --install
```

### Linux modern GTK path

Typical Ubuntu 24.04 / newer Debian-style dependencies:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libgtk-4-dev libwebkitgtk-6.0-dev
```

### Linux legacy GTK path

Typical Ubuntu 22.04 / Debian 12-style dependencies:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
```

Run:

```bash
go run -tags gtk3 .
```

---

## 15. Docker data lifecycle

Normal shutdown:

```bash
docker compose down
```

This keeps named-volume data.

Full local feed reset:

```bash
docker compose down -v
```

This deletes the Docker-local:

- feed SQLite database;
- feed-side IPFS repository.

Do not use `down -v` casually when the user wants to preserve test feed history.

---

## 16. Files that commonly matter

### Desktop

```text
desktop/main.go
desktop/engine.go
desktop/transfers.go
desktop/api.go
desktop/feed.go
desktop/share.go
desktop/models.go
desktop/settings.go
desktop/frontend/src/App.tsx
desktop/frontend/src/index.css
desktop/frontend/dist/
```

### Shared node/protocol

```text
node/internal/node/
```

### Feed

```text
api/main.go
api/store.go
api/ipfs.go
api/reindex.go
api/models.go
feed/index.html
feed/app.js
feed/config.js
feed/style.css
```

### Public share

```text
share/index.html
share/app.js
share/gateways.js
share/style.css
```

### Product website

```text
web/index.html
web/app.js
web/style.css
```

### Local infrastructure

```text
compose.yaml
api/Dockerfile
feed/Dockerfile
share/Dockerfile
web/Dockerfile
docker/nginx-static.conf
pages.cmd
dev.cmd
dev.ps1
pull.cmd
pull.ps1
```

---

## 17. Testing expectations by change type

### Desktop UI-only change

At minimum:

```bash
cd desktop/frontend
npm run build
```

Then:

```bash
git diff --check
```

### Desktop Go/backend change

At minimum:

```bash
cd desktop
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/13xfile-desktop.exe .
```

Run desktop tests where host dependencies allow them.

### Node/protocol change

```bash
cd node
go test ./...
```

### Feed API change

```bash
cd api
go test ./...
go build ./...
```

If Docker-related:

```bash
docker compose config
docker compose build api
```

For request/response behavior, do a local smoke test against `127.0.0.1:8090` when practical.

### Static web/feed/share change

Use syntax checks where relevant:

```bash
node --check feed/app.js
node --check feed/config.js
node --check share/app.js
node --check web/app.js
```

Also build/start Docker if the change affects container serving or local routing.

### Documentation-only change

At minimum:

```bash
git diff --check
```

Verify referenced paths/images actually exist.

---

## 18. Deployment status and policy

Current work is primarily local-development/testing oriented.

Do not assume these are live production services merely because their target names exist in documentation:

```text
13xfile.app
feed.13xfile.app
share.13xfile.app
api.13xfile.app
```

When the user asks for deployment, verify the target infrastructure and current DNS/proxy setup first.

Until deployment is explicitly requested:

- do not silently change local development URLs to production domains;
- do not expose Kubo admin RPC publicly;
- do not claim a production service is live;
- keep local Docker testing working.

---

## 19. Security / privacy rules

- Never commit API keys, tokens, passwords, private keys, cookies, or signing certificates.
- Do not print secrets from environment files or server config.
- Keep Kubo administrative RPC private.
- Encrypted file plaintext keys must not be sent to storage peers.
- Public feed publication must only accept Public files.
- Be careful with destructive Docker volume removal.
- Be careful with vault state under `~/.13xfile-desktop`; do not delete it during ordinary debugging.
- Do not delete `repo.lock` blindly while a Kubo process is genuinely using the repo.

---

## 20. Backward compatibility rules

Current compatibility behavior is intentional:

- legacy encrypted files remain readable;
- legacy `13xfile://` app links are still parsed;
- canonical new app links use `x13file://`;
- backend may still use `private` while UI says **Encrypted**;
- the old backup branch `old-2024` remains available for historical recovery.

Do not remove compatibility paths casually.

---

## 21. How to approach user requests

When the user asks for a 13xfile change:

1. **Do the implementation** when the request is clear; do not stop at mockups or high-level advice unless the user explicitly asks to brainstorm first.
2. Inspect the actual current files before editing.
3. Preserve the approved architecture and existing functionality.
4. If the user asks to "check" something operational, inspect the real running state rather than guessing.
5. If a previous error may simply be persisted history, verify with a fresh operation.
6. If the task touches local feed functionality, verify the desktop and feed are both pointing at the local API during local testing.
7. Validate the relevant build/tests.
8. Commit and push successful work to `main`.
9. Report:
   - what changed;
   - what was tested;
   - the commit hash;
   - any remaining limitation that actually matters.

---

## 22. Current architectural principles

Use these as guardrails when making product decisions.

### Principle A — File bytes are decentralized

13xfile's own central services should not become the canonical storage location for uploaded file bytes.

### Principle B — Centralized discovery is allowed when replaceable

Fast search, moderation, pagination, and indexing can use a normal database/API as long as durable feed metadata remains independently reconstructable.

### Principle C — Desktop is a real peer

The desktop application is not just a thin uploader to a central server. It owns its node/Kubo runtime and participates directly in the network.

### Principle D — Encryption happens before decentralized storage

Sensitive content is encrypted locally before entering IPFS.

### Principle E — Durability is proven by signed receipts

Do not equate provider discovery with a safe replica. 13xfile counts active signed replication acknowledgements.

### Principle F — Keep product surfaces modular

The product website, feed, share page, API, desktop app, and node are separate concerns and should remain separable deployments.

---

## 23. Quick operational checklist

Before touching 13xfile, an agent should be able to answer:

```text
Project path?       /home/sebastech/projects/13xfile
Active branch?      main
Backup branch?      old-2024
Prototype branch?   deleted; do not recreate
Remote?             git@github.com:bastilavarias/13xfile.git

Main local site?    127.0.0.1:8080
Feed?               127.0.0.1:8081
Share?              127.0.0.1:8082
Feed API?           127.0.0.1:8090

Desktop stack?      Go + Wails v3 + React/TS/Tailwind
Node?               Go + managed Kubo/IPFS
Feed API?           Go + SQLite + IPFS/IPNS
Web/feed/share?     static HTML/CSS/JS + Nginx locally

Successful change?  test -> commit -> push origin/main
```

---

## 24. Keep this file current

This file exists so future 13xfile work starts with the right assumptions.

When a change materially alters any of the following, update this document in the same successful commit:

- project path or repo structure;
- branch model;
- major technologies;
- local ports;
- local-development commands;
- public URLs/deployment status;
- feed architecture;
- encryption behavior;
- replication semantics;
- important UI/product defaults;
- commit/push workflow.

Do not let this become an outdated historical description.
