# Lage- & Kontext-Handoff — 2026-07-12, Vormittag

**Zweck:** Wiedereinstiegs-Dokument nach einer sehr langen Nachtschicht (11.07. abends → 12.07. ~09:00).
Erfasst Systemzustand, die drei großen Themen, die operativen Lektionen und was als Nächstes ansteht.
Für Operator (mich in einer frischen Session) UND für Robert zum Überblick.

---

## 0. Zustand in einem Blick (Stand ~09:00, 12.07.)

| Achse | Stand |
|---|---|
| **Board (AGT)** | Regal (5-human-review) **180**, in Progress **1** (AGT-2122 = Roberts Architektur-Konzept), eskaliert **1** (AGT-2133, geparkt), ready **2** (WEB-9/10 manuell), backlog **2** (2110, 2154), preparation **10** |
| **Codex-Quota** | 5h-Fenster **0 %** (Inaktivität), **Weekly 23 %** — Wochenziel auf Kurs |
| **develop** | `cec83425` (alle Nacht-Fixes + Salvage-Merges 2091/2092) |
| **stable** | `a70a6663` — **ein Nachdeploy steht aus** (develop ist voraus) |
| **Remote** | agent-runner-01 **schreibfähig & verlustsicher**, Agent Studio läuft remote (executionRunner=agent-runner-01) |
| **Quality Studio** | 13 Karten, alle aktuell im Regal; Store in `agent-taskboard-workspace/projects/PROJ-016` |
| **Wachen** | Monitor `ba8s5epmj` (Wache v5): Stall erst ab 3+ ready, Quota 80/90 %, Eskalationen, Heartbeat |

**Nächster sinnvoller Schritt:** Stable-Nachdeploy (bringt Nacht-Fixes live UND gibt 2152/2155/2156 frische Basis).
Robert wurde gefragt „Deploy jetzt oder erst Regal?" — **Antwort steht aus, nicht eigenmächtig deployen.**

---

## 1. Die drei großen Themen (alle erledigt)

### A. GitHub-Org `agent-orc` — VOLLZOGEN
- 6 Repos transferiert + kurz-umbenannt: `agent-orc/agent-studio`, `/runner`, `/chat`, `/token-economy`, `/quality-studio`, `/website` (privat).
- Org-Profil (Name „Agent Orchestrator", Beschreibung, Blog), `.github`-Repo mit Profil-README (Studios/Libraries-Tabellen), Topics auf allen 5 Public-Repos, Homepages.
- Alle lokalen Remotes + Host (`runner.env` RUNNER_GIT_REMOTE) umgestellt.
- **Deploy-Keys**: Org-Policy per API freigeschaltet (`deploy_keys_enabled_for_repositories=true`), Write-Key (id 157019393) am agent-studio-Repo; Host pusht via `RUNNER_GIT_PUSH_REMOTE=git@github.com-agentstudio:agent-orc/agent-studio.git` (SSH, IdentityFile `~/.ssh/agent-studio-deploy`).
- Handoff-Doc der Org-Migration: `artifacts/improvement-plans/github-org-naming-handoff-2026-07-11.md` (Status VOLLZOGEN).
- **Offen (Robert):** nuget-Policy `CodingAgentRunner` → agent-orc/runner (Migrationsfolge!), nuget TE, npm Trusted-Publisher chat, Org-Pins (UI).

### B. Quality Studio — GEGRÜNDET & GEFÜLLT
- Repo `agent-orc/quality-studio`, Registry PROJ-016 (ShortCode QS), DisplayName „Quality Studio".
- **Store liegt im Task-Server-Workspace** `C:\Projects\agent-taskboard-workspace\projects\PROJ-016` — NICHT mehr im Produkt-Repo (Operator-Entscheidung: Orchestrator-Jobs nie im Produkt-Repo; `.orchestrator/` ist dort jetzt gitignored, Commit 9c5323b).
- 13 Karten QS-1..QS-13, alle geliefert (im Regal). Konzept `docs/concept.md` (1521 Z), Scaffold (`src/AgentOrchestrator.CodeQuality`), Staleness-Engine, Ebenen-Aggregation, Review-Runner (Branch `task/qs-6-*`), API-Host, Frontend-Shell (Agent-Studio-Verwandtschaft gewollt), augmented browsing, Handover-nach-Agent-Studio, Website /quality, Code-Graph-Research, Input-Management.
- Package-Richtung: Library `coding-agent-quality`, Namespace `AgentOrchestrator.CodeQuality` (final bei Erstpublish).
- Handover-Richtung ENTSCHIEDEN: Quality Studio erzeugt Tasks im Agent Studio (kein Embedding).

### C. Remote-Pipeline — GEHEILT (der eigentliche Krimi)
- **Phantom-Krise:** Die Remote-Abendwelle (11.07.) produzierte ~29 „gelieferte" Karten OHNE Commit auf origin. Drei Löcher: Host ohne Push-Auth (jeder Push scheiterte still), Remote-Läufe endeten ohne Terminal-Sentinel („outcome Unknown" → out-of-band), Worktree-Teardown vernichtete die uncommittete Arbeit.
- **Fixes deployt** (alle in stable a70a6663 / develop): AGT-2147 (Teardown nie ohne Commit+Push), AGT-2148 (Sentinel-Prompt/Parser im Daemon), AGT-2149 (Push-Selbsttest → read-only-Verweigerung + Runbook), AGT-2143 (Resume-Vorbedingung), AGT-2141 (Multi-Repo-Daemon → Weg zu „alle Projekte remote").
- **Beweis der Heilung:** AGT-2123 lief nach Deploy komplett durch — `outcome=Done`, `worktree-salvage-push secured=True`, reguläre Landung in 4-auto-review. Multi-Repo-Layout aktiv (Worktrees unter `runner-work/PROJ-002/…`).
- **Memory:** `remote-runner-schreibunfaehig.md`.

---

## 2. Die Gate-Saga (kritische Betriebslektion — Memory `gates-testsuite-machinebound.md`)

Der Nacht-Deploy (~01:45) brachte erstmals die **Test-Stufe** in die Karten-Verify-Gates. Das legte VIER Schichten frei, die als „Build/test gate failed twice in a row" erschienen — meist KEINE kaputte Karte:

1. **Echte rote Tests** (gefixt): Grading-Namespace verletzte Feature-Folder-Regel (STYLEGUIDE §2); monatsalte Snapshot-Fixture erwartete `docs/assets/images` statt `docs/images`; Claude-Adapter-Label `five_hour`→`5-hour`.
2. **Maschinengebundene Tests** gehören nicht in Karten-Gates: Perf-Budgets (Laufzeit last-/maschinenabhängig) + Live-Checkout-Polizei (Tooltip-Drift). Lösung: `[Trait("Category","MachineBound")]` + BuildProfile-Filter `dotnet test --filter Category!=MachineBound`. Tooltip-Drift läuft als **Ratsche** (Baseline 15) bis AGT-2156 die `[appTooltip]`-Direktive baut.
3. **Gate-Timeout** 300 s gegen eine **7-8-Minuten-Suite** — `verdict=Fail exit=n/a durationMs~300000` = TIMEOUT, kein roter Test. Config: `PostSteps:post-build-test-gate:TimeoutSeconds` in stable `appsettings.Local.json` (jetzt 900). **Key exakt `post-build-test-gate`** (nicht `build-test-gate`!).
4. **Worktree-RECYCLING**: Requeue erneuert die develop-Basis des Worktrees NICHT. Nach Testfixes auf develop müssen gate-gefailte Karten neu gequeued werden, sonst tragen sie die alte rote Basis. + Gate-Interferenz bei Parallellauf (Kernauftrag von AGT-2155).

**BuildProfile-Falle:** Deklarierte Profile blockieren Auto-Pickup bis Status `pipeline-ready` (BuildProfileGate). Die Validierung (`POST .../build-profile/validate`) ist BUGGY (läuft in leerem Kontext → MSB1009/MSB1003). Workaround: Status direkt in `agent-taskboard-workspace/project-settings.json` auf `pipeline-ready` patchen + Backend-Restart. (Bug gehört zur Onboarding-Familie AGT-2144/2154 → Roberts Akte.)

---

## 3. Offene Kartenzustände (präzise)

**In Progress:** AGT-2122 (verteilte Orchestrierung / Task-Server-Extraktion / Companion — Roberts Architektur-Konzept, Blocker via 2091-Merge weg, mit Operator-Nachtrag im Prompt).

**Preparation (10):** AGT-2098 (Runner-Release-Kette), AGT-2129/2130/2131/2132 (Epics-Container, werden nie gepickt), AGT-2151 (Wait-on-Quota — wartet auf CodingAgentRunner-Release v0.6.0), **AGT-2152/2155/2156** (Gate-Geschwister — zurückgestellt bis Nachdeploy, dann Neuanlauf auf frischer Basis), RUN-40.

**Eskaliert (1):** AGT-2133 (Epics-View) — braucht laufenden Dev-Server für Playwright-Screenshots; nach Deploy angehen.

**Backlog (2):** AGT-2110 (CAR→TokenEconomy Cost-Provider), AGT-2154 (Onboarding-Atomicity — vom System selbst angelegt).

**Ready (2):** WEB-9, WEB-10 (manuell).

**Salvage-Branches auf origin** (`runner/agent-runner-01/AGT-<key>`) — Arbeit gesichert, noch nicht gemerged:
- **2091, 2092 = bereits in develop gemerged** (cec83425).
- **2121 = gemergt UND revertiert** (bricht `RemoteRunnerEndToEndTests` deterministisch — Lease/Fencing-Umbau unvollständig integriert; Neuintegration im Review nötig).
- **2112, 2108 = echte Merge-Konflikte** (`frontend/app.html/.stylelintrc` bzw. `docs/domains/tasks.md`) — im Regal mit Branch-Verweis, brauchen Roberts Blick.
- Weitere Branches (2095, 2109, 2111, 2113, 2114, 2117, 2118, 2120, 2123, 2134, 2135, 2136, 2138, 2141, 2142, 2143, 2146, 2150) sind Salvage-Snapshots gelieferter/gemergter Karten — die meisten Inhalte sind über den regulären develop-Weg drin; Branches sind Sicherungskopien.

---

## 4. Roberts Akte (manuelle Akte, nur er kann)

1. **nuget-Trusted-Publishing für `CodingAgentRunner` auf `agent-orc/runner`** umstellen (Migrationsfolge; die alte Policy zeigt noch auf RobertMischke/coding-agent-runner) → dann tagge ich **v0.6.0** (enthält WaitOnQuota, CAR-5 main 7793204) → **AGT-2151** geht auf ready.
2. nuget-Trusted-Publishing-Policy für **TokenEconomy** (Werte in TE `docs/PUBLISHING.md`: nuget-Account RobertMischke2, Owner jetzt **agent-orc**, Repo **token-economy**) → dann tagge ich TE v0.1.0.
3. npm **Trusted-Publisher** für `coding-agent-chat` (agent-orc/chat, workflow release.yml).
4. **Org-Pins** auf github.com/agent-orc (UI: „Customize pins" → 5 Public-Repos).
5. **Regal-Abnahme** — 180 Lieferungen. Vorsicht: zwei Konflikt-Merges (2112, 2108) brauchen Entscheidung; die out-of-band-Notizen VOR ~20:45 (11.07.) sind bereinigt/verifiziert.
6. Optional: agent-orchestrator (Squatter-Org) GitHub-Support-Ticket.

---

## 5. Operator-Programm (was ICH als Nächstes fahre, sobald Robert grünes Licht / Deploy-Antwort gibt)

1. **Stable-Nachdeploy** develop `cec83425` → stable: drain (Lanes manual) → merge origin/develop (Konfliktregel: theirs außer `docs/operations/setup/linux-runner-host.md`=ours) → push → `SKIP_FETCH=1 ./deploy-stable.sh` (devspace root) → Drill (Registry/Counter/Parallelism/Modes). Bringt Nacht-Fixes + Telemetrie + 2091/2092 live.
2. Danach **2152/2155/2156 neu queuen** (frische Basis → Gates grün).
3. **2133** mit laufendem Dev-Server angehen.
4. **2142-Telemetrie** 30-min-Live-Verifikation in der Host-Ansicht (CPU/Steal/Load-Verlauf).
5. **2121** neu integrieren (Lease/Fencing + Remote-E2E versöhnen).
6. QS-Kette weiter, wo noch offen.

---

## 6. Wichtige technische Anker / Gotchas (dürfen nicht verloren gehen)

- **Alle Mutationen brauchen Header `X-Client-Id: local-default`** (sonst 401).
- **Inline-node-Scripts werden geshellmangelt** — IMMER Datei schreiben (Backticks/Umlaute/Pfade). Wiederholt reingefallen, auch heute Nacht.
- **API-Shapes:** State-Move = `PUT /api/tasks/{id}/state` Body `{"targetState":"..."}`; Continue = `POST /{id}/continue` Body `{"prompt":"..."}` (Prompt PFLICHT); Runner-Mode = `PUT /api/runner/{proj}/mode` Body `{"mode":"..."}`; Parallelism = `PUT /api/projects/{proj}/max-parallelism` Body `{"maxParallelism":N}`; Execution-Runner = `PUT /api/projects/{proj}/execution-runner` Body `{"executionRunner":"agent-runner-01","remoteExecutionEnabled":true}`.
- **Lane-Namen auf Platte:** `3-progress` (nicht 3-in-progress), `5e-escalated`, `5-human-review`, `6-completed`, `7-archive`.
- **Kartenanlage kollisionssicher:** key = max(existierende `AGT-\d+`-Ordner)+1 + Existenz-Assert. Registry `NextTaskKeySeq` NACHZIEHEN. Aktueller Counter: **2157** (max Karte AGT-2156). Die Onboarding-API verwaltet Keys inzwischen teils selbst (AGT-2154 kam vom System) — vor Anlage immer Platte prüfen.
- **Reset-Verhalten:** Roberts Codex-Reset nullt offenbar auch die Weekly-Anzeige (nicht nur 5h). Nach jedem Reset: Lanes auf auto, Quota-Wand-Opfer (3-progress ohne frische Aktivität) requeuen.
- **Zombie-Erkennung:** „prog N, alle tot" sieht für eine Lane-zählende Wache gesund aus. Lebenszeichen = **Log-Aktivität** (`stat` cli-output.log), nicht Lane-Zahl. Fünf Zombies belegen Slots und blockieren Nachschub → unsichtbarer Stall.
- **Host:** ssh-Alias `agent-runner`; Daemon `sudo systemctl {status,restart} agent-runner`; Reverse-Tunnel `reverse-tunnel.ps1` (devspace root), MUSS `-R 15031:127.0.0.1:5031` (nicht localhost→::1). Salvage-Tarballs in `~/salvage`.
- **Deploy-Konfliktregel** (develop→stable): theirs, außer `docs/operations/setup/linux-runner-host.md` = ours.
- **GH001-Warnung:** Workspace-Repo sammelt große Run-Artefakte (Push-Stau-Risiko; Chunked-Push + `http.postBuffer 524288000` half). Auf Dauer Artefakt-Größen im Blick behalten → Robert.
- **Burn-Regeln (Robert):** nie Fast-Tier ohne expliziten Sprint; bei Quota-Hit warten statt claude-Fallback (Route bleibt geräumt bis Roberts Wort/Montag); produktiv maxen, nicht Tokens verschleudern.

---

## 7. Neue Karten dieser Session (Referenz)

2141 (Multi-Repo-Daemon), 2142 (Host-Telemetrie CPU/Steal), 2143 (Resume-Spirale), 2144 (Projekt-Onboarding-Produkt), 2145 (Archiv-pro-Projekt), 2146 (Model-Qualifizierungs-Step/Token-Efficiency), 2147 (Teardown-Schutz), 2148 (Remote-Sentinel), 2149 (Push-Identität), 2150 (Spark-Kontingent für Pipeline-Schritte — Spark war ungenutzt!), 2151 (Wait-on-Quota im Orchestrator), 2152 (TASK_BLOCKED-Platzhalter-Bug), 2153/2155 (Gate-Serialisierung/Interferenz), 2154 (Onboarding-Atomicity, system-angelegt), 2156 (appTooltip-Direktive). Alle mit Operator-Diktat-Kontext im Prompt.

---

*Ende Handoff. Der letzte offene Dialog mit Robert: „Stable-Nachdeploy jetzt oder erst Regal?" — auf Antwort warten.*
