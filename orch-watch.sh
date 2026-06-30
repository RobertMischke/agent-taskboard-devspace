#!/usr/bin/env bash
# Engmaschig (close) in-flight monitor for the active ASS codex run.
# Emits a periodic TICK (visibility) + DONE on completion. Codex works
# SILENTLY (edits files without recognized stdout), so liveness = dirty-file
# growth / commits, NOT stdout. Be patient: judge by produced work, not silence.
# Usage: orch-watch.sh <slug> <baselineHead> [maxSeconds] [tickSeconds]
SLUG="$1"; BASE="$2"; MAX="${3:-2400}"; TICK="${4:-150}"
DEV=/c/Projects/agent-taskboard-devspace/agent-taskboard-dev
STATUS_URL="http://localhost:5031/api/runner/status"
TASKS_URL="http://localhost:5031/api/tasks"
start=$(date +%s); lasttick=0
active_of(){ curl -s -m 8 "$STATUS_URL" 2>/dev/null | python -c "
import sys,json
try:
 d=json.load(sys.stdin);print(d['projects']['Agent Task Processor'].get('activeJobId') or '')
except Exception:print('__ERR__')"; }
state_of(){ curl -s -m 8 "$TASKS_URL" 2>/dev/null | python -c "
import sys,json
slug='$SLUG'
try:
 d=json.load(sys.stdin);ts=d if isinstance(d,list) else d.get('tasks',[])
 for t in ts:
  if t.get('id')==slug:print(t.get('state') or '?');break
 else:print('?')
except Exception:print('__ERR__')"; }
dirty(){ git -C "$DEV" status --porcelain 2>/dev/null | grep -c . ; }
echo "WATCH-START $(date +%T) slug=$SLUG base=${BASE:0:8} max=${MAX}s tick=${TICK}s"
while true; do
  now=$(date +%s); el=$((now-start)); a=$(active_of)
  if [ "$a" != "$SLUG" ] && [ "$a" != "__ERR__" ]; then
    st=$(state_of); head=$(git -C "$DEV" rev-parse HEAD); cnt=$(git -C "$DEV" rev-list --count ${BASE}..HEAD 2>/dev/null); dc=$(dirty)
    echo "DONE $(date +%T) elapsed=${el}s state=$st devHEAD=${head:0:8} commits=$cnt dirty=$dc activeNow='$a'"
    git -C "$DEV" log --oneline ${BASE}..HEAD 2>/dev/null | head -6
    exit 0
  fi
  if [ $((now-lasttick)) -ge "$TICK" ]; then
    lasttick=$now
    echo "TICK $(date +%T) age=${el}s dirty=$(dirty) (codex works silently; dirty>0 or commit = real progress)"
  fi
  if [ "$el" -ge "$MAX" ]; then echo "MAX $(date +%T) elapsed=${el}s dirty=$(dirty) still-active (backstop)"; exit 2; fi
  sleep 25
done
