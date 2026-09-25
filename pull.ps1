param()

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

Assert-Command git

Push-Location $Root
try {
    $branch = (git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read current Git branch."
    }

    if ($branch -ne "main") {
        throw "Pull helper only updates main. Current branch: '$branch'. Switch with: git switch main"
    }

    $generatedChanges = git status --porcelain -- desktop/frontend/dist
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect generated frontend output."
    }

    if ($generatedChanges) {
        Write-Host "==> Reset generated desktop frontend output" -ForegroundColor DarkCyan
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
        Write-Host "Local source changes detected:" -ForegroundColor Yellow
        git status --short
        throw "Commit or stash your source changes before pulling."
    }

    Write-Host "==> Pull latest main" -ForegroundColor Cyan
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Git pull failed with exit code $LASTEXITCODE."
    }

    Write-Host ""
    Write-Host "13xfile is up to date." -ForegroundColor Green
}
finally {
    Pop-Location
}
