#!/usr/bin/env bash
# Run on the remote executor; simulate shell names without native Windows tools.
set -euo pipefail
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/remote-environment.XXXXXX")"
cleanup() {
  case "$TEST_ROOT" in "${TMPDIR:-/tmp}"/remote-environment.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT
cp "$SOURCE_ROOT/remote-execution.sh" "$TEST_ROOT/remote-execution.sh"
mkdir "$TEST_ROOT/bin"
cat > "$TEST_ROOT/bin/uname" <<'UNAME'
#!/usr/bin/env bash
printf '%s\n' "$FIXTURE_UNAME"
UNAME
chmod +x "$TEST_ROOT/bin/uname"
export TEST_ROOT
for shell_name in MINGW64_NT-10.0 MSYS_NT-10.0 CYGWIN_NT-10.0; do
  env -u MSYS2_ENV_CONV_EXCL FIXTURE_UNAME="$shell_name" PATH="$TEST_ROOT/bin:$PATH" bash -c '
    set -euo pipefail
    source "$TEST_ROOT/remote-execution.sh"
    [[ "$MSYS2_ENV_CONV_EXCL" == "RemoteGate__WorkerPath;RemoteGate__Root" ]]
  ' || { echo "FAIL: Missing targeted remote path exclusions on $shell_name" >&2; exit 1; }
  echo "PASS: Targeted remote path exclusions on $shell_name"
done
env FIXTURE_UNAME=MINGW64_NT-10.0 MSYS2_ENV_CONV_EXCL='Existing;Other' MSYS2_ARG_CONV_EXCL='existing-arg-rule' PATH="$TEST_ROOT/bin:$PATH" bash -c '
  set -euo pipefail
  source "$TEST_ROOT/remote-execution.sh"
  [[ "$MSYS2_ENV_CONV_EXCL" == "Existing;Other;RemoteGate__WorkerPath;RemoteGate__Root" ]]
  [[ "$MSYS2_ARG_CONV_EXCL" == existing-arg-rule ]]
' || { echo 'FAIL: Existing environment or argument conversion policy changed' >&2; exit 1; }
echo 'PASS: Existing environment exclusions and argument policy are preserved'
env FIXTURE_UNAME=MSYS_NT-10.0 MSYS2_ENV_CONV_EXCL='RemoteGate__WorkerPath;Existing' PATH="$TEST_ROOT/bin:$PATH" bash -c '
  set -euo pipefail
  source "$TEST_ROOT/remote-execution.sh"
  source "$TEST_ROOT/remote-execution.sh"
  [[ "$MSYS2_ENV_CONV_EXCL" == "RemoteGate__WorkerPath;Existing;RemoteGate__Root" ]]
' || { echo 'FAIL: Repeated sourcing duplicated or removed exclusions' >&2; exit 1; }
echo 'PASS: Repeated sourcing keeps exclusions stable'
env FIXTURE_UNAME=Linux MSYS2_ENV_CONV_EXCL='Existing' PATH="$TEST_ROOT/bin:$PATH" bash -c '
  set -euo pipefail
  source "$TEST_ROOT/remote-execution.sh"
  [[ "$MSYS2_ENV_CONV_EXCL" == Existing ]]
' || { echo 'FAIL: Linux conversion policy changed' >&2; exit 1; }
echo 'PASS: Linux environment policy is unchanged'
echo 'All remote environment contract tests passed.'
