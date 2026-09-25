param(
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$ApiDir = Join-Path $Root "api"
$TempDir = Join-Path $env:TEMP "13xfile-dev"
$LocalStateDir = Join-Path $Root ".13xfile-local"
$SitesExe = Join-Path $TempDir "13xfile-sites.exe"
$ApiExe = Join-Path $TempDir "13xfile-feed-api.exe"
$ApiDb = Join-Path $LocalStateDir "feed.db"

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Build-GoTool {
    param(
        [string]$Label,
        [string]$WorkingDirectory,
        [string]$Output,
        [string]$Target
    )

    Write-Host "==> Building $Label" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & go build -o $Output $Target
        if ($LASTEXITCODE -ne 0) {
            throw "Could not build $Label."
        }
    }
    finally {
        Pop-Location
    }
}

function Stop-Tree {
    param([System.Diagnostics.Process]$Process)
    if ($null -eq $Process -or $Process.HasExited) {
        return
    }

    & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
}

Assert-Command go
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
New-Item -ItemType Directory -Force -Path $LocalStateDir | Out-Null

Build-GoTool -Label "static page server" -WorkingDirectory (Join-Path $Root "tools\devsites") -Output $SitesExe -Target "."
Build-GoTool -Label "feed API" -WorkingDirectory $ApiDir -Output $ApiExe -Target "."

$sites = $null
$api = $null

try {
    Write-Host ""
    Write-Host "==> Starting 13xfile local web stack" -ForegroundColor Cyan

    $sites = Start-Process -FilePath $SitesExe -WorkingDirectory $Root -NoNewWindow -PassThru

    $apiEnvironment = @{
        "ADDR" = "127.0.0.1:8090"
        "DATABASE_PATH" = $ApiDb
        "CORS_ORIGIN" = "*"
    }

    foreach ($entry in $apiEnvironment.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }

    $api = Start-Process -FilePath $ApiExe -WorkingDirectory $ApiDir -NoNewWindow -PassThru

    Start-Sleep -Milliseconds 650

    Write-Host ""
    Write-Host "13xfile local pages are running:" -ForegroundColor Green
    Write-Host "  Main   http://127.0.0.1:8080/" -ForegroundColor White
    Write-Host "  Feed   http://127.0.0.1:8081/" -ForegroundColor White
    Write-Host "  Share  http://127.0.0.1:8082/" -ForegroundColor White
    Write-Host "  API    http://127.0.0.1:8090/health" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop all four services." -ForegroundColor DarkGray

    if (-not $NoOpen) {
        Start-Process "http://127.0.0.1:8080/"
        Start-Process "http://127.0.0.1:8081/"
    }

    while ($true) {
        if ($sites.HasExited) {
            throw "Static page server exited with code $($sites.ExitCode)."
        }
        if ($api.HasExited) {
            throw "Feed API exited with code $($api.ExitCode)."
        }
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping 13xfile local web stack..." -ForegroundColor DarkGray
    Stop-Tree $api
    Stop-Tree $sites
}
