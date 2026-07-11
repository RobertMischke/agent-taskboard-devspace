# Hand-off: GitHub-Organisation fürs Agent-Orchestrator-Universum

**Stand:** 2026-07-11, abends · **Status:** VOLLZOGEN — Org **agent-orc** existiert (von Robert angelegt), alle 6 Produkt-Repos transferiert + kurz-umbenannt, Nacharbeiten erledigt (siehe Vollzugsprotokoll unten).

## Vollzugsprotokoll (11.07., ~17:50)

| Schritt | Ergebnis |
|---|---|
| Transfers + Renames | `agent-orc/agent-studio`, `/runner`, `/chat`, `/token-economy`, `/quality-studio`, `/website` (privat) — alle via Transfer-API mit `new_name` in einem Call |
| Lokale Remotes | dev, stable, runner, chat, token-economy, quality-studio, website-Meta — alle auf agent-orc, per `ls-remote` verifiziert |
| agent-runner-Host | `runner.env` RUNNER_GIT_REMOTE + `~/agent-taskboard` origin auf `agent-orc/agent-studio`; Daemon-Restart bewusst verschoben (Quota-stallende Läufe nicht killen; Git-Redirects überbrücken) |
| Referenz-Sweep | 30+ Dateien: PUBLISHING.md-Owner-Tabelle (nuget-Account `RobertMischke2` unverändert!), release.yml-Kommentare, Directory.Build.props RepositoryUrl (TE+Runner), package.json (Chat), READMEs, Website-HTMLs, sites.json, Registry-Urls. Historische .orchestrator-Logs bewusst NICHT umgeschrieben |
| Org-Einrichtung | Profil (Name „Agent Orchestrator", Beschreibung, Blog agent-orchestrator.dev), `.github`-Repo mit `profile/README.md` (Studios/Libraries-Tabellen), Repo-Homepages (/studio, /runner, /chat), Beschreibung für chat, Topics auf allen 5 Public-Repos. Sweep-Kollateral behoben: `agent-studio-for-software-website` bleibt bei RobertMischke (sites.json zurückgedreht, f87669c) |
| Offen (Robert) | nuget-Policy TE + npm-Trusted-Publisher CAC — beide zeigen jetzt direkt auf die Org (`agent-orc/token-economy`, `agent-orc/chat`). Repo-Pins auf der Org-Seite: UI-only („Customize pins"), keine API |

Workspace-Repo (`agent-taskboard-workspace`) und devspace bleiben bewusst privat bei `RobertMischke`.

## Ausgangslage & Motiv

Alle Produkt-Repos liegen unter dem persönlichen Account `RobertMischke` — „jeder, der
auscheckt, sieht die krasse Bindung an meine Person." Gewünscht: neutrale Organisation
fürs Universum (agent-orchestrator.dev). Ein Username-Rename (Robert-Mischke) wurde
verworfen (brüchige Redirects, kosmetischer Gewinn).

## Rechercheergebnisse (11.07.2026, verifiziert via GitHub-API)

| Name | Status | Anmerkung |
|---|---|---|
| `agent-orchestrator` | **vergeben (gesquattet)** | Leere Org, angelegt 28.11.2025, 0 Repos, kein Profil → Browser zeigt 404, existiert aber. Kandidat für GitHub-Support-Ticket (Name-Squatting-Freigabe, Ausgang offen) |
| `agentorchestrator` | vergeben | |
| `agent-orchestrator-dev` | **frei** | deckungsgleich mit der Domain, aber lang |
| `agent-orch` | **frei** | kurz, tippbar, als Kürzel lesbar — bisheriger Operator-Favorit |
| `agentorch` | **frei** | ein Wort, schwerer lesbar („agen-torch") |
| `orch-agents` | **frei** | |
| `agent-o`, `orchestr8` | vergeben | |


### Namensrunde 2 (gleicher Tag, verifiziert)

| Name | Status | Klang/Idee |
|---|---|---|
| `agent-ensemble` | **frei** | die Agenten als Ensemble - musikalische Familie zur Orchestrator-Metapher, warm, eigenstaendig |
| `maestro-agents` | **frei** | der Maestro dirigiert - erzaehlt die Orchestrierung aktiv; Reihenfolge gewoehnungsbeduerftig |
| `agent-orc` | **frei** | noch kuerzer als agent-orch - liest sich aber auch als Agent-ORK (Fantasy-Assoziation; Feature oder Problem, je nach Humor) |
| `orchestra-dev` | **frei** | kurz, klanggleich zur Metapher; verliert den Agent-Bezug |
| `orch-hub` | **frei** | sehr kurz; klingt eher nach Infrastruktur als nach Produktfamilie |
| `agent-orchestra`, `orchestrion`, `agentwerk` | vergeben | (orchestrion waere der Musikautomat gewesen - schade) |

## Abwägung (Kurzform)

- **agent-orch**: kürzeste saubere Option; Preis: nicht domain-identisch.
- **agent-orchestrator-dev**: maximale Wiedererkennung zur Domain; Preis: sperrige URLs.
- **Ticket-Weg**: parallel möglich — leere Squatter-Org ist guter Kandidat; Org-Renames
  behalten Redirects, ein späterer Umzug von einem Zwischennamen auf den Wunschnamen
  wäre schmerzarm.

## ZUSATZ-EINSICHT (Diktat spaeter am Tag): Die Org absorbiert das Familien-Praefix

Die Repos heissen heute coding-agent-*, WEIL sie unter einem Personen-Account Kontext brauchen.
In einer Org ist das redundant - beim Transfer duerfen die Repos gleich schrumpfen:

| Heute | Mit kurzer Org |
|---|---|
| RobertMischke/coding-agent-token-economy | agent-orch/token-economy |
| RobertMischke/coding-agent-runner | agent-orch/runner |
| RobertMischke/coding-agent-chat | agent-orch/chat |
| RobertMischke/quality-studio | agent-orch/quality-studio |
| RobertMischke/agent-studio | agent-orch/agent-studio |

Das ist der eigentliche Laengen-Gewinn (Roberts Kritik: Vollpfade heute krass lang).
Repo-RENAMES beim Transfer mitmachen; GitHub-Redirects gelten fuer beides.

## Warum das Timing günstig ist (gilt weiterhin)

- Nur ~6 Produkt-Repos (agent-studio, coding-agent-runner, coding-agent-chat,
  coding-agent-token-economy, quality-studio, agent-orchestrator-website).
- **nuget-Trusted-Publishing-Policy für `TokenEconomy` ist noch NICHT angelegt** — kann
  direkt auf die Org zeigen (sonst spätere Migration der Policy).
- **npm-Trusted-Publisher für `coding-agent-chat` ebenfalls noch nicht** — dito.
- npm-Paket ist unscoped (kein Owner im Namen) — vom Umzug unberührt.
- Repo-**Transfers** (im Gegensatz zu User-Renames) bekommen dauerhafte GitHub-Redirects.

## Kontext: Was das Universum kann (fuer die Diskussion ausserhalb dieser Session)

Agent Orchestrator ist ein Ein-Personen-betriebenes System, in dem Coding-Agenten
(codex/claude/gemini-CLIs) Software-Aufgaben als Karten auf einem Board abarbeiten -
orchestriert, reviewt und dokumentiert. Kernfaehigkeiten heute:

- **Task-Board mit Lanes** (Backlog -> Ready -> Progress -> Auto-Review -> Human-Review),
  Karten mit Modell/Thinking-Level, Epics als Container, Abhaengigkeiten (waitsOn).
- **Agent-Pipeline je Karte**: Worktree-Isolation, Build-/Test-Gates, Aspect-Reviews
  (Code-Quality, Tests, Doku, Requirement-Fit), Code-Review-Grades, Completion-Gates,
  Reissue-Budgets, Run-Liveness (Heartbeats, Steer-Timeouts mit Auto-Antwort).
- **Orchestrator-Chat** je Projekt (Konversations-Steuerung, /continue, Steer-Antworten).
- **Projekt-Wikis** aus docs/** der Repos mit Pulse-Dashboard, LLM-Grading der Seiten,
  Konzept-Workflow (Konzept -> Mockup -> Slices) und Experimentier-Workbenches.
- **Remote-Execution** (seit 11.07. live): Runner-Daemon auf Linux-Host claimt Karten
  per Lease ueber SSH-Reverse-Tunnel; Reise-Ziel: alle Projekte remote.
- **Token-/Quota-Management**: Fenster-Tracking je CLI, Caps, Admission-Planer mit
  Burn-Projektion, Fallback-Routen, Kosten aus Pricing-Historie.
- **App-Vermessung** als Standard-Instrument (Screenshot-Sweep -> Befund-Webseite ->
  Vorschlags-System mit Approve-Flow).

## Kontext: Die Repos und ihre Rollen

| Repo (heute) | Rolle | Stand |
|---|---|---|
| `agent-studio` | Das Cockpit: .NET-10-Backend (OrchestratorApi) + Angular-21-Frontend; Board, Pipelines, Wiki, Quota, Remote-Leases. dev- und stable-Checkout, Deploy via deploy-stable.sh | taeglicher Betrieb, 2 Deploys/Tag |
| `coding-agent-runner` | .NET-Library + CLI-Adapter fuer die Agent-CLIs (Thinking-Ladders, Event-Parsing, Pricing frueher hier); **nuget: CodingAgentRunner 0.5.0**, Trusted Publishing via Tag-Push | published |
| `coding-agent-chat` | Angular-Bibliothek der Konversations-UI (Composer, Conversation-View, Kontext-Ringe); **npm: coding-agent-chat 0.2.0** (Erstpublish 11.07.) | published; Trusted-Publisher-Eintrag offen |
| `coding-agent-token-economy` | Preis-/Kosten-Library (Preishistorie je Modell, Kosten-API, SuggestModel); nuget-Id `TokenEconomy` reserviert-frei | Erstpublish wartet auf Trusted-Publishing-Policy (Robert) |
| `quality-studio` | NEU (11.07.): der Engineer-Raum - agentische Code-Reviews je Ebene (Projekt/Modul/Datei), Review-Meta als JSON neben dem Code (mit Stale-Hash), augmented Code-Browsing; Handover-Richtung: Quality Studio -> erzeugt Tasks im Agent Studio | gegruendet, QS-1 = Konzept-Task |
| `agent-orchestrator-website` | Meta-Repo der Websites (Hetzner-VM, Caddy, sites.json, /srv/sites) | privat, Betrieb |
| (Websites-Quellen) | agent-studio-for-software-website (Site-Quelle /studio) u.a. im devspace | Revamp lief heute |

**Namenslogik heute**: Libraries = `coding-agent-*`, Raeume/Frontends = `* Studio`
(Agent Studio, Quality Studio). Eine kurze Org wuerde das `coding-agent-`-Praefix
der Libraries absorbieren (siehe Tabelle oben).

## Vollzugsplan nach Entscheidung (Operator übernimmt)

1. Robert legt Org an (github.com/organizations/new, Free-Plan) — nur er kann das.
2. Operator transferiert die Produkt-Repos (API), persönliche Repos bleiben bei RobertMischke.
3. Nacharbeiten durch Operator: lokale Remotes, `runner.env` auf agent-runner-Host
   (RUNNER_GIT_REMOTE!), PUBLISHING.md-Owner-Tabellen (TE + CAC), Website-Links,
   release.yml-Verweise prüfen.
4. Danach: nuget-Policy (TE) und npm-Trusted-Publisher (CAC) direkt gegen die Org anlegen.
5. Optional parallel: GitHub-Support-Ticket auf Freigabe von `agent-orchestrator`.

## Entscheidung (11.07. abends)

**agent-orc** — kurz, frei, mit bewusst in Kauf genommener Ork-Fussnote. Repo-Kurz-Renames gemaess Tabelle oben laufen im selben Zug.

## Historie der offenen Entscheidung

**Org-Name:** agent-orch vs. agent-orchestrator-dev vs. Ticket abwarten (oder neuer
Kandidat aus der nächsten Diskussion). Sonst ist alles vorbereitet.
