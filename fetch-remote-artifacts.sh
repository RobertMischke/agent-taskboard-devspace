#!/usr/bin/env bash
# Fetch the exact, remotely verified release before stopping the workstation.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
. "${ROOT_DIR}/remote-execution.sh"
SHA="${1:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "ERROR: Expected full release SHA." >&2; exit 1; }
: "${REMOTE_RELEASE_ROOT:?Configure REMOTE_RELEASE_ROOT in .remote-execution.env}"
: "${RemoteGate__WorkerPath:?Configure RemoteGate__WorkerPath before deployment}"
[[ "${REMOTE_RELEASE_ROOT}" =~ ^/[a-zA-Z0-9_./-]+$ && "${RemoteGate__SshHost}" =~ ^[a-zA-Z0-9_.@-]+$ && "${RemoteGate__SshHost}" != -* ]] || { echo "ERROR: Invalid remote artifact configuration." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required to validate and serve remote artifacts." >&2; exit 1; }
command -v dotnet >/dev/null 2>&1 || { echo "ERROR: The .NET runtime is required to start remote artifacts." >&2; exit 1; }
STAGING="${ROOT_DIR}/.remote-artifacts/${SHA}"
mkdir -p "${STAGING}"
DOWNLOAD="$(mktemp -d "${STAGING}/download.XXXXXX")"
cleanup() {
  # Only remove this invocation's verified child path, never a release directory.
  case "$DOWNLOAD" in "$STAGING"/download.*) rm -rf -- "$DOWNLOAD" ;; esac
}
trap cleanup EXIT
scp -q -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 "${RemoteGate__SshHost}:${REMOTE_RELEASE_ROOT}/${SHA}/release.tar.gz" "${DOWNLOAD}/release.tar.gz"
scp -q -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 "${RemoteGate__SshHost}:${REMOTE_RELEASE_ROOT}/${SHA}/release.sha256" "${DOWNLOAD}/release.sha256"
DIGEST="$(tr -d '\r\n' < "${DOWNLOAD}/release.sha256")"
[[ "$DIGEST" =~ ^[0-9a-f]{64}$ ]] || { echo "ERROR: Invalid artifact checksum." >&2; exit 1; }
[[ "$(sha256sum "${DOWNLOAD}/release.tar.gz" | cut -d ' ' -f1)" == "$DIGEST" ]] || { echo "ERROR: Artifact checksum mismatch." >&2; exit 1; }
# Reject archive links and any path outside the two generated output trees.
tar --force-local -tzf "${DOWNLOAD}/release.tar.gz" > "${DOWNLOAD}/archive-files"
while IFS= read -r entry; do
  [[ "$entry" == backend/* || "$entry" == frontend/* ]] || { echo "ERROR: Unexpected archive path: $entry" >&2; exit 1; }
  [[ "$entry" != *'..'* && "$entry" != *'\'* ]] || { echo "ERROR: Unsafe archive path." >&2; exit 1; }
done < "${DOWNLOAD}/archive-files"
if tar --force-local -tvzf "${DOWNLOAD}/release.tar.gz" | grep -E '^[^d-]' >/dev/null; then
  echo "ERROR: Release archives must not contain links or special files." >&2; exit 1
fi
UNPACK="${DOWNLOAD}/unpack"
mkdir "$UNPACK"
tar --force-local -xzf "${DOWNLOAD}/release.tar.gz" -C "$UNPACK" --no-same-owner
for component in backend frontend; do
  [[ "$(tr -d '\r\n' < "$UNPACK/$component/RELEASE-SHA")" == "$SHA" ]] || { echo "ERROR: Component release SHA mismatch." >&2; exit 1; }
  [[ "$(tr -d '\r\n' < "$UNPACK/$component/FULL-GATE")" == "PROMOTION_FULL_GATE=passed:$SHA" ]] || { echo "ERROR: Exact-commit full gate proof missing." >&2; exit 1; }
done
# Match api.sh's startup validation before the updater stops a healthy backend.
node - "$UNPACK" "$SHA" "${ROOT_DIR}/agent-taskboard-stable" "${Release__BuildManifestPath:-${ATP_BUILD_MANIFEST:-}}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [unpack, sha, checkout, overrideManifest] = process.argv.slice(2);
try {
  for (const name of ['backend/OrchestratorApi.dll', 'backend/OrchestratorApi.deps.json', 'backend/OrchestratorApi.runtimeconfig.json', 'frontend/index.html']) {
    const stat = fs.statSync(path.join(unpack, name));
    if (!stat.isFile() || stat.size === 0) throw new Error('Missing or empty runtime file: ' + name);
  }
  const manifests = [path.join(unpack, 'backend', 'build-manifest.json')];
  if (overrideManifest) {
    const explicit = path.resolve(checkout, 'backend', overrideManifest);
    if (!fs.existsSync(explicit)) throw new Error('Explicit build manifest is missing');
    manifests.push(explicit);
  }
  for (const file of manifests) {
    if (!fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (typeof manifest.commit !== 'string' || manifest.commit.toLowerCase() !== sha)
      throw new Error('Build manifest commit does not match release SHA');
  }
} catch (error) {
  console.error('ERROR: remote-artifact-invalid: ' + error.message);
  process.exit(1);
}
NODE
BACKEND="${ROOT_DIR}/agent-taskboard-stable/backend/bin/remote-publish/${SHA}"
FRONTEND="${ROOT_DIR}/agent-taskboard-stable/frontend/dist/remote-publish/${SHA}"
# Never overwrite an immutable release, which may currently be executing.
# Check both destinations before installing either component.
for component in backend frontend; do
  if [[ "$component" == backend ]]; then destination="$BACKEND"; else destination="$FRONTEND"; fi
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -d "$destination" && ! -L "$destination" ]] && diff -qr -- "$UNPACK/$component" "$destination" >/dev/null || {
      echo "ERROR: Existing $component artifacts differ for immutable release $SHA." >&2; exit 1;
    }
  fi
done
for component in backend frontend; do
  if [[ "$component" == backend ]]; then destination="$BACKEND"; else destination="$FRONTEND"; fi
  if [[ ! -d "$destination" ]]; then
    mkdir -p "$(dirname "$destination")"
    mv -T -- "$UNPACK/$component" "$destination"
  fi
done
echo "Verified remote artifacts staged for $SHA."
