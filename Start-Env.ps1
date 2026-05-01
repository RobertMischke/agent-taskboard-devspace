# Start-Env.ps1
# Idempotent start for one checkout environment.
# If ports are already listening, exits immediately (fast).
# Processes run hidden in the background; output goes to log files.
#
# Usage:
#   .\Start-Env.ps1 dev
#   .\Start-Env.ps1 stable
#
# Log files:
#   agent-taskboard-{env}/.api.log        — backend stdout
#   agent-taskboard-{env}/.api.err.log    — backend stderr
#   agent-taskboard-{env}/.frontend.log   — frontend stdout
#   agent-taskboard-{env}/.frontend.err.log

param(
    [Parameter(Mandatory)]
    [ValidateSet("dev","stable")]
    [string]$Env
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = $PSScriptRoot

$cfg = switch ($Env) {
    "dev"    { @{ Checkout = "agent-taskboard-dev";    BE = 5030; FE = 4010 } }
    "stable" { @{ Checkout = "agent-taskboard-stable"; BE = 5031; FE = 4011 } }
}

$dir        = Join-Path $Root $cfg.Checkout
$beDir      = Join-Path $dir  "backend"
$feDir      = Join-Path $dir  "frontend"
$beLog      = Join-Path $dir  ".api.log"
$beErrLog   = Join-Path $dir  ".api.err.log"
$feLog      = Join-Path $dir  ".frontend.log"
$feErrLog   = Join-Path $dir  ".frontend.err.log"
$bePidFile  = Join-Path $dir  ".api.pid"
$fePidFile  = Join-Path $dir  ".frontend.pid"
$proxyConf  = Join-Path $Root ".proxy-$Env.tmp.json"

$bePort     = $cfg.BE
$fePort     = $cfg.FE

# ─── helpers ──────────────────────────────────────────────────────────────────

function Test-Port([int]$port) {
    $null -ne (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Wait-Port([int]$port, [int]$secs, [string]$label) {
    $i = 0
    while (-not (Test-Port $port) -and $i -lt $secs) {
        Start-Sleep 1; $i++
        Write-Host -NoNewline "."
    }
    Write-Host ""
    if (-not (Test-Port $port)) {
        Write-Warning "  [$label] Port :$port not up after ${secs}s — last log output:"
        Get-Content $beLog,$feLog -ErrorAction SilentlyContinue | Select-Object -Last 20
        return $false
    }
    return $true
}

# ─── header ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ("=" * 50)
Write-Host "  $($Env.ToUpper())   BE=:$bePort   FE=:$fePort"
Write-Host ("=" * 50)

# ─── backend ──────────────────────────────────────────────────────────────────

if (Test-Port $bePort) {
    Write-Host "  [BE] :$bePort already listening — OK"
} else {
    Write-Host "  [BE] Starting (dotnet run) ..." -NoNewline

    [string]::Empty | Set-Content $beLog
    [string]::Empty | Set-Content $beErrLog

    $p = Start-Process dotnet `
            -ArgumentList "run","--urls","http://127.0.0.1:$bePort" `
            -WorkingDirectory $beDir `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $beLog `
            -RedirectStandardError  $beErrLog

    $p.Id | Set-Content $bePidFile

    if (-not (Wait-Port $bePort 45 "BE")) { exit 1 }

    Write-Host "  [BE] :$bePort up   PID=$($p.Id)"
}

# ─── frontend ─────────────────────────────────────────────────────────────────

if (Test-Port $fePort) {
    Write-Host "  [FE] :$fePort already listening — OK"
} else {
    @"
{
  "/api":  { "target": "http://localhost:$bePort", "secure": false, "changeOrigin": true },
  "/hubs": { "target": "http://localhost:$bePort", "secure": false, "changeOrigin": true, "ws": true }
}
"@ | Set-Content $proxyConf

    Write-Host "  [FE] Building (ng serve, may take ~30s) ..." -NoNewline

    [string]::Empty | Set-Content $feLog
    [string]::Empty | Set-Content $feErrLog

    # Use cmd /c so that npx.cmd and ng.cmd are resolved correctly on Windows
    $feArgs = "/c npx ng serve --port $fePort --proxy-config `"$proxyConf`""
    $p = Start-Process cmd `
            -ArgumentList $feArgs `
            -WorkingDirectory $feDir `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $feLog `
            -RedirectStandardError  $feErrLog

    $p.Id | Set-Content $fePidFile

    if (-not (Wait-Port $fePort 90 "FE")) {
        Write-Warning "  Frontend may still be compiling. Check: $feLog"
    } else {
        Write-Host "  [FE] :$fePort up   PID=$($p.Id)"
    }
}

# ─── summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  App : http://localhost:$fePort"
Write-Host "  API : http://localhost:$bePort/healthz"
Write-Host ""
Write-Host "  BE log : $beLog"
Write-Host "  FE log : $feLog"
Write-Host "  Tail   : Get-Content <log> -Wait"
Write-Host ""
