# Agent Studio workstation launchers

The workstation runs remotely built artifacts. Builds, tests, lint, and merge-gate commands belong on the remote executor.

Create the ignored `.remote-execution.env` with the installation's SSH alias, immutable Linux gate worker, and verified release directory:

```sh
export RemoteGate__SshHost=agent-runner
export RemoteGate__WorkerPath=/absolute/release/worker/OrchestratorApi.dll
export REMOTE_RELEASE_ROOT=/absolute/releases
```

SSH must already work non-interactively with a verified host key. The backend's temporary SSH gate bridge exports the exact commit and accepts only a matching remote result. Missing configuration or transport failure blocks the gate. Source-control integration remains in the control plane.

`./update-stable.sh` fetches and pins `origin/main`, verifies that Stable can fast-forward, and downloads that exact commit's remote artifacts before stopping Stable. The remote directory must contain `<SHA>/release.tar.gz` and `release.sha256` (the lowercase SHA-256 digest only). The archive contains regular files and directories under `backend/` and `frontend/`. Both components require:

- `RELEASE-SHA`: the full source commit.
- `FULL-GATE`: `PROMOTION_FULL_GATE=passed:<SHA>`, written only after the mandatory full gate passed for that commit.
- Backend runtime files, or the frontend production build with `index.html`.

Generated files are installed beneath Stable's ignored `backend/bin/remote-publish/<SHA>/` and `frontend/dist/remote-publish/<SHA>/`. No package installation, build, or Angular development server runs during updates or starts. Missing artifacts leave the current running version in place during update preflight. Publish the artifacts remotely before promoting a release.

`./start-stable.sh` and `./start-dev.sh` require matching artifacts. The shared launcher sets `API_REQUIRE_PREBUILT=1`. Dev still requires the project-specific authorization rules. The frontend uses the dependency-free Node server in `serve-prebuilt-frontend.mjs`, bound to loopback, with API and WebSocket proxying. The independent update service is left running; its own installation must also use remote artifacts.

Verification commands belong on the remote host:

```sh
node --test serve-prebuilt-frontend.test.mjs
bash fetch-remote-artifacts.test.sh
bash -n start.sh update-stable.sh remote-execution.sh fetch-remote-artifacts.sh
```
