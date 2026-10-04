#!/usr/bin/env bash
# Start from remote artifacts. Never install or compile on the workstation.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/${CHECKOUT}"
. "${ROOT_DIR}/_lib.sh"
. "${ROOT_DIR}/remote-execution.sh"
[[ -d "${TARGET_DIR}" ]] || { echo "ERROR: Missing checkout: ${TARGET_DIR}" >&2; exit 1; }
HEAD_SHA="$(git -C "${TARGET_DIR}" rev-parse HEAD)"
export API_PREBUILT_DIR="${TARGET_DIR}/backend/bin/remote-publish/${HEAD_SHA}"
FRONTEND_PREBUILT_DIR="${TARGET_DIR}/frontend/dist/remote-publish/${HEAD_SHA}"
[[ -n "${RemoteGate__WorkerPath:-}" ]] || { echo "ERROR: Configure RemoteGate__WorkerPath in .remote-execution.env before starting." >&2; exit 1; }
export RemoteGate__WorkerPath
[[ -f "${FRONTEND_PREBUILT_DIR}/index.html" && -f "${FRONTEND_PREBUILT_DIR}/RELEASE-SHA" && "$(tr -d '\r\n' < "${FRONTEND_PREBUILT_DIR}/RELEASE-SHA")" == "${HEAD_SHA}" ]] || { echo "ERROR: Missing or mismatched remote frontend artifacts for ${HEAD_SHA}." >&2; exit 1; }
# The independent update service survives restarts. Do not build it from source.
if ! curl -fsS --max-time 2 http://127.0.0.1:5039/healthz >/dev/null 2>&1; then
  echo "WARN: Independent update service is unavailable; deploy its remote artifact separately." >&2
fi
(cd "${TARGET_DIR}" && PORT="${BACKEND_PORT}" ./api.sh start)
kill_port "${FRONTEND_PORT}"
if [[ "${DETACH:-0}" != 1 ]]; then
  exec node "${ROOT_DIR}/serve-prebuilt-frontend.mjs" "${FRONTEND_PREBUILT_DIR}" "${FRONTEND_PORT}" "http://127.0.0.1:${BACKEND_PORT}"
fi
FE_LOG="${TARGET_DIR}/.frontend.log"
nohup node "${ROOT_DIR}/serve-prebuilt-frontend.mjs" "${FRONTEND_PREBUILT_DIR}" "${FRONTEND_PORT}" "http://127.0.0.1:${BACKEND_PORT}" > "${FE_LOG}" 2>&1 < /dev/null &
FE_PID=$!
disown "${FE_PID}" 2>/dev/null || true
printf '%s\n' "${FE_PID}" > "${TARGET_DIR}/.frontend.pid"
for ((i=0; i<30; i++)); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null; then
    echo "Prebuilt frontend ready on :${FRONTEND_PORT}."
    exit 0
  fi
  sleep 1
done
echo "ERROR: Prebuilt frontend did not become healthy; see ${FE_LOG}." >&2
exit 1
