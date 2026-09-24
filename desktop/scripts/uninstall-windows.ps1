param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\13xfile",
    [switch]$DeleteVaultData
)

$ErrorActionPreference = "Stop"

if (Get-Process -Name "13xfile" -ErrorAction SilentlyContinue) {
    throw "13xfile is currently running. Quit it from the system tray before uninstalling."
}

Remove-Item -Recurse -Force "HKCU:\Software\Classes\x13file" -ErrorAction SilentlyContinue

$ShortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\13xfile.lnk"
Remove-Item -Force $ShortcutPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue

if ($DeleteVaultData) {
    $VaultData = Join-Path $HOME ".13xfile-desktop"
    Remove-Item -Recurse -Force $VaultData -ErrorAction SilentlyContinue
    Write-Host "Deleted local 13xfile vault/node data: $VaultData"
} else {
    Write-Host "Preserved local vault/node data under ~/.13xfile-desktop"
}

Write-Host "13xfile uninstalled." -ForegroundColor Green
