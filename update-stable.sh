#!/usr/bin/env bash
# Bring the stable checkout up to origin/main:
#   1. Preflight (must be on `main`, worktree clean)
#   2. Wait for stable's runner to be quiescent (active=null on every project)
#   3. Stop stable
#   4. git pull --ff-only origin main
#   5. npm install   (only if package-lock.json changed)
#   6. Start stable  (foreground — ng serve runs in this terminal)
#
# Aborts before touching anything if stable is dirty or not fast-forwardable.
# Aborts at step 2 if stable still has an active CLI run after the wait
# timeout, so an update never kills a mid-flight job. Override with
# UPDATE_STABLE_FORCE=1 (proceed regardless) or UPDATE_STABLE_WAIT_TIMEOUT
# (seconds; default 1800) to extend the bound.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CHECKOUT="${ROOT_DIR}/agent-taskboard-stable"
FRONTEND="${CHECKOUT}/frontend"
LOCK="${FRONTEND}/package-lock.json"
STABLE_BACKEND_PORT="${STABLE_BACKEND_PORT:-5031}"
WAIT_TIMEOUT="${UPDATE_STABLE_WAIT_TIMEOUT:-1800}"
WAIT_POLL="${UPDATE_STABLE_WAIT_POLL:-5}"

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

# ─── wait for quiescence ─────────────────────────────────────────────────────
# Stable's stop step kills any in-flight CLI process. Block here until every
# project's runner reports activeJobId=null so an update never tears down a
# mid-flight run. Skipped when stable's backend is already offline.

section "Waiting for stable to be quiescent (timeout ${WAIT_TIMEOUT}s)"

active_jobs() {
  local body
  body="$(curl -fsS --max-time 5 "http://localhost:${STABLE_BACKEND_PORT}/api/runner/status" 2>/dev/null || true)"
  if [[ -z "${body}" ]]; then
    # Backend unreachable -> no active job we can know about.
    echo ""
    return 0
  fi
  # Match `"activeJobId":"<non-empty>"` — null/empty values are not matched.
  echo "${body}" | grep -oE '"activeJobId"[[:space:]]*:[[:space:]]*"[^"]+"' || true
}

start_ts="$(date +%s)"
while true; do
  busy="$(active_jobs)"
  if [[ -z "${busy}" ]]; then
    echo "  Stable runner is quiescent; safe to update."
    break
  fi
  now="$(date +%s)"
  elapsed=$(( now - start_ts ))
  if (( elapsed >= WAIT_TIMEOUT )); then
    echo "ERROR: Stable still has active job(s) after ${WAIT_TIMEOUT}s:" >&2
    echo "${busy}" | sed 's/^/    /' >&2
    if [[ "${UPDATE_STABLE_FORCE:-0}" == "1" ]]; then
      echo "  UPDATE_STABLE_FORCE=1 set; proceeding anyway (mid-flight run will be killed)." >&2
      break
    fi
    echo "  Refusing to update; rerun with UPDATE_STABLE_FORCE=1 to override." >&2
    exit 1
  fi
  echo "  Still busy (${busy}); waited ${elapsed}s, retrying in ${WAIT_POLL}s..."
  sleep "${WAIT_POLL}"
done

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
