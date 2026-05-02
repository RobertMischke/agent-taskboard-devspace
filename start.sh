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
  nohup npx ng serve --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}" \
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
  exec npx ng serve --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}"
fi
