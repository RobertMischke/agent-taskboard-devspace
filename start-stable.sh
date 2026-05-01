#!/usr/bin/env bash
# Start script for the Stable environment.
# Port defaults live here — inner checkout keeps 5030/4010 in its own files.
export BACKEND_PORT="${BACKEND_PORT:-5031}"
export FRONTEND_PORT="${FRONTEND_PORT:-4011}"
export CHECKOUT="agent-taskboard-stable"
export PROXY_SUFFIX="stable"
exec "$(dirname "${BASH_SOURCE[0]:-$0}")/start.sh"
