#!/usr/bin/env bash
# Start script for the Dev environment.
# Port defaults live here — inner checkout keeps 5030/4010 in its own files.
#
# ADR-0044 policy gate (also documented in AGENTS.md "Dev backend lifecycle:
# Playwright-only"): the dev backend is the regression-test target, NOT a
# second orchestrator on the shared workspace. By default this script refuses
# to boot interactively so the operator does not accidentally bring up a
# second pickup seat. Two escape hatches:
#
#   - Set ATP_ALLOW_DEV_BACKEND=1 to acknowledge the policy and continue
#     (e.g. when you really do want to drive the dev UI by hand).
#   - The Playwright dev-backend fixture sets ATP_DEV_BACKEND_FROM_FIXTURE=1
#     when it calls scripts/supervisor/dev-lifecycle.sh; that path bypasses
#     the prompt because the fixture is the single legitimate caller.
#
# Either way the dev backend now boots with Runner:Role=test-subject
# (configured in agent-taskboard-dev/backend/appsettings.Local.json) so the
# auto-pickup loop is structurally disabled regardless of how the process
# came up. The env-flag gate exists to make the policy visible at the shell
# layer, not because absence would actually re-enable pickup.

if [[ "${ATP_DEV_BACKEND_FROM_FIXTURE:-0}" != "1" && "${ATP_ALLOW_DEV_BACKEND:-0}" != "1" ]]; then
  cat >&2 <<'WARN'

  =====================================================================
  start-dev.sh: AGENTS.md / ADR-0044 reminder
  =====================================================================

  The dev backend is the *regression-test target*. The orchestrator seat
  is stable. Running dev outside Playwright means:
    - You are debugging dev's UI / backend by hand (legitimate).
    - You are running an unattended auto-pickup loop on dev (NOT
      legitimate — dev's Runner:Role=test-subject blocks pickup, but
      booting it adds load and confusion regardless).

  To proceed: set ATP_ALLOW_DEV_BACKEND=1 and re-run.
  Example:

      ATP_ALLOW_DEV_BACKEND=1 ./start-dev.sh

  Playwright fixtures bypass this gate via ATP_DEV_BACKEND_FROM_FIXTURE=1;
  do not export that flag in your shell — it's for the fixture.

  =====================================================================

WARN
  exit 2
fi

export BACKEND_PORT="${BACKEND_PORT:-5030}"
export FRONTEND_PORT="${FRONTEND_PORT:-4010}"
export CHECKOUT="agent-taskboard-dev"
export PROXY_SUFFIX="dev"
exec "$(dirname "${BASH_SOURCE[0]:-$0}")/start.sh"
