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
2. Calls `./api.sh start` — starts the .NET backend, waits for health check on `http://localhost:5030`.
3. Calls `npm start --prefix frontend` — starts the Angular dev server on `http://localhost:4010`.

To control only the backend of one checkout independently, call `api.sh` directly from within that checkout:

```sh
cd agent-taskboard-dev  && ./api.sh start   # or stop / restart / status
cd agent-taskboard-stable && ./api.sh start
```

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
