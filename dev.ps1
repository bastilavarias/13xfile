param(
    [switch]$NoPull,
    [switch]$BuildOnly,
    [switch]$CleanInstall,
    [string]$FeedApiUrl = "http://127.0.0.1:8090"
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$FrontendDir = Join-Path $Root "desktop\frontend"
$DesktopDir = Join-Path $Root "desktop"

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

Assert-Command git
Assert-Command npm
Assert-Command go

$env:FEED_API_URL = $FeedApiUrl.TrimEnd("/")
Write-Host "Development feed API: $env:FEED_API_URL" -ForegroundColor DarkCyan

Push-Location $Root
try {
    $branch = (git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read current Git branch."
    }

    if (-not $NoPull) {
        if ($branch -ne "main") {
            throw "Development updater only pulls main. Current branch: '$branch'. Switch with: git switch main"
        }

        # frontend/dist is committed because the Wails binary embeds it, but it is still
        # generated output. A local dev build can legitimately make it dirty. Reset only
        # this generated directory before checking for real source changes.
        $generatedChanges = git status --porcelain -- desktop/frontend/dist
        if ($LASTEXITCODE -ne 0) {
            throw "Could not inspect generated frontend output."
        }
        if ($generatedChanges) {
            Write-Host ""
            Write-Host "==> Reset generated frontend build output" -ForegroundColor DarkCyan
            git restore --source=HEAD --staged --worktree -- desktop/frontend/dist
            if ($LASTEXITCODE -ne 0) {
                throw "Could not reset generated frontend output."
            }
            git clean -fd -- desktop/frontend/dist | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Could not clean generated frontend output."
            }
        }

        $dirty = git status --porcelain
        if ($LASTEXITCODE -ne 0) {
            throw "Could not read Git working tree status."
        }
        if ($dirty) {
            Write-Host ""
            Write-Host "Real local source changes are still present:" -ForegroundColor Yellow
            git status --short
            throw "Commit or stash source changes before running the development updater."
        }

        Invoke-Step "Pull latest main" {
            git pull --ff-only origin main
        }
    }

    Push-Location $FrontendDir
    try {
        $NodeModulesDir = Join-Path $FrontendDir "node_modules"
        $InstalledLock = Join-Path $NodeModulesDir ".package-lock.json"
        $PackageLock = Join-Path $FrontendDir "package-lock.json"
        $NeedsInstall = $CleanInstall -or -not (Test-Path $NodeModulesDir) -or -not (Test-Path $InstalledLock)

        if (-not $NeedsInstall) {
            $NeedsInstall = (Get-Item $PackageLock).LastWriteTimeUtc -gt (Get-Item $InstalledLock).LastWriteTimeUtc
        }

        if ($NeedsInstall) {
            Invoke-Step "Install frontend dependencies" {
                npm ci --prefer-offline --no-audit --no-fund
            }
        }

        Invoke-Step "Build desktop frontend" {
            npm run build
        }
    }
    finally {
        Pop-Location
    }

    if ($BuildOnly) {
        Write-Host ""
        Write-Host "Development build complete." -ForegroundColor Green
        return
    }

    Push-Location $DesktopDir
    try {
        Write-Host ""
        Write-Host "==> Start 13xfile desktop development app" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C in this terminal to stop it." -ForegroundColor DarkGray
        go run .
        if ($LASTEXITCODE -ne 0) {
            throw "Desktop development app exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
