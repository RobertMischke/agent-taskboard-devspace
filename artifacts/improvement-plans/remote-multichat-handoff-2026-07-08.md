# Handoff: Remote-Execution + Multichat — Stand mitten im Flug (2026-07-08)

Für: nächste Session / geforkte Chats / Orchestrator-Tasks.
Von: Agent-Session f2bd6a6a (Robert + Claude, 07.–08.07.2026). Session riss beim
Umsetzen von Multichat Phase 0+1 (Anthropic-Session-Limit, Reset 01:10).

## 0. ZIELBILD-KLARSTELLUNG (Robert, 08.07. — wichtigstes Stück Kontext)

> „Ich habe hier meinen **lokalen** Agent-Orchestrator, und mit dem möchte ich
> sagen: **Führe die Sache auf einem anderen Host aus.**"

Das Zielbild ist **NICHT** Mode A (kompletter Stack auf dem Remote-Host, per
Tunnel anschauen — das war nur der Phase-1-Beweis, ein Missverständnis in der
Kommunikation). Das Zielbild ist der **Runner-Split (Mode C)**: der lokale
Task-Server/Orchestrator bleibt das Brain, Remote-Hosts sind reine
Ausführungs-Arme, Zuweisung pro Projekt im UI. Kickoff-Phasen 2→3 bleiben der
Weg; Mode A auf dem Hetzner-Host bleibt als Testumgebung bestehen.

## 1. Was FERTIG und verifiziert ist

| Strang | Ergebnis | Wo |
|---|---|---|
| Remote Phase 0+1 | Hetzner-Host provisioniert; claude/codex headless (Credential-Seeding, D5), Playwright, dotnet build, **E2E-Task-Run inkl. Worktree**, beide Quota-Probes (Porta.Pty) auf Ubuntu 24.04 | Runbook `docs/operations/setup/linux-runner-host.md`; Findings im Kickoff-Doc |
| Zugang | `ssh agent-runner` (agent), `agent-runner-root`, Tunnel-Alias `ssh -N studio-remote` → localhost:14010/15030 | `~/.ssh/config`; Key `~/.ssh/agent-studio-runner` |
| Mode-A-Pilot | Full-Stack auf Host läuft (`~/bin/stack-start.sh`/`stack-stop.sh`), Projekt „Website" via SSH-Mirror (`git push runner main`, Ergebnisse `git fetch runner`) | Host `~/agent-taskboard`, `~/projects/website`, `~/git/website.git` |
| CI | `backend-ci.yml` ubuntu-latest grün auf GitHub (Test-Step `continue-on-error` bis Suite Linux-grün: 23 bekannte Failures) | dev-Repo develop `e4a7bcbf`, in main gemergt `73595351` |
| Konzepte | Remote-Produkt-Integration (Modes, D8 dediziert-pro-Projekt, §6 Admin-Verortung Workspace-Ebene + Gate-State, G1–G11) + Multichat (AGT-1917: Kontext strikt navigations-abgeleitet, Rail extrem optional hinter ☰, →-Sprung in den Ort) | `docs/concepts/remote-execution-product-integration.md`, `docs/concepts/multichat-orchestrator.md` + `mockups/*.html` (Artifacts: remote-hosts e2557186…, multichat cb56aa89…) |
| Chat-Package-Rename | `@coding-agent/chat` → **`coding-agent-chat`** (unscoped); Studio-Frontend komplett migriert (105 Dateien), frische Lib mit Layout-Fixes (stick-to-bottom 06619a8) eingebaut, ng build grün | dev-Repo develop **`c48894d3`**; Chat-Repo `C:\Projects\coding-agent-chat` main |
| Website-Content | Remote-Execution-Sektion auf Produktseite; Apache-2.0-Texte; Impressum-Mail | Website-Repo main `4a8217c` |
| Board-Hygiene | AGT-1917 erledigt → 5-human-review (Ergebnis-Verweis in results/); Duplikat AGT-1925 gelöscht; 6 Produkt-Karten von gestern in 0-backlog | Stable-Board |
| Domain live | https://agent-orchestrator.dev + /studio liefern aus (Parallel-Chat, Host `agent-orchestrator-web` 159.69.145.35) | Marketing-Repo Deploy-Doc |

## 2. Was MITTEN IM FLUG abbrach (Session-Limit)

- **Multichat Phase 0** (project-chat → coding-agent-chat-Composer + SCSS-Gate-Fix):
  Agent starb in der Analyse. KEINE Edits hinterlassen.
- **Multichat Phase 1** (Session-Registry Backend): Agent starb früh; Ein
  Artefakt liegt untracked: `backend/Features/Orchestrator/OrchestratorContextKey.cs`
  (Kontext-Schlüssel-Modell — sichten, verwenden oder ersetzen).
- Beides ist jetzt als Orchestrator-Karten gesliced (siehe §3 / Board 0-backlog).

## 3. Ausführungsplan (Slices als Board-Karten, Präfix = Karten-Titel)

**Sofort parallelisierbar (keine Abhängigkeiten):**
- `[MC-0a]` project-chat auf Composer • `[MC-0b]` SCSS-Gate main (klein)
- `[MC-1a]` Session-Registry: Keys+Persistenz+get-or-create (Seed: OrchestratorContextKey.cs)
- `[RM-1]` Linux-Suite grün (23 Failures) → CI-Gate scharf • `[RM-2]` Worktree-Fallback
- `[BUG-1]` Escalated-404-API-Bug • `[OPS-1]` AGT-1918–1920 Root-Cause
- `[MC-npm]` file:→Registry-Swap — **gated auf Roberts manuellen npm-Erstpublish**
  (`cd C:\Projects\coding-agent-chat && npm run build && cd dist\coding-agent-chat && npm publish --access public`)

**Kette Multichat:** MC-1a → `[MC-1b]` Turn-Endpoint+Aktiv-Cap → `[MC-2]` Sheet folgt Navigation → `[MC-3]` Switcher-Rail (optional).

**Kette Runner-Split (das eigentliche Zielbild):** `[RM-3]` Runner-Identität+Lease/Fencing produktiv → `[RM-4]` Artifact-Upload+Log-Shipping → `[RM-5]` Standalone-Runner-MVP (lokaler Task-Server sagt „führe Task X auf agent-runner-01 aus", ein Task läuft end-to-end remote). Danach erst die 4 UI-Karten von gestern (Remote-Hosts-Admin, Wizard, Projekt-Zuweisung, Task-Server-Seite) mit echter Registry verdrahten.

**Wartet nur auf Robert:** npm-Erstpublish (oben) • AGT-1916+1917-Review •
Studio-Site-Redeploy im Hosting-Chat anstoßen • Mockup-Feedback v2.

## 4. Betriebszustand / Gotchas

- Lokaler Stable-Runner: `paused` (bewusst). Start-Scripts: `start-stable.sh`, `start-dev.sh`, `deploy-stable.sh` im Devspace-Root.
- Hetzner-Host: Stack gestoppt lassen oder via `~/bin/stack-start.sh`; Credentials-Drift-Risiko dokumentiert (Runbook §3).
- `pkill -f` über SSH: nie ein Pattern nehmen, das in der eigenen Befehlszeile vorkommt (zweimal selbst gekillt).
- Workflow-args können als String ankommen (Memory `workflow-args-immer-guarden`).
- Repo heißt jetzt `agent-studio.git` (Rename; beide Checkouts kanonisiert).
