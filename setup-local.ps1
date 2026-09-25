param(
    [switch]$CleanInstall
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$FrontendDir = Join-Path $Root "desktop\frontend"
$DesktopDir = Join-Path $Root "desktop"
$ApiDir = Join-Path $Root "api"
$PagesDir = Join-Path $Root "tools\devsites"
$NodeDir = Join-Path $Root "node"
$LocalStateDir = Join-Path $Root ".13xfile-local"
$LocalConfigPath = Join-Path $Root ".13xfile.local.json"

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

New-Item -ItemType Directory -Force -Path $LocalStateDir | Out-Null

$localConfig = [ordered]@{
    feedApiUrl = "http://127.0.0.1:8090"
    mainUrl = "http://127.0.0.1:8080/"
    feedUrl = "http://127.0.0.1:8081/"
    shareUrl = "http://127.0.0.1:8082/"
}

$localConfig | ConvertTo-Json | Set-Content -Path $LocalConfigPath -Encoding UTF8

Push-Location $FrontendDir
try {
    $NodeModulesDir = Join-Path $FrontendDir "node_modules"
    if ($CleanInstall -or -not (Test-Path $NodeModulesDir)) {
        Invoke-Step "Install desktop frontend dependencies" {
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

foreach ($module in @(
    @{ Label = "desktop"; Path = $DesktopDir },
    @{ Label = "feed API"; Path = $ApiDir },
    @{ Label = "local page server"; Path = $PagesDir },
    @{ Label = "headless node"; Path = $NodeDir }
)) {
    Push-Location $module.Path
    try {
        Invoke-Step "Download $($module.Label) Go modules" {
            go mod download
        }
    }
    finally {
        Pop-Location
    }
}

Push-Location $ApiDir
try {
    Invoke-Step "Verify feed API" {
        go test ./...
    }
}
finally {
    Pop-Location
}

Push-Location $PagesDir
try {
    Invoke-Step "Verify local page server" {
        go test ./...
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "13xfile local development is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Local desktop feed publishing is now pinned to:" -ForegroundColor White
Write-Host "  http://127.0.0.1:8090" -ForegroundColor Cyan
Write-Host ""
Write-Host "Normal development workflow:" -ForegroundColor White
Write-Host "  Terminal 1: .\pages.cmd" -ForegroundColor Cyan
Write-Host "  Terminal 2: .\dev.cmd -NoPull" -ForegroundColor Cyan
Write-Host ""
Write-Host "You only need to run .\setup-local.cmd once per clone, unless you want to reset local development configuration." -ForegroundColor DarkGray
