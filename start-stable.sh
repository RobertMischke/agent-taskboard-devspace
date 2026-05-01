#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/agent-taskboard-stable"

# Port defaults for Stable — different from Dev so both can run in parallel.
# Inner checkout always defaults to 5030/4010; the override lives here only.
BACKEND_PORT="${BACKEND_PORT:-5031}"
FRONTEND_PORT="${FRONTEND_PORT:-4011}"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

cd "${TARGET_DIR}"

# Start backend — PORT env var is read by api.sh (defaults to 5030 inside the checkout).
PORT=${BACKEND_PORT} ./api.sh start

# Generate a proxy config at the workspace root so the inner checkout is never modified.
PROXY_CONF="${ROOT_DIR}/.proxy-stable.tmp.json"
cat > "${PROXY_CONF}" <<EOF
{
  "/api":  { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true },
  "/hubs": { "target": "http://localhost:${BACKEND_PORT}", "secure": false, "changeOrigin": true, "ws": true }
}
EOF

echo "Starting STABLE frontend on :${FRONTEND_PORT} -> backend :${BACKEND_PORT} ..."
exec npm start --prefix frontend -- --port "${FRONTEND_PORT}" --proxy-config "${PROXY_CONF}"
