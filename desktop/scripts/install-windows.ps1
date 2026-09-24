param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\13xfile",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$DesktopDir = Split-Path -Parent $PSScriptRoot
$BuildOutput = Join-Path $env:TEMP "13xfile-mvp.exe"
$InstalledExe = Join-Path $InstallDir "13xfile.exe"

if (Get-Process -Name "13xfile" -ErrorAction SilentlyContinue) {
    throw "13xfile is currently running. Quit it from the system tray before installing."
}

if (-not $SkipBuild) {
    Write-Host "Building 13xfile Desktop..."
    Push-Location $DesktopDir
    try {
        go build -o $BuildOutput .
    }
    finally {
        Pop-Location
    }
} elseif (-not (Test-Path $BuildOutput)) {
    throw "SkipBuild was supplied but $BuildOutput does not exist."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Force $BuildOutput $InstalledExe

$ProtocolRoot = "HKCU:\Software\Classes\x13file"
New-Item -Force $ProtocolRoot | Out-Null
Set-Item -Path $ProtocolRoot -Value "URL:13xfile Protocol"
New-ItemProperty -Path $ProtocolRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
$CommandKey = Join-Path $ProtocolRoot "shell\open\command"
New-Item -Force $CommandKey | Out-Null
Set-Item -Path $CommandKey -Value ('"{0}" "%1"' -f $InstalledExe)

$StartMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$ShortcutPath = Join-Path $StartMenuDir "13xfile.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $InstalledExe
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "13xfile decentralized encrypted storage"
$Shortcut.Save()

Write-Host ""
Write-Host "13xfile installed successfully." -ForegroundColor Green
Write-Host "Executable: $InstalledExe"
Write-Host "Registered protocol: x13file://"
Write-Host "User vault data remains under ~/.13xfile-desktop and is not part of the installer."
