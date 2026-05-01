# Stop-Env.ps1
# Stops backend and frontend for one checkout environment.
# Kills by PID file first, then falls back to killing by port.
#
# Usage:
#   .\Stop-Env.ps1 dev
#   .\Stop-Env.ps1 stable

param(
    [Parameter(Mandatory)]
    [ValidateSet("dev","stable")]
    [string]$Env
)

$ErrorActionPreference = "Continue"

$Root = $PSScriptRoot

$cfg = switch ($Env) {
    "dev"    { @{ Checkout = "agent-taskboard-dev";    BE = 5030; FE = 4010 } }
    "stable" { @{ Checkout = "agent-taskboard-stable"; BE = 5031; FE = 4011 } }
}

$dir = Join-Path $Root $cfg.Checkout

# ─── helpers ──────────────────────────────────────────────────────────────────

function Stop-ByPidFile([string]$file, [string]$label) {
    if (-not (Test-Path $file)) { return }
    $id = (Get-Content $file -ErrorAction SilentlyContinue) -as [int]
    if ($id) {
        try {
            Stop-Process -Id $id -Force -ErrorAction Stop
            Write-Host "  [$label] Stopped PID $id"
        } catch {
            Write-Host "  [$label] PID $id already gone"
        }
    }
    Remove-Item $file -Force -ErrorAction SilentlyContinue
}

function Stop-ByPort([int]$port, [string]$label) {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $conn) { return }
    foreach ($c in $conn) {
        $id = $c.OwningProcess
        try {
            Stop-Process -Id $id -Force -ErrorAction Stop
            Write-Host "  [$label] Stopped PID $id (was on :$port)"
        } catch {
            Write-Host "  [$label] Could not stop PID $id"
        }
    }
}

# ─── stop ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ("=" * 50)
Write-Host "  Stopping $($Env.ToUpper())"
Write-Host ("=" * 50)

Stop-ByPidFile (Join-Path $dir ".frontend.pid") "FE"
Stop-ByPidFile (Join-Path $dir ".api.pid")      "BE"

# Fallback: kill anything still on the ports
Stop-ByPort $cfg.FE "FE"
Stop-ByPort $cfg.BE "BE"

Write-Host "  Done."
Write-Host ""
