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
echo "All artifact preflight contract tests passed."
