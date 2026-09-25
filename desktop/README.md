# 13xfile Desktop MVP

Standalone Wails desktop client for 13xfile. Installing/running the desktop application makes that computer its own 13xfile peer; a separately launched headless node is not required.

Local state is kept under:

```text
~/.13xfile-desktop/
├── settings.json
├── transfers.json
├── staging/
├── tmp/
└── node/
    ├── config.json
    ├── device-identity.json
    ├── web-demo.json
    ├── vaults/
    ├── ipfs/
    └── runtime/kubo/
```

## Stack

- Wails v3
- Go
- React + TypeScript
- Tailwind CSS
- shadcn-style Radix primitives
- managed Kubo/IPFS runtime

## MVP features

### Files and transfers

- drag/drop or choose multiple files
- three concurrent transfer workers
- persistent transfer journal
- queued/running work recovers after application restart when the source still exists
- pause, cancel, retry
- background transfers from the system tray
- native save to the configured download directory
- search
- signed vault removal operations

### Encryption

Private is the default upload mode.

New private files get a random 256-bit file key. File bytes are encrypted locally with chunked AES-256-GCM before entering IPFS. The random file key is wrapped with a vault-derived AES-GCM wrapping key and stored only as authenticated wrapped metadata.

Legacy private files from the first prototype remain readable.

### Replication

Every device has an Ed25519 device identity. After a peer completes a CID pin it publishes a signed `replica.ack` operation.

The UI shows:

```text
1 / 3  Replicating
2 / 3  Replicating
3 / 3  Safe
```

Only receipts from devices with a fresh signed heartbeat count toward that number, so an offline peer eventually stops contributing to `Safe`. The target is configurable in Settings. Details shows the individual active device/peer receipts behind the count.

### Sharing

Public files expose:

- normal HTTPS web link
- QR code
- `x13file://share/...` app link
- CID

The static receiver page probes the IPFS Public Gateway Checker list against the actual CID from the recipient browser, recommends a working origin, and exposes alternatives like mirror links.

Private web sharing is deliberately not part of this MVP. Private app links carry only the individual file decryption capability.

`13xfile://share/...` links from the prototype remain accepted for backward compatibility, but `x13file://` is the canonical OS-registerable scheme because URI schemes cannot start with a digit.

## Settings

The MVP Settings dialog includes:

- replication target
- storage allocation
- download folder
- keep node running when the window closes
- start at login
- peer/device/vault diagnostics

Raw Kubo/IPNS errors are kept in Diagnostics instead of being dumped into the main file browser.

## Windows development

```powershell
git switch prototype
git pull origin prototype

cd desktop
go run .
```

The first launch bootstraps the pinned managed Kubo runtime automatically.

The built React frontend is committed under `frontend/dist`, so Node.js is only needed when changing the UI.

## Windows MVP install

From PowerShell in `desktop`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

The script:

- builds the desktop executable
- installs it under `%LOCALAPPDATA%\Programs\13xfile`
- registers `x13file://`
- creates a Start Menu shortcut

Uninstall while preserving vault data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-windows.ps1
```

Add `-DeleteVaultData` only when local vault/node state should also be erased.

A native Windows NSIS pipeline is included under `.github/workflows/windows-release.yml` and `build/windows/installer.nsi`.

Prototype branch pushes build an unsigned Windows installer artifact automatically. Tagged releases require Authenticode signing secrets before publication:

- `WINDOWS_SIGNING_CERT_BASE64` — base64-encoded PFX code-signing certificate
- `WINDOWS_SIGNING_CERT_PASSWORD` — PFX password

When those secrets are present, the workflow signs both `13xfile.exe` and the NSIS installer, verifies the signatures, generates SHA-256 checksums, and publishes tagged release assets. The installer registers `x13file://`, bootstraps WebView2, creates a Start Menu shortcut, and deliberately preserves `~/.13xfile-desktop` on uninstall.

## Acceptance

The automated integration test creates an isolated peer/vault, uploads public and private files, verifies the random wrapped private key and signed local replica receipt, downloads/decrypts the private file byte-for-byte, and retrieves it again through its private app-share capability.
