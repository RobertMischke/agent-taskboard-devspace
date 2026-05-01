# Update-Stable.ps1
# Bring the stable checkout up to origin/main:
#   1. Stop stable (backend + frontend)
#   2. git pull --ff-only origin main
#   3. npm install   (only if package-lock.json changed)
#   4. Start stable
#
# Stable must be on `main` and have no local changes — the pull is
# strictly fast-forward. If either condition fails, the script aborts
# before touching anything else.
#
# Usage:
#   .\Update-Stable.ps1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root     = $PSScriptRoot
$Checkout = Join-Path $Root "agent-taskboard-stable"
$Frontend = Join-Path $Checkout "frontend"
$LockFile = Join-Path $Frontend "package-lock.json"

function Section([string]$title) {
    Write-Host ""
    Write-Host ("=" * 50)
    Write-Host "  $title"
    Write-Host ("=" * 50)
}

# ─── preflight ────────────────────────────────────────────────────────────────

Section "Preflight"

$branch = (git -C $Checkout rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
    Write-Error "Stable is on branch '$branch', expected 'main'. Aborting."
}
Write-Host "  Branch  : $branch"

$dirty = git -C $Checkout status --porcelain --untracked-files=no
if ($dirty) {
    Write-Error "Stable has local changes. Aborting:`n$dirty"
}
Write-Host "  Worktree: clean"

$lockHashBefore = if (Test-Path $LockFile) { (Get-FileHash $LockFile).Hash } else { $null }

# ─── stop ─────────────────────────────────────────────────────────────────────

& "$Root\Stop-Env.ps1" -Env stable

# ─── pull ─────────────────────────────────────────────────────────────────────

Section "Pulling origin/main"

git -C $Checkout fetch origin main
git -C $Checkout pull --ff-only origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "git pull --ff-only failed. Stable was not fast-forwardable."
}

$head = (git -C $Checkout log -1 --format="%h %s").Trim()
Write-Host "  HEAD now: $head"

# ─── npm install if lock changed ──────────────────────────────────────────────

$lockHashAfter = if (Test-Path $LockFile) { (Get-FileHash $LockFile).Hash } else { $null }
if ($lockHashBefore -ne $lockHashAfter) {
    Section "package-lock.json changed — running npm install"
    Push-Location $Frontend
    try {
        & cmd /c "npm install"
        if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed." }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "  npm     : package-lock.json unchanged, skipping install"
}

# ─── start ────────────────────────────────────────────────────────────────────

& "$Root\Start-Env.ps1" -Env stable
