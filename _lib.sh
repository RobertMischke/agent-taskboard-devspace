#!/usr/bin/env bash
# Shared helpers for the workspace-root start/stop scripts.
# Source via:  . "$(dirname "${BASH_SOURCE[0]:-$0}")/_lib.sh"

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
    local i=0
    while [[ -n "$(listener_pid "${port}")" ]] && (( i < 10 )); do
      sleep 0.5; i=$(( i + 1 ))
    done
    echo "  Port ${port} is now free."
  else
    echo "  Port ${port} is free."
  fi
}
