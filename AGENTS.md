# AGENTS.md — Devspace Root

This workspace contains several sibling projects. Use this map first to avoid broad filesystem or `AGENTS.md` lookups.

| Folder | Project / role | Notes |
|--------|----------------|-------|
| `agent-taskboard-dev/` | Agent Task Processor / Agent Software Studio dev checkout | Main active development checkout. Do feature work here. Has its own `AGENTS.md`, backend, frontend, docs, scenarios, and scripts. |
| `agent-taskboard-stable/` | Agent Task Processor stable/reference checkout | Read-only reference checkout. Do not develop or commit here. Has its own `AGENTS.md`. |
| `agent-taskboard-orchestrator-chat/` | Agent Task Processor orchestrator-chat checkout | Separate checkout/branch for orchestrator-chat work. Has its own `AGENTS.md`, backend, frontend, docs, scenarios, and solution file. |
| `agent-studio-marketing/` | Agent Studio for Software marketing workspace | German-first marketing, positioning, pricing, product-fit, and website-planning documents. Has its own `AGENTS.md` and `README.md`. |
| `agent-studio-for-software-website/` | Agent Studio for Software website repo | Website repository checkout. Inspect locally before assuming framework or contents. |
| `cli-source-references/` | External CLI / agent source references | Reference-only source checkouts for Codex, opencode, Copilot, Claude Code adjacent tools, and orchestration examples. Do not treat as product code. |
| `scenario-click-counter/` | Scenario fixture / small workspace | Small scenario workspace, currently containing `workspace/`. |
| `agent-taskboard-devspace/` | Nested/local copy of this devspace | Do not confuse with the current workspace root. Enter only if explicitly asked to work in that nested copy. |

For project-specific rules, read the `AGENTS.md` inside the target project after choosing the folder from this map. Do not recursively scan every child `AGENTS.md` by default.

---

## Agent Task Processor Dev / Stable

This workspace contains two side-by-side checkouts of Agent Task Processor:

| Checkout | Folder | Purpose |
|----------|--------|---------|
| Dev | `agent-taskboard-dev/` | Active development branch |
| Stable | `agent-taskboard-stable/` | Stable / reference branch |

Each checkout is a fully self-contained project with its own `AGENTS.md`, backend, and frontend. Consult the checkout-level `AGENTS.md` for project-specific agent rules.

| Checkout | Backend | Frontend |
|----------|---------|----------|
| Dev | `http://localhost:5030` | `http://localhost:4010` |
| Stable | `http://localhost:5031` | `http://localhost:4011` |

Both environments can run in parallel without port conflicts.

---

## Starting and stopping Dev or Stable

All workspace-root scripts are `sh` (Git Bash on Windows, WSL, any POSIX shell). There is **no PowerShell**. Run them in a VS Code terminal (`bash` profile) for the shell lifecycle scripts. Builds and tests must execute remotely; local launchers use commit-pinned artifacts. See `README.md`.

```sh
# Start remotely built backend and frontend artifacts
./start-dev.sh
./start-stable.sh

# Stop (backend + frontend)
./stop-dev.sh
./stop-stable.sh

# Roll Stable forward after validating exact-commit remote artifacts
./update-stable.sh
```

Each start script requires matching remote backend and frontend artifacts for the checkout HEAD. It starts the published .NET DLL and a lightweight frontend proxy without restoring, installing, compiling, or running `ng serve`. Configure the immutable remote gate worker in `.remote-execution.env`; see `README.md`.

Shared plumbing lives in `start.sh`, `stop.sh`, and `_lib.sh` (port-listener helpers); the `*-dev.sh` / `*-stable.sh` files are thin wrappers that only set env vars.

For direct backend lifecycle commands, source the root `remote-execution.sh` first and supply `API_PREBUILT_DIR` for the exact checkout HEAD. Never use an implicit local source build:

```sh
cd agent-taskboard-dev  && ./api.sh start   # or stop / restart / status
cd agent-taskboard-stable && ./api.sh start
```

---

## Port configuration — outer scripts only

**Inner checkouts keep their default ports (5030 / 4010) in all config files.** Port overrides are the exclusive responsibility of the outer launcher scripts (`start-dev.sh`, `start-stable.sh`). Never hard-code Stable-specific ports (5031 / 4011) inside `agent-taskboard-stable/`.

Why this matters: both checkouts track the same git history and are synced periodically. Any environment-specific config committed inside a checkout will be overwritten on the next sync. The outer workspace is the only safe place for environment-specific values.

The override mechanism:
- **Backend**: `api.sh` reads `PORT` as an env var (`PORT="${PORT:-5030}"`). The outer script sets it: `PORT=5031 ./api.sh start`.
- **Frontend port**: `--port` flag passed to `ng serve` via `npm start -- --port 4011`.
- **Proxy target**: a temporary proxy config is generated from the outer script and passed via `--proxy-config`. The inner `proxy.conf.json` is never modified.

---

## Stable is read-only — all work happens in Dev

**Never commit directly to `agent-taskboard-stable/`.** Stable tracks the last known-good state of the main branch and is synced from Dev once a feature is merged. Treat it as a read-only reference.

- Feature development: always in `agent-taskboard-dev/`.
- When a feature is done and merged, Stable is updated via a sync (fast-forward or reset to main).
- Any change made directly inside `agent-taskboard-stable/` will be lost on the next sync.

### Bringing Stable up to `origin/main`

Use `./update-stable.sh` (workspace root). It performs, in order: preflight (must be on `main`, worktree clean, main fast-forwardable) → fetch and validate remote artifacts for the pinned main commit → stop Stable → fast-forward to that commit → start from the published artifacts. Aborts before touching anything if Stable is dirty or not fast-forwardable.

---

## Shell policy

- Use `sh` / `bash` (Git Bash on Windows). Do **not** use PowerShell.
- Windows-specific binaries (`tasklist`, `taskkill`, `netstat`) may be called directly from sh without wrapping them in `powershell -c`.

---

## Do not touch child AGENTS.md files from the devspace root

Instructions for agents working inside a project live in that project's own instruction file. Known child instruction files include:

- `agent-taskboard-dev/AGENTS.md`
- `agent-taskboard-stable/AGENTS.md`
- `agent-taskboard-orchestrator-chat/AGENTS.md`
- `agent-taskboard-orchestrator-chat/frontend/AGENTS.md`
- `agent-studio-marketing/AGENTS.md`

Changes to those files must be made from within the respective project, not from this root.
