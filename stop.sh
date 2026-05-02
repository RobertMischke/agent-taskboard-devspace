#!/usr/bin/env bash
# Shared stopper — called by stop-dev.sh and stop-stable.sh.
# Required env vars (set by the caller):
#   CHECKOUT      — subfolder name, e.g. "agent-taskboard-dev"
#   BACKEND_PORT  — e.g. 5030
#   FRONTEND_PORT — e.g. 4010
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/${CHECKOUT}"

. "${ROOT_DIR}/_lib.sh"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

echo "=== Stopping ${CHECKOUT} (backend :${BACKEND_PORT}, frontend :${FRONTEND_PORT}) ==="

echo "--- Backend ---"
( cd "${TARGET_DIR}" && PORT=${BACKEND_PORT} ./api.sh stop ) || true
# Belt-and-braces: kill anything still on the backend port.
kill_port "${BACKEND_PORT}"

echo "--- Frontend ---"
FE_PID_FILE="${TARGET_DIR}/.frontend.pid"
if [[ -f "${FE_PID_FILE}" ]]; then
  fe_pid="$(tr -d ' \r\n' < "${FE_PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${fe_pid}" ]] && [[ "${fe_pid}" =~ ^[0-9]+$ ]]; then
    if is_windows; then
      taskkill //F //T //PID "${fe_pid}" >/dev/null 2>&1 || true
    else
      kill -TERM "${fe_pid}" 2>/dev/null || true
      sleep 0.3
      kill -KILL "${fe_pid}" 2>/dev/null || true
    fi
  fi
  rm -f "${FE_PID_FILE}"
fi
kill_port "${FRONTEND_PORT}"

echo "Done."
