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

## Starting Dev or Stable — no PowerShell

Use the shell scripts at this workspace root. Both work under Git Bash / WSL / any POSIX shell:

```sh
# Start the Dev environment (backend + frontend)
./start-dev.sh

# Start the Stable environment (backend + frontend)
./start-stable.sh
```

Each script:
1. Changes into the respective checkout folder.
2. Passes `PORT` env var to `./api.sh start` — starts the .NET backend and waits for the health check.
3. Generates a temporary proxy config (`.proxy-{dev,stable}.tmp.json`) in this workspace root and passes it to `ng serve` together with `--port`.

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
