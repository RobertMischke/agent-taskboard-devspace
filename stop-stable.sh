#!/usr/bin/env bash
# Stop script for the Stable environment.
export BACKEND_PORT="${BACKEND_PORT:-5031}"
export FRONTEND_PORT="${FRONTEND_PORT:-4011}"
export CHECKOUT="agent-taskboard-stable"
exec "$(dirname "${BASH_SOURCE[0]:-$0}")/stop.sh"
