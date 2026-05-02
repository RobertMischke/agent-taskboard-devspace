#!/usr/bin/env bash
# Bring the stable checkout up to origin/main:
#   1. Preflight (must be on `main`, worktree clean)
#   2. Stop stable
#   3. git pull --ff-only origin main
#   4. npm install   (only if package-lock.json changed)
#   5. Start stable  (foreground — ng serve runs in this terminal)
#
# Aborts before touching anything if stable is dirty or not fast-forwardable.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CHECKOUT="${ROOT_DIR}/agent-taskboard-stable"
FRONTEND="${CHECKOUT}/frontend"
LOCK="${FRONTEND}/package-lock.json"

section() { echo; echo "=================================================="; echo "  $1"; echo "=================================================="; }

# ─── preflight ───────────────────────────────────────────────────────────────

section "Preflight"

branch="$(git -C "${CHECKOUT}" rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" != "main" ]]; then
  echo "ERROR: Stable is on branch '${branch}', expected 'main'." >&2
  exit 1
fi
echo "  Branch  : ${branch}"

dirty="$(git -C "${CHECKOUT}" status --porcelain --untracked-files=no)"
if [[ -n "${dirty}" ]]; then
  echo "ERROR: Stable has local changes. Aborting:" >&2
  echo "${dirty}" >&2
  exit 1
fi
echo "  Worktree: clean"

lock_before=""
if [[ -f "${LOCK}" ]]; then
  lock_before="$(git hash-object "${LOCK}")"
fi

# ─── stop ────────────────────────────────────────────────────────────────────

"${ROOT_DIR}/stop-stable.sh"

# ─── pull ────────────────────────────────────────────────────────────────────

section "Pulling origin/main"

git -C "${CHECKOUT}" fetch origin main
git -C "${CHECKOUT}" pull --ff-only origin main

head_now="$(git -C "${CHECKOUT}" log -1 --format='%h %s')"
echo "  HEAD now: ${head_now}"

# ─── npm install if lock changed ─────────────────────────────────────────────

lock_after=""
if [[ -f "${LOCK}" ]]; then
  lock_after="$(git hash-object "${LOCK}")"
fi

if [[ "${lock_before}" != "${lock_after}" ]]; then
  section "package-lock.json changed — running npm install"
  ( cd "${FRONTEND}" && npm install )
else
  echo "  npm     : package-lock.json unchanged, skipping install"
fi

# ─── start ───────────────────────────────────────────────────────────────────
# Detach the frontend so update-stable.sh exits cleanly while ng serve
# keeps running in the background. Backend is already daemonised by api.sh.

DETACH=1 exec "${ROOT_DIR}/start-stable.sh"
