#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TARGET_DIR="${ROOT_DIR}/agent-taskboard-dev"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "ERROR: Missing directory: ${TARGET_DIR}"
  exit 1
fi

cd "${TARGET_DIR}"
./api.sh start

echo "Starting frontend for DEV at ${TARGET_DIR} ..."
exec npm start --prefix frontend
