#!/usr/bin/env bash
# Stop script for the Dev environment.
export BACKEND_PORT="${BACKEND_PORT:-5030}"
export FRONTEND_PORT="${FRONTEND_PORT:-4010}"
export CHECKOUT="agent-taskboard-dev"
exec "$(dirname "${BASH_SOURCE[0]:-$0}")/stop.sh"
