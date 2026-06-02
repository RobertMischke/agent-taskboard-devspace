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
LOG="${ROOT}/.watchdog-stable.log"
PORT="${STABLE_BACKEND_PORT:-5031}"
INTERVAL="${WATCHDOG_INTERVAL:-30}"

log() { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >> "${LOG}"; }

log "watchdog started (port ${PORT}, interval ${INTERVAL}s)"
fails=0
while true; do
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
      log "restarting backend via api.sh ..."
      ( cd "${CHECKOUT}" && PORT="${PORT}" ./api.sh start >> "${LOG}" 2>&1 )
      log "restart attempt complete"
      fails=0
    fi
  fi
  sleep "${INTERVAL}"
done
