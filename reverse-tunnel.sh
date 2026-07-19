#!/usr/bin/env bash
# Keep the Stable Task Server reachable from the remote runner host.
set -u

while true; do
  ssh -N \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o BatchMode=yes \
    -R 15031:127.0.0.1:5031 \
    agent-runner
  sleep 10
done
