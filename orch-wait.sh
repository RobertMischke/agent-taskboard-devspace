#!/usr/bin/env bash
# Orchestrator completion watcher.
# Usage: orch-wait.sh <slug> <baselineHead> [maxSeconds]
# Exits (one notification) when the ASS active job is no longer <slug>
# (run finished — manual mode does not auto-pick another), or on watchdog timeout.
SLUG="$1"; BASE="$2"; MAX="${3:-3000}"
DEV=/c/Projects/agent-taskboard-devspace/agent-taskboard-dev
STATUS_URL="http://localhost:5031/api/runner/status"
TASKS_URL="http://localhost:5031/api/tasks"
start=$(date +%s)
active_of() {
  curl -s -m 8 "$STATUS_URL" 2>/dev/null | python -c "
import sys,json
try:
    d=json.load(sys.stdin); print(d['projects']['Agent Task Processor'].get('activeJobId') or '')
except Exception: print('__ERR__')
"
}
state_of() {
  curl -s -m 8 "$TASKS_URL" 2>/dev/null | python -c "
import sys,json
slug='$SLUG'
try:
    d=json.load(sys.stdin); ts=d if isinstance(d,list) else d.get('tasks',[])
    for t in ts:
        if t.get('id')==slug: print(t.get('state') or '?'); break
    else: print('?')
except Exception: print('__ERR__')
"
}
echo "WAIT-START $(date +%T) slug=$SLUG base=${BASE:0:8} max=${MAX}s"
while true; do
  now=$(date +%s); el=$((now-start))
  a=$(active_of)
  if [ "$a" != "$SLUG" ] && [ "$a" != "__ERR__" ]; then
    st=$(state_of)
    head=$(git -C $DEV rev-parse HEAD)
    cnt=$(git -C $DEV rev-list --count ${BASE}..HEAD 2>/dev/null)
    echo "DONE $(date +%T) elapsed=${el}s state=$st activeNow='$a' devHEAD=${head:0:8} commits_since_base=$cnt"
    git -C $DEV log --oneline ${BASE}..HEAD 2>/dev/null | head -10
    exit 0
  fi
  if [ "$el" -ge "$MAX" ]; then
    st=$(state_of)
    echo "WEDGE $(date +%T) elapsed=${el}s state=$st still-active=$a (watchdog timeout)"
    exit 2
  fi
  sleep 30
done
