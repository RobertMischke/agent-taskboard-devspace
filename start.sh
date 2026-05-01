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

# ── helpers ────────────────────────────────────────────────────────────────

is_windows() {
  case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; esac
  return 1
}

# Print the PID currently listening on a port, or empty string.
listener_pid() {
  local port="$1"
  if is_windows; then
    netstat -ano 2>/dev/null \
      | awk -v p=":${port}" '$2 ~ p && /LISTENING/ { print $5; exit }'
  else
    if command -v lsof >/dev/null 2>&1; then
      lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -n1
    elif command -v ss >/dev/null 2>&1; then
      ss -lntp 2>/dev/null \
        | awk -v p=":${port}" '$4 ~ p { match($0,/pid=[0-9]+/); if(RSTART) print substr($0,RSTART+4,RLENGTH-4); exit }'
    fi
  fi
}

kill_port() {
  local port="$1"
  local pid
  pid="$(listener_pid "${port}")"
  if [[ -n "${pid}" ]] && [[ "${pid}" =~ ^[0-9]+$ ]]; then
    echo "  Port ${port} occupied by PID ${pid} — stopping it..."
    if is_windows; then
      taskkill //F //T //PID "${pid}" >/dev/null 2>&1 || true
    else
      kill -TERM "${pid}" 2>/dev/null || true
      sleep 0.3
      kill -KILL "${pid}" 2>/dev/null || true
    fi
    # Wait until the port is actually free (up to 5 s)
    local i=0
    while [[ -n "$(listener_pid "${port}")" ]] && (( i < 10 )); do
      sleep 0.5; i=$(( i + 1 ))
    done
    echo "  Port ${port} is now free."
  else
    echo "  Port ${port} is free."
  fi
}

# ── preflight ──────────────────────────────────────────────────────────────

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

echo "=== ${CHECKOUT} — backend :${BACKEND_PORT}, frontend :${FRONTEND_PORT} ==="

# ── backend ────────────────────────────────────────────────────────────────

cd "${TARGET_DIR}"
echo "--- Backend ---"
PORT=${BACKEND_PORT} ./api.sh start

# ── frontend ───────────────────────────────────────────────────────────────

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
