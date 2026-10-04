#!/usr/bin/env bash
# Run on the remote executor only. All release operations use isolated fixtures.
set -euo pipefail
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/artifact-preflight.XXXXXX")"
cleanup() {
  case "$TEST_ROOT" in "${TMPDIR:-/tmp}"/artifact-preflight.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT
export FIXTURE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

fixture() {
  CASE_ROOT="$TEST_ROOT/$1"
  mkdir -p "$CASE_ROOT/agent-taskboard-stable/frontend" "$CASE_ROOT/fake-bin" "$CASE_ROOT/input/backend" "$CASE_ROOT/input/frontend" "$CASE_ROOT/release"
  cp "$SOURCE_ROOT/update-stable.sh" "$SOURCE_ROOT/fetch-remote-artifacts.sh" "$SOURCE_ROOT/remote-execution.sh" "$CASE_ROOT/"
  chmod +x "$CASE_ROOT/"*.sh
  export FIXTURE_CASE="$CASE_ROOT"
  cat > "$CASE_ROOT/.remote-execution.env" <<'ENV'
export RemoteGate__SshHost=fixture-host
export RemoteGate__WorkerPath=/fixture/worker/OrchestratorApi.dll
export REMOTE_RELEASE_ROOT=/fixture/releases
ENV
  cat > "$CASE_ROOT/fake-bin/git" <<'GIT'
#!/usr/bin/env bash
case "$*" in
  *"rev-parse --abbrev-ref HEAD") echo main ;;
  *"status --porcelain --untracked-files=no") ;;
  *"fetch origin main") ;;
  *"rev-parse origin/main") echo "$FIXTURE_SHA" ;;
  *"merge-base --is-ancestor HEAD "*) ;;
  *"merge --ff-only "*) touch "$FIXTURE_CASE/merged" ;;
  *"log -1 --format="*) echo "$FIXTURE_SHA fixture" ;;
  *) echo "Unexpected git invocation: $*" >&2; exit 1 ;;
esac
GIT
  cat > "$CASE_ROOT/fake-bin/scp" <<'SCP'
#!/usr/bin/env bash
set -euo pipefail
source_arg="${@: -2:1}"
cp "$FIXTURE_CASE/release/${source_arg##*/}" "${@: -1}"
SCP
  cat > "$CASE_ROOT/fake-bin/curl" <<'CURL'
#!/usr/bin/env bash
printf '{"projects":[{"activeJobId":null}]}'
CURL
  cat > "$CASE_ROOT/fake-bin/dotnet" <<'DOTNET'
#!/usr/bin/env bash
echo "Unexpected local build or runtime invocation in preflight" >&2
exit 1
DOTNET
  cat > "$CASE_ROOT/stop-stable.sh" <<'STOP'
#!/usr/bin/env bash
touch "$FIXTURE_CASE/stopped"
STOP
  cat > "$CASE_ROOT/start-stable.sh" <<'START'
#!/usr/bin/env bash
touch "$FIXTURE_CASE/started"
START
  chmod +x "$CASE_ROOT/fake-bin/"* "$CASE_ROOT/stop-stable.sh" "$CASE_ROOT/start-stable.sh"
  for component in backend frontend; do
    printf '%s\n' "$FIXTURE_SHA" > "$CASE_ROOT/input/$component/RELEASE-SHA"
    printf 'PROMOTION_FULL_GATE=passed:%s\n' "$FIXTURE_SHA" > "$CASE_ROOT/input/$component/FULL-GATE"
  done
  printf fixture > "$CASE_ROOT/input/backend/OrchestratorApi.dll"
  printf '{}' > "$CASE_ROOT/input/backend/OrchestratorApi.deps.json"
  printf '{}' > "$CASE_ROOT/input/backend/OrchestratorApi.runtimeconfig.json"
  printf '<title>fixture</title>' > "$CASE_ROOT/input/frontend/index.html"
}
pack() {
  tar -czf "$CASE_ROOT/release/release.tar.gz" -C "$CASE_ROOT/input" backend frontend
  sha256sum "$CASE_ROOT/release/release.tar.gz" | cut -d ' ' -f1 > "$CASE_ROOT/release/release.sha256"
}
run_update() {
  env -u Release__BuildManifestPath -u ATP_BUILD_MANIFEST PATH="$CASE_ROOT/fake-bin:$PATH" bash "$CASE_ROOT/update-stable.sh" > "$CASE_ROOT/result.log" 2>&1
}
assert_refused() {
  local message="$1"
  if run_update; then echo "FAIL: Accepted $message" >&2; cat "$CASE_ROOT/result.log"; exit 1; fi
  for marker in stopped merged started; do
    [[ ! -e "$CASE_ROOT/$marker" ]] || { echo "FAIL: $message reached $marker" >&2; exit 1; }
  done
  echo "PASS: $message refused before stop"
}
for name in OrchestratorApi.deps.json OrchestratorApi.runtimeconfig.json; do
  fixture "missing-$name"
  rm "$CASE_ROOT/input/backend/$name"
  pack
  assert_refused "missing $name"
done
fixture empty-runtime
: > "$CASE_ROOT/input/backend/OrchestratorApi.dll"
pack
assert_refused "empty runtime"
fixture wrong-manifest
printf '{"commit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' > "$CASE_ROOT/input/backend/build-manifest.json"
pack
assert_refused "mismatched build manifest"
fixture malformed-manifest
printf invalid > "$CASE_ROOT/input/backend/build-manifest.json"
pack
assert_refused "malformed build manifest"
fixture wrong-proof
printf 'PROMOTION_FULL_GATE=passed:other\n' > "$CASE_ROOT/input/frontend/FULL-GATE"
pack
assert_refused "mismatched full gate proof"
fixture wrong-digest
pack
printf '%064d\n' 0 > "$CASE_ROOT/release/release.sha256"
assert_refused "checksum mismatch"
fixture archive-link
ln -s /fixture/outside "$CASE_ROOT/input/frontend/link"
pack
assert_refused "archive symlink"
fixture existing-release
pack
installed="$CASE_ROOT/agent-taskboard-stable/backend/bin/remote-publish/$FIXTURE_SHA"
mkdir -p "$installed"
printf running > "$installed/OrchestratorApi.dll"
assert_refused "different existing immutable release"
[[ "$(cat "$installed/OrchestratorApi.dll")" == running ]] || { echo "FAIL: Existing runtime was overwritten"; exit 1; }
fixture valid-release
printf '{"commit":"%s"}' "$FIXTURE_SHA" > "$CASE_ROOT/input/backend/build-manifest.json"
pack
run_update || { cat "$CASE_ROOT/result.log"; exit 1; }
for marker in stopped merged started; do
  [[ -e "$CASE_ROOT/$marker" ]] || { echo "FAIL: Valid release did not reach $marker"; exit 1; }
done
for component in backend frontend; do
  if [[ "$component" == backend ]]; then output=backend/bin; else output=frontend/dist; fi
  diff -qr "$CASE_ROOT/input/$component" "$CASE_ROOT/agent-taskboard-stable/$output/remote-publish/$FIXTURE_SHA"
done
echo "PASS: Valid release installs complete artifacts and restarts"
run_update || { cat "$CASE_ROOT/result.log"; exit 1; }
echo "PASS: Identical immutable release may be reused"
# Exercise transient Windows rename locks without waiting or moving real releases.
move_fixture() {
  export FIXTURE_REAL_MV
  FIXTURE_REAL_MV="$(command -v mv)"
  cat > "$CASE_ROOT/fake-bin/mv" <<'MV'
#!/usr/bin/env bash
set -euo pipefail
source_arg="${@: -2:1}"
destination="${@: -1}"
component="${source_arg##*/}"
count_file="$FIXTURE_CASE/mv-$component-attempts"
count=0
[[ ! -f "$count_file" ]] || count="$(cat "$count_file")"
count=$((count + 1))
printf '%s\n' "$count" > "$count_file"
if [[ "${FIXTURE_MOVE_RACE:-0}" == 1 && "$component" == backend ]]; then
  mkdir -p "$destination"
  printf concurrent > "$destination/OrchestratorApi.dll"
  echo 'mv: fixture concurrent destination' >&2
  exit 1
fi
if (( count <= FIXTURE_MOVE_FAILURES )); then
  echo 'mv: fixture Permission denied' >&2
  exit 1
fi
exec "$FIXTURE_REAL_MV" "$@"
MV
  cat > "$CASE_ROOT/fake-bin/sleep" <<'SLEEP'
#!/usr/bin/env bash
[[ "$*" == 1 ]] || { echo "Unexpected retry delay: $*" >&2; exit 1; }
printf '%s\n' "$*" >> "$FIXTURE_CASE/retry-delays"
SLEEP
  chmod +x "$CASE_ROOT/fake-bin/mv" "$CASE_ROOT/fake-bin/sleep"
}
fixture transient-move-lock
export FIXTURE_MOVE_FAILURES=2 FIXTURE_MOVE_RACE=0
move_fixture
pack
run_update || { echo 'FAIL: Transient artifact lock was not retried' >&2; cat "$CASE_ROOT/result.log"; exit 1; }
for component in backend frontend; do
  [[ "$(cat "$CASE_ROOT/mv-$component-attempts")" == 3 ]] || { echo "FAIL: Incorrect $component retry count" >&2; exit 1; }
  if [[ "$component" == backend ]]; then output=backend/bin; else output=frontend/dist; fi
  diff -qr "$CASE_ROOT/input/$component" "$CASE_ROOT/agent-taskboard-stable/$output/remote-publish/$FIXTURE_SHA"
done
[[ "$(wc -l < "$CASE_ROOT/retry-delays")" == 4 ]] || { echo 'FAIL: Incorrect retry delay count' >&2; exit 1; }
echo 'PASS: Transient artifact locks retry with bounded one-second delays'
fixture permanent-move-lock
export FIXTURE_MOVE_FAILURES=99 FIXTURE_MOVE_RACE=0
move_fixture
pack
assert_refused 'persistent artifact lock'
[[ "$(cat "$CASE_ROOT/mv-backend-attempts")" == 5 ]] || { echo 'FAIL: Persistent lock did not stop after five attempts' >&2; exit 1; }
[[ "$(wc -l < "$CASE_ROOT/retry-delays")" == 4 ]] || { echo 'FAIL: Persistent lock delay is not bounded' >&2; exit 1; }
fixture concurrent-release
export FIXTURE_MOVE_FAILURES=0 FIXTURE_MOVE_RACE=1
move_fixture
pack
assert_refused 'concurrently created immutable release'
installed="$CASE_ROOT/agent-taskboard-stable/backend/bin/remote-publish/$FIXTURE_SHA"
[[ "$(cat "$installed/OrchestratorApi.dll")" == concurrent ]] || { echo 'FAIL: Concurrent immutable runtime was overwritten' >&2; exit 1; }
[[ "$(cat "$CASE_ROOT/mv-backend-attempts")" == 1 ]] || { echo 'FAIL: Retried rename over concurrent immutable release' >&2; exit 1; }
echo 'PASS: Concurrent immutable destination is preserved'
echo "All artifact preflight contract tests passed."
