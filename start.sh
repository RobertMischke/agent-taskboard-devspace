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

echo "Starting frontend on :${FRONTEND_PORT} -> backend :${BACKEND_PORT} ..."
cd "${TARGET_DIR}/frontend"
exec npx ng serve --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}"
