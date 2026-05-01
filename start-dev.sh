#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/agent-taskboard-dev"

# Port defaults for Dev — override via env if needed.
BACKEND_PORT="${BACKEND_PORT:-5030}"
FRONTEND_PORT="${FRONTEND_PORT:-4010}"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

cd "${TARGET_DIR}"

# Start backend — PORT env var is read by api.sh (defaults to 5030 inside the checkout).
PORT=${BACKEND_PORT} ./api.sh start

# Generate a proxy config at the workspace root so the inner checkout is never modified.
PROXY_CONF="${ROOT_DIR}/.proxy-dev.tmp.json"
cat > "${PROXY_CONF}" <<EOF
{
  "/api":  { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true },
  "/hubs": { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true, "ws": true }
}
EOF

echo "Starting DEV frontend on :${FRONTEND_PORT} -> backend :${BACKEND_PORT} ..."
cd frontend
exec npx ng serve --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}"
