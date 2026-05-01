# AGENTS.md — Devspace Root

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

All workspace-root scripts are `sh` (Git Bash on Windows, WSL, any POSIX shell). There is **no PowerShell**. Run them in a VS Code terminal (`bash` profile) so `ng serve` output stays visible.

```sh
# Start (backend daemonised via api.sh, then ng serve in foreground)
./start-dev.sh
./start-stable.sh

# Stop (backend + frontend)
./stop-dev.sh
./stop-stable.sh

# Roll Stable forward to origin/main (stop → ff-pull → conditional npm install → start)
./update-stable.sh
```

Each start script:
1. Changes into the respective checkout folder.
2. Passes `PORT` env var to `./api.sh start` — starts the .NET backend and waits for the health check.
3. Generates a temporary proxy config (`.proxy-{dev,stable}.tmp.json`) in this workspace root and passes it to `ng serve` together with `--port`.

Shared plumbing lives in `start.sh`, `stop.sh`, and `_lib.sh` (port-listener helpers); the `*-dev.sh` / `*-stable.sh` files are thin wrappers that only set env vars.

To control only the backend of one checkout independently, call `api.sh` directly from within that checkout:

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

Use `./update-stable.sh` (workspace root). It performs, in order: preflight (must be on `main`, worktree clean) → stop Stable → `git pull --ff-only origin main` → `npm install` (only if `package-lock.json` changed) → start Stable. Aborts before touching anything if Stable is dirty or not fast-forwardable.

---

## Shell policy

- Use `sh` / `bash` (Git Bash on Windows). Do **not** use PowerShell.
- Windows-specific binaries (`tasklist`, `taskkill`, `netstat`) may be called directly from sh without wrapping them in `powershell -c`.

---

## Do not touch child AGENTS.md files from the devspace root

Instructions for agents working inside a checkout live exclusively in:

- `agent-taskboard-dev/AGENTS.md`
- `agent-taskboard-stable/AGENTS.md`

Changes to those files must be made from within the respective checkout, not from this root.
