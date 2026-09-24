# 13xfile Desktop Prototype

Standalone desktop client for the 13xfile prototype.

The desktop app owns its own 13xfile peer. It does **not** require the separate headless node process. Its state lives under:

```text
~/.13xfile-desktop/
└── node/
    ├── config.json
    ├── ipfs/
    └── runtime/kubo/
```

The headless `/node` app remains useful for servers and storage-only peers.

## Stack

- Wails v3
- Go
- React + TypeScript
- Tailwind CSS
- shadcn-style Radix primitives
- managed Kubo/IPFS runtime

## Prototype features

- standalone node identity and Kubo lifecycle
- close window to tray while the node keeps running
- cross-platform Wails system tray
- tray transfer count/progress indicator
- drag-and-drop file upload
- multiple file selection
- three concurrent transfer workers
- Google Drive-style in-app transfer tray
- pause/cancel/retry transfer controls
- public file storage
- private file encryption before IPFS using chunked AES-256-GCM
- decentralized shared-vault metadata through the existing IPNS prototype
- automatic pinning by other vault peers
- public/private `13xfile://share/...` descriptors
- private share descriptors carry the decryption capability
- download + local decryption
- no 13xfile-owned central API/database

## Important prototype limitations

The shared vault metadata mechanism is still the demo IPNS multi-writer model. It is suitable for proving the product flow, not production concurrency. A signed operation log / CRDT remains the intended replacement.

The desktop currently reports whether a file is stored on the local peer. It does **not** yet claim an exact network replica count because the protocol does not have replication acknowledgements yet.

The vault join code is currently shared authority for the demo vault. Treat it as a secret.

## Windows quick start

From the repository:

```powershell
git switch prototype
git pull origin prototype

cd desktop
go run .
```

First launch automatically downloads the pinned Kubo runtime, initializes the desktop-owned node, and opens 13xfile.

To produce an executable:

```powershell
cd desktop
go build -o 13xfile-desktop.exe .
.\13xfile-desktop.exe
```

The built frontend is committed under `frontend/dist`, so normal users testing the prototype do not need Node.js.

## Frontend development

Only needed when changing the React UI:

```powershell
cd desktop\frontend
npm install
npm run build

cd ..
go run .
```

## Vault test

On PC A:

1. launch 13xfile;
2. choose **Create new vault**;
3. copy the vault join code;
4. drag multiple dummy files into the app;
5. choose Private or Public before adding them.

On PC B, even on another network:

1. launch its own 13xfile desktop app;
2. choose **Join existing vault**;
3. paste the join code;
4. wait for IPNS metadata sync and IPFS replication.

The files should appear in PC B's local UI because PC B is running its own peer, not because it is connected to PC A's web server.

## Private sharing

A private share link looks like:

```text
13xfile://share/...
```

For this prototype, copy the link and use **Open link** inside another 13xfile desktop client. The descriptor contains the capability necessary to decrypt that specific file, but does not expose the vault join code.

Custom OS protocol registration for opening `13xfile://` directly from other apps is a later packaging step.
