#!/usr/bin/env bash
# Lightweight liveness watchdog for the stable backend (:5031).
#
# The auto-update cycle (and the occasional external kill) has left the stable
# backend stopped without a restart more than once, so the operator keeps
# finding the studio dead with the FE throwing ECONNREFUSED. This polls the
# backend and restarts it via api.sh the moment it goes unhealthy. It does NOT
# touch the frontend (which survives a backend bounce and reconnects on its own).
#
# Run:  nohup bash watchdog-stable.sh >/dev/null 2>&1 &   (detached), or via the
# harness background runner. Stop: kill the process / remove the .lock file.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CHECKOUT="${ROOT}/agent-taskboard-stable"
. "${ROOT}/remote-execution.sh"
LOG="${ROOT}/.watchdog-stable.log"
PORT="${STABLE_BACKEND_PORT:-5031}"
INTERVAL="${WATCHDOG_INTERVAL:-30}"
MAINTENANCE_FILE="${STABLE_MAINTENANCE_FILE:-${ROOT}/.stable-maintenance}"

log() { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >> "${LOG}"; }

maintenance_active() { [[ -e "${MAINTENANCE_FILE}" || -L "${MAINTENANCE_FILE}" ]]; }

restart_prebuilt_backend() {
  local sha artifact file
  maintenance_active && { log "restart skipped: stable maintenance is active"; return 0; }
  sha="$(git -C "${CHECKOUT}" rev-parse HEAD 2>/dev/null)" || {
    log "restart refused: checkout HEAD is unavailable"; return 1;
  }
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { log "restart refused: invalid checkout SHA"; return 1; }
  artifact="${CHECKOUT}/backend/bin/remote-publish/${sha}"
  for file in RELEASE-SHA FULL-GATE OrchestratorApi.dll OrchestratorApi.deps.json OrchestratorApi.runtimeconfig.json; do
    [[ -f "$artifact/$file" && -s "$artifact/$file" ]] || {
      log "restart refused: missing prebuilt artifact $file for $sha"; return 1;
    }
  done
  [[ "$(tr -d '\r\n' < "$artifact/RELEASE-SHA")" == "$sha" ]] || {
    log "restart refused: prebuilt release SHA does not match checkout HEAD"; return 1;
  }
  [[ "$(tr -d '\r\n' < "$artifact/FULL-GATE")" == "PROMOTION_FULL_GATE=passed:$sha" ]] || {
    log "restart refused: exact-commit full gate proof is missing"; return 1;
  }
  # Legacy api.sh ignores the prebuilt environment and would run a local build.
  grep -Fq 'api-prebuilt-required:' "${CHECKOUT}/api.sh" || {
    log "restart refused: api.sh does not support the prebuilt-only contract"; return 1;
  }
  maintenance_active && { log "restart skipped: stable maintenance is active"; return 0; }
  log "restarting backend from verified prebuilt artifacts for $sha"
  ( cd "${CHECKOUT}" && export API_PREBUILT_DIR="$artifact" API_REQUIRE_PREBUILT=1 \
    && PORT="${PORT}" ./api.sh start >> "${LOG}" 2>&1 )
}

log "watchdog started (port ${PORT}, interval ${INTERVAL}s)"
fails=0
while true; do
  if maintenance_active; then
    fails=0
    sleep "${INTERVAL}"
    continue
  fi
  # IMPORTANT: probe the LIGHT /healthz (returns ~0.2s), never /api/tasks.
  # /api/tasks serializes hundreds of tasks and takes 1.5-4s+ when the backend
  # is busy (RegressionRadar, CLI spawns) — with a tight timeout that read as
  # "down" and the watchdog killed a healthy-but-busy backend in a ~67s loop.
  # /healthz only reflects whether the process is actually alive.
  code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/healthz" 2>/dev/null || echo "000")
  if [ "${code}" = "200" ]; then
    fails=0
  else
    fails=$((fails + 1))
    log "backend unhealthy (HTTP ${code}); consecutive=${fails}"
    # Require THREE consecutive /healthz misses (~90s) before restarting, so
    # only a genuinely dead process triggers a restart — never a momentary blip.
    if [ "${fails}" -ge 3 ]; then
      if restart_prebuilt_backend; then
        log "restart attempt complete"
      else
        log "restart refused or failed; no source-build fallback"
      fi
      fails=0
    fi
  fi
  sleep "${INTERVAL}"
done
