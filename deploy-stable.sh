#!/usr/bin/env bash
# Atomic, health-gated deploy of new work into the stable (Integrated/Running)
# checkout — with automatic rollback to the last known-good commit.
#
# Closes the 2026-06-07 incident gap: the old deploy path stopped the running
# backend and started the new build with NO rollback, so a build that compiled
# but crashed at startup (the inferred-body endpoint) left stable dead. This
# script makes a deploy a transaction:
#
#   1. Preflight        — stable checkout clean.
#   2. Record KNOWN_GOOD — the current stable HEAD (rollback target).
#   3. Fast-forward      — merge the source ref (default origin/<branch>).
#   4. PRE-BUILD GATE    — dotnet build the backend BEFORE stopping anything.
#                          A compile failure rolls the worktree back and aborts
#                          with the old backend still running (zero downtime).
#   5. Restart           — stop-stable + start-stable; api.sh's /healthz gate
#                          decides success (compiles != starts is caught here).
#   6. AUTO-ROLLBACK     — if the health gate fails, reset --hard KNOWN_GOOD and
#                          restart the known-good build, then report FAILURE.
#
# Usage:
#   ./deploy-stable.sh [<source-ref>]
#       source-ref defaults to origin/<stable's current branch>.
#   SKIP_FETCH=1   deploy what is already in the worktree (no fetch/merge).
#   SKIP_FE_INSTALL=1  skip the npm install even if the lock changed.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CHECKOUT="${ROOT_DIR}/agent-taskboard-stable"
FRONTEND="${CHECKOUT}/frontend"
LOCK="${FRONTEND}/package-lock.json"

# Build-server suppression so the deploy's own dotnet build does not leak the
# persistent MSBuild/compiler nodes this whole hardening effort is removing.
export MSBUILDDISABLENODEREUSE=1
export DOTNET_CLI_USE_MSBUILD_SERVER=0
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

section() { echo; echo "=================================================="; echo "  $1"; echo "=================================================="; }
fail()    { echo "DEPLOY FAILED: $1" >&2; exit 1; }

# ─── preflight ───────────────────────────────────────────────────────────────
section "Preflight"
[[ -d "${CHECKOUT}" ]] || fail "stable checkout missing: ${CHECKOUT}"

dirty="$(git -C "${CHECKOUT}" status --porcelain --untracked-files=no)"
if [[ -n "${dirty}" ]]; then
  echo "${dirty}" >&2
  fail "stable checkout has uncommitted changes; refusing to deploy onto a dirty tree."
fi

branch="$(git -C "${CHECKOUT}" rev-parse --abbrev-ref HEAD)"
KNOWN_GOOD="$(git -C "${CHECKOUT}" rev-parse HEAD)"
SOURCE_REF="${1:-origin/${branch}}"
echo "  Branch     : ${branch}"
echo "  Known-good : ${KNOWN_GOOD}"
echo "  Source ref : ${SOURCE_REF}"

# ─── fast-forward to the source ref ──────────────────────────────────────────
if [[ "${SKIP_FETCH:-0}" != "1" ]]; then
  section "Fast-forwarding ${branch} -> ${SOURCE_REF}"
  git -C "${CHECKOUT}" fetch origin || fail "git fetch failed"
  if ! git -C "${CHECKOUT}" merge --ff-only "${SOURCE_REF}"; then
    git -C "${CHECKOUT}" merge --abort 2>/dev/null || true
    fail "cannot fast-forward ${branch} to ${SOURCE_REF} (diverged?). No changes made."
  fi
fi
TARGET="$(git -C "${CHECKOUT}" rev-parse HEAD)"
echo "  Target     : ${TARGET}"
if [[ "${TARGET}" == "${KNOWN_GOOD}" ]]; then
  echo "  Already up to date; nothing to deploy."
fi

# ─── rollback helper ─────────────────────────────────────────────────────────
rollback() {
  section "AUTO-ROLLBACK to known-good ${KNOWN_GOOD}"
  git -C "${CHECKOUT}" reset --hard "${KNOWN_GOOD}" || echo "WARN: reset --hard failed" >&2
}

# Stop-then-start: api.sh start is idempotent ("skip if already healthy"), so a
# bare start would leave the OLD process running and never load the new build.
# Stopping first guarantees the new binary is the one that faces the health gate.
restart_stable() {
  "${ROOT_DIR}/stop-stable.sh" >/dev/null 2>&1 || true
  DETACH=1 "${ROOT_DIR}/start-stable.sh"
}

# ─── pre-build gate (zero-downtime compile check) ────────────────────────────
# Compile the backend on the NEW tree while the OLD backend is still serving.
# A compile error here means we never stop the running service.
section "Pre-build gate (dotnet build to isolated output) — old backend still serving"
# Build to a throwaway output dir. On Windows the RUNNING backend holds a lock
# on its own bin/Debug DLLs, so an in-place build fails with MSB3021 even when
# the code is perfectly fine. -o isolates every output so this stays a pure
# compile check that never collides with the live process.
BUILD_CHECK_DIR="${CHECKOUT}/.deploy-build-check"
rm -rf "${BUILD_CHECK_DIR}" 2>/dev/null || true
if ! dotnet build "${CHECKOUT}/backend/OrchestratorApi.csproj" -nologo -v q -o "${BUILD_CHECK_DIR}"; then
  rm -rf "${BUILD_CHECK_DIR}" 2>/dev/null || true
  rollback
  fail "backend pre-build failed on ${TARGET}; rolled the worktree back, running backend untouched."
fi
rm -rf "${BUILD_CHECK_DIR}" 2>/dev/null || true
echo "  Backend compiles."

# npm install only if the frontend lock changed in this fast-forward.
if [[ "${SKIP_FE_INSTALL:-0}" != "1" && "${TARGET}" != "${KNOWN_GOOD}" ]]; then
  if ! git -C "${CHECKOUT}" diff --quiet "${KNOWN_GOOD}" "${TARGET}" -- "frontend/package-lock.json"; then
    section "npm install (frontend lock changed)"
    if ! ( cd "${FRONTEND}" && npm install ); then
      rollback
      fail "npm install failed on ${TARGET}; rolled back, running backend untouched."
    fi
  fi
fi

# ─── restart with health gate ────────────────────────────────────────────────
section "Restart stable (stop -> start; api.sh /healthz is the gate)"
if restart_stable; then
  section "DEPLOY OK"
  echo "  stable now at ${TARGET}"
  git -C "${CHECKOUT}" log -1 --format='  %h %s' "${TARGET}"
  exit 0
fi

# Health gate failed: the new build started but did not become healthy (a
# startup crash that compiled). Roll the code back and restart the last
# known-good build so the service recovers automatically.
echo "ERROR: stable did not become healthy on ${TARGET}." >&2
rollback
section "Restart known-good build"
if restart_stable; then
  fail "deploy of ${TARGET} failed its health gate; rolled back to ${KNOWN_GOOD} and recovered."
fi
fail "deploy of ${TARGET} failed AND rollback restart also failed — stable needs manual attention (known-good=${KNOWN_GOOD})."
