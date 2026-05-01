#!/usr/bin/env bash
# Start script for the Dev environment.
# Port defaults live here — inner checkout keeps 5030/4010 in its own files.
export BACKEND_PORT="${BACKEND_PORT:-5030}"
export FRONTEND_PORT="${FRONTEND_PORT:-4010}"
export CHECKOUT="agent-taskboard-dev"
export PROXY_SUFFIX="dev"
exec "$(dirname "${BASH_SOURCE[0]:-$0}")/start.sh"
