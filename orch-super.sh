#!/usr/bin/env bash
# Supervise the auto-continuous max=2 parallel runner + watch for the failure
# modes diagnosed 2026-06-09: orphan-dir REVERT-LOOPs and EACCES/watchdog KILLs.
# Emits: BEAT (~240s), COMMIT (develop landed), ALERT (breaker/revert-loop/kill).
# Usage: orch-super.sh [maxSec]
DEV=/c/Projects/agent-taskboard-devspace/agent-taskboard-dev
LOG=/c/Projects/agent-taskboard-devspace/agent-taskboard-stable/.api.log.out
URL="http://localhost:5031/api/runner/status"
MAX="${1:-3600}"; start=$(date +%s); lastbeat=0
lasthead=$(git -C "$DEV" rev-parse HEAD)
logpos=$(wc -l < "$LOG" 2>/dev/null || echo 0)
status(){ curl -s -m 8 "$URL" 2>/dev/null | python -c "
import sys,json
try:
 d=json.load(sys.stdin);p=d['projects']['Agent Task Processor']
 print('%s %s %s %s %s'%(p.get('occupiedSlots'),p.get('maxParallelism'),p.get('breakerState'),p.get('mode'),(p.get('activeJobId') or '-')[:34]))
except Exception: print('ERR ERR ERR ERR -')"; }
echo "SUPER-START $(date +%T) max=${MAX}s (auto-continuous max=2; watching revert-loops + kills)"
while true; do
  now=$(date +%s); el=$((now-start))
  read slots maxp breaker mode active <<< "$(status)"
  head=$(git -C "$DEV" rev-parse HEAD)
  # --- new log lines this tick: revert-loops + kills ---
  npos=$(wc -l < "$LOG" 2>/dev/null || echo "$logpos")
  if [ "$npos" -gt "$logpos" ] 2>/dev/null; then
    new=$(tail -n +$((logpos+1)) "$LOG" 2>/dev/null)
    logpos=$npos
    rev=$(printf '%s\n' "$new" | grep -aoE 'reverted job [a-z0-9-]+' | sort | uniq -c | sort -rn | head -1)
    revn=$(echo "$rev" | grep -oE '^ *[0-9]+' | tr -d ' ')
    [ -n "$revn" ] && [ "$revn" -ge 3 ] 2>/dev/null && echo "ALERT $(date +%T) REVERT-LOOP x$rev <<orphan-dir? clear worktree>>"
    # match ACTUAL kill events, not branch/worktree names that merely contain the marker
    # substring (same false-positive class as the EACCES bug H2 fixes).
    kills=$(printf '%s\n' "$new" | grep -avE 'Worktree added|branch task/|AutoPickup|slot admission' \
      | grep -aiE 'terminating run|Killed codex process|reason=EnvironmentBlocker|watchdog.*killed after|killed after [0-9]+s' | head -1)
    [ -n "$kills" ] && echo "ALERT $(date +%T) KILL: $(printf '%s' "$kills" | sed 's/^ *//' | cut -c1-100)"
  fi
  if [ "$breaker" != "None" ] && [ "$breaker" != "ERR" ] && [ -n "$breaker" ]; then
    echo "ALERT $(date +%T) breaker=$breaker slots=$slots mode=$mode"
  fi
  if [ "$head" != "$lasthead" ]; then
    nfiles=$(git -C "$DEV" show --stat --format= $head 2>/dev/null | tail -1 | tr -s ' ')
    msg=$(git -C "$DEV" log -1 --format='%s' $head 2>/dev/null | head -c 64)
    fc=$(git -C "$DEV" show --stat --format= $head 2>/dev/null | grep -cE '\|')
    flag=""; [ "$fc" -gt 25 ] 2>/dev/null && flag=" <<MEGA-BLOB? inspect>>"
    echo "COMMIT $(date +%T) ${head:0:8} ($nfiles)$flag : $msg"
    lasthead=$head
  fi
  if [ $((now-lastbeat)) -ge 240 ]; then
    lastbeat=$now
    echo "BEAT $(date +%T) slots=$slots/$maxp breaker=$breaker mode=$mode active=$active"
  fi
  [ "$el" -ge "$MAX" ] && { echo "SUPER-END $(date +%T) elapsed=${el}s"; exit 0; }
  sleep 60
done
