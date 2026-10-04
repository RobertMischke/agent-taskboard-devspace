#!/usr/bin/env bash
# Execute only on the remote executor. No real backend or watchdog is touched.
set -euo pipefail
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/watchdog-prebuilt.XXXXXX")"
active_pid=""
cleanup() {
  if [[ -n "$active_pid" ]]; then kill "$active_pid" 2>/dev/null || true; wait "$active_pid" 2>/dev/null || true; fi
  case "$TEST_ROOT" in "${TMPDIR:-/tmp}"/watchdog-prebuilt.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT
export FIXTURE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

fixture() {
  CASE_ROOT="$TEST_ROOT/$1"
  mkdir -p "$CASE_ROOT/agent-taskboard-stable/backend/bin/remote-publish/$FIXTURE_SHA" "$CASE_ROOT/fake-bin"
  cp "$SOURCE_ROOT/watchdog-stable.sh" "$CASE_ROOT/"
  printf 'export API_REQUIRE_PREBUILT=1\n' > "$CASE_ROOT/remote-execution.sh"
  export FIXTURE_CASE="$CASE_ROOT"
  cat > "$CASE_ROOT/fake-bin/git" <<'GIT'
#!/usr/bin/env bash
printf '%s\n' "$FIXTURE_SHA"
GIT
  cat > "$CASE_ROOT/fake-bin/curl" <<'CURL'
#!/usr/bin/env bash
count=0
[[ ! -f "$FIXTURE_CASE/probes" ]] || count="$(cat "$FIXTURE_CASE/probes")"
count=$((count + 1))
printf '%s\n' "$count" > "$FIXTURE_CASE/probes"
if [[ -e "$FIXTURE_CASE/maintenance-during-probe" && "$count" -eq 3 ]]; then
  touch "$FIXTURE_CASE/.stable-maintenance"
fi
printf 503
CURL
  cat > "$CASE_ROOT/fake-bin/sleep" <<'SLEEP'
#!/usr/bin/env bash
count=0
[[ ! -f "$FIXTURE_CASE/ticks" ]] || count="$(cat "$FIXTURE_CASE/ticks")"
count=$((count + 1))
printf '%s\n' "$count" > "$FIXTURE_CASE/ticks"
# Stop only this fixture's parent watchdog after four deterministic ticks.
if [[ "$count" -ge 4 ]]; then kill -TERM "$PPID"; fi
SLEEP
  cat > "$CASE_ROOT/agent-taskboard-stable/api.sh" <<'API'
#!/usr/bin/env bash
# api-prebuilt-required: fixture implements the prebuilt launcher contract.
printf '%s\n' "$*" > "$FIXTURE_CASE/api-args"
printf '%s\n' "$API_PREBUILT_DIR" > "$FIXTURE_CASE/api-artifact"
printf '%s\n' "$API_REQUIRE_PREBUILT" > "$FIXTURE_CASE/api-required"
API
  chmod +x "$CASE_ROOT/fake-bin/"* "$CASE_ROOT/agent-taskboard-stable/api.sh"
  ARTIFACT="$CASE_ROOT/agent-taskboard-stable/backend/bin/remote-publish/$FIXTURE_SHA"
  printf '%s\n' "$FIXTURE_SHA" > "$ARTIFACT/RELEASE-SHA"
  printf 'PROMOTION_FULL_GATE=passed:%s\n' "$FIXTURE_SHA" > "$ARTIFACT/FULL-GATE"
  for file in OrchestratorApi.dll OrchestratorApi.deps.json OrchestratorApi.runtimeconfig.json; do
    printf fixture > "$ARTIFACT/$file"
  done
}
run_watchdog() {
  env -u STABLE_MAINTENANCE_FILE PATH="$CASE_ROOT/fake-bin:$PATH" WATCHDOG_INTERVAL=0 \
    bash "$CASE_ROOT/watchdog-stable.sh" > "$CASE_ROOT/output.log" 2>&1 &
  active_pid=$!
  wait "$active_pid" 2>/dev/null || true
  active_pid=""
}
assert_not_started() {
  [[ ! -e "$CASE_ROOT/api-args" ]] || { echo "FAIL: $1 started api.sh" >&2; exit 1; }
  echo "PASS: $1"
}
fixture maintenance
touch "$CASE_ROOT/.stable-maintenance"
run_watchdog
[[ ! -e "$CASE_ROOT/probes" ]] || { echo "FAIL: Maintenance still probes the backend" >&2; exit 1; }
assert_not_started "maintenance suppresses probes and restart"

fixture maintenance-race
touch "$CASE_ROOT/maintenance-during-probe"
run_watchdog
assert_not_started "maintenance appearing during the third probe blocks restart"

fixture missing-artifact
rm "$ARTIFACT/OrchestratorApi.dll"
run_watchdog
assert_not_started "missing DLL blocks restart"

fixture incomplete-runtime
rm "$ARTIFACT/OrchestratorApi.runtimeconfig.json"
run_watchdog
assert_not_started "incomplete runtime blocks restart"

fixture wrong-sha
printf '%040d\n' 0 > "$ARTIFACT/RELEASE-SHA"
run_watchdog
assert_not_started "mismatched release SHA blocks restart"

fixture wrong-gate
printf 'PROMOTION_FULL_GATE=passed:other\n' > "$ARTIFACT/FULL-GATE"
run_watchdog
assert_not_started "mismatched full gate proof blocks restart"

fixture old-api
sed '/api-prebuilt-required:/d' "$CASE_ROOT/agent-taskboard-stable/api.sh" > "$CASE_ROOT/old-api"
mv "$CASE_ROOT/old-api" "$CASE_ROOT/agent-taskboard-stable/api.sh"
chmod +x "$CASE_ROOT/agent-taskboard-stable/api.sh"
run_watchdog
assert_not_started "legacy API without prebuilt support blocks restart"

fixture valid-release
run_watchdog
[[ "$(cat "$CASE_ROOT/api-args")" == start ]]
[[ "$(cat "$CASE_ROOT/api-artifact")" == "$ARTIFACT" ]]
[[ "$(cat "$CASE_ROOT/api-required")" == 1 ]]
echo "PASS: verified release restarts through the prebuilt-only API contract"
echo "All watchdog maintenance and prebuilt contracts passed."
