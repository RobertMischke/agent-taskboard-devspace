#!/usr/bin/env bash
# Shared launcher — called by start-dev.sh and start-stable.sh.
# Required env vars (set by the caller):
#   CHECKOUT      — subfolder name, e.g. "agent-taskboard-dev"
#   BACKEND_PORT  — e.g. 5030
#   FRONTEND_PORT — e.g. 4010
#   PROXY_SUFFIX  — used for the temp proxy file name, e.g. "dev"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/${CHECKOUT}"

. "${ROOT_DIR}/_lib.sh"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

echo "=== ${CHECKOUT} — backend :${BACKEND_PORT}, frontend :${FRONTEND_PORT} ==="

cd "${TARGET_DIR}"

# Self-heal half-installed npm CLI shims (claude, gemini) before the backend
# boots. A broken claude.exe stub used to silently drain the entire 2-ready
# lane through 3a-failed-pickup; this pre-flight repairs what it can.
# See ${TARGET_DIR}/docs/agent-contract-pattern.md (worked example: pickup-failed)
# and ${TARGET_DIR}/docs/loop-inventory.md.
#
# Set ATP_CLI_SHIM_STRICT=1 to abort the boot when the shim is unrepairable
# (the old behaviour). The default is now a loud warning that lets the rest
# of the stack come up — without this, a Windows machine that never had
# claude globally installed (or whose npm cache got corrupted between a
# stop+start cycle, e.g. during an update-service-driven restart) gets stuck
# unable to boot stable, even though only claude-backed jobs are affected.
if [[ -x "${TARGET_DIR}/tools/check-cli-shims.sh" ]]; then
  echo "--- CLI health ---"
  if ! "${TARGET_DIR}/tools/check-cli-shims.sh"; then
    if [[ "${ATP_CLI_SHIM_STRICT:-0}" == "1" ]]; then
      echo "ERROR: CLI shim check failed (strict mode). Aborting startup before backend." >&2
      echo "       Inspect ${TARGET_DIR}/tools/check-cli-shims.sh output above," >&2
      echo "       fix the underlying npm install, then re-run." >&2
      exit 1
    fi
    echo "WARN: CLI shim check failed. Boot continuing without claude available;" >&2
    echo "      claude-backed jobs will fail at pickup until the shim is repaired." >&2
    echo "      Set ATP_CLI_SHIM_STRICT=1 to make this fatal again." >&2
  fi
fi

echo "--- Update service ---"
# Standalone update-service (port 5039 by default). ADR-0021 / ADR-0031:
# this is the one .NET process that must outlive the main backend — it owns
# the stop-stable / pull / restart / verify pipeline, so anything that stops
# the backend (a crash, a manual ./api.sh stop, a verification failure) must
# leave update-service running. We start it here, but stop.sh deliberately
# does NOT take it down; use ./update-service.sh stop explicitly when you
# really want to take it offline (e.g. before pruning the workspace).
#
# Idempotent: the script's listener check skips the start when the port is
# already bound, so calling this from both checkouts is safe.
if [[ -x "${TARGET_DIR}/update-service.sh" ]]; then
  ( cd "${TARGET_DIR}" && ./update-service.sh start ) || \
    echo "WARN: update-service start failed; continuing with backend." >&2
fi

echo "--- Backend ---"
PORT=${BACKEND_PORT} ./api.sh start

echo "--- Frontend ---"
kill_port "${FRONTEND_PORT}"

PROXY_CONF="${ROOT_DIR}/.proxy-${PROXY_SUFFIX}.tmp.json"
cat > "${PROXY_CONF}" <<EOF
{
  "/api":  { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true },
  "/hubs": { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true, "ws": true }
}
EOF

cd "${TARGET_DIR}/frontend"

# DETACH=1 → run ng serve in the background, survive parent shell exit, log to file.
# Default → exec in foreground (so output streams into the user's VS Code terminal).
if [[ "${DETACH:-0}" == "1" ]]; then
  FE_LOG="${TARGET_DIR}/.frontend.log"
  FE_PID_FILE="${TARGET_DIR}/.frontend.pid"
  : > "${FE_LOG}"
  echo "Starting frontend (detached) on :${FRONTEND_PORT} -> backend :${BACKEND_PORT} ..."
  echo "  log: ${FE_LOG}"
  # Pass the project name explicitly: angular.json now declares multiple
  # applications (frontend + next-gen-chat-mockup), so a bare `ng serve`
  # aborts with "Cannot determine project for command".
  nohup npx ng serve frontend --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}" \
    > "${FE_LOG}" 2>&1 &
  FE_PID=$!
  disown "${FE_PID}" 2>/dev/null || true
  echo "${FE_PID}" > "${FE_PID_FILE}"
  # Wait for the port to come up (ng serve takes ~30s) so callers know it's ready.
  for _ in $(seq 1 60); do
    sleep 1
    if [[ -n "$(listener_pid "${FRONTEND_PORT}")" ]]; then
      echo "Frontend listening on :${FRONTEND_PORT} (PID: ${FE_PID})."
      exit 0
    fi
  done
  echo "WARN: Frontend did not become ready within 60s. Tail log: ${FE_LOG}" >&2
  exit 1
else
  echo "Starting frontend on :${FRONTEND_PORT} -> backend :${BACKEND_PORT} ..."
  exec npx ng serve frontend --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}"
fi
