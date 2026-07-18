# Salvage-Reconciliation & Gate-Heilung — Vollzugsprotokoll 17.07.2026 (Abend)

Kontext: 11 Karten in `5e-escalated`, 10 in `4-auto-review`/post-processing, Auto-Review
vergab reihenweise Grade D. Auftrag Robert: Root Cause klären, Tests fixen, durchziehen.

## 1. Root Cause (bestätigt)

Die Grade-D-Welle ist die **Spätfolge der Phantom-Welle vom 11.07.**, nicht ein neuer Bug:

- Drei Runner-Defekte wirkten damals zusammen: fehlende Push-Identität (AGT-2149),
  fehlendes Terminal-Sentinel → out-of-band-"done" (AGT-2148), Teardown ohne
  Commit+Push (AGT-2147). Alle drei sind seit 12.07. gefixt und deployed
  (verified-push-before-completion, Push-Probe, read-only-Admission).
- **Design-Lücke, die heute zuschlug:** Der Remote-Runner pusht ausschließlich auf
  `runner/<runnerId>/<taskKey>`-Salvage-Branches (`runner/GitWorkspace.cs:35,186`).
  Es gibt keinen automatischen Schritt, der Salvage → `task/<slug>`/develop integriert.
  Der Review-Diff wird gegen task-branch/develop gebildet → sieht die Arbeit nicht
  → Grade D "off-target/unrelated". Die Reviews waren **korrekt**.
- Der Rescue vom 13.07. (`rescue/integrate-phantom-salvage-20260713`,
  `rescue/phantom-shared-develop-20260713`) ist vollständig in develop gemergt,
  rettete aber nur die damalige Charge.

## 2. Testsuite-Heilung develop (gepusht: `13581a70` + `e9520c2b`)

Sieben Gate-Blocker auf develop behoben (alle vorbestehend, gegen `7b200ecb` verifiziert):

1. `TaskPipelineEndpoints.cs` — step-run-Handler nutzte
   `ResolveWatchPath(projects, project, body?.WatchPath ?? watchPath)`; der textuelle
   Architektur-Guard verlangt die kanonische Zweischritt-Form. Normalisiert,
   Verhalten unverändert.
2. `TaskStateMachine.DeleteJob` — echter Lost-Update-Bug: Delete löste den Slug nach
   dem Mutex-Wait lane-übergreifend neu auf und löschte die Karte in ihrer NEUEN Lane,
   wenn ein Move das Rennen gewann (Move und Delete meldeten beide Erfolg). Delete
   schlägt jetzt sauber fehl, wenn die Karte ihren ursprünglich aufgelösten Ordner
   verlassen hat.
3. `PublishTargetServiceTests` — FileSystemWatcher-Zustellung hat kein Latenz-Bound;
   5s-SpinUntil riss unter paralleler Last (bei Extremlast sogar 30s). Budget jetzt 60s
   (SpinUntil kehrt bei Erfolg sofort zurück).

Batch 2 (`e9520c2b`), nach Volltest-Läufen (4230 Tests) gefunden:

- **(4)** `Program.cs` — Serilog "The logger is already frozen": parallele
  `WebApplicationFactory`-Boots racen um Swap+Freeze des statischen
  Bootstrap-Loggers. Test-Hosts nutzen jetzt `preserveStaticLogger` (über das
  vorhandene `underTestHost`-Signal); Produktion unverändert.
- **(5)** `ProjectRepoResolverPairingTests` — Test-Seed lief über `Rename()`, das
  Namens-Kollisionen inzwischen korrekt ablehnt; Seed auf den weiterhin
  möglichen Auto-Discovery-Weg umgestellt, gepinnte Resolver-Invariante unverändert.
- **(6)** `PromptCoverageGuard` — zwei Inline-Prompts aus `ProjectProposalDraftingService`
  in die Runtime-Template-Registry ausgelagert (`proposal-feedback-refine.md`,
  `proposal-draft-generate.md`).
- **(7)** `FeatureFolderBoundary` — zwei Testdateien vom Legacy-Namespace
  `OrchestratorApi.Tests` auf `AgentStudio.Tests` umgestellt.

Dazu: eingecheckte Konfliktmarker in `docs/concepts/out-of-band-task-completion.md`
entfernt (eingeschleppt durch AGT-2121-Revert `cec83425`); die aktuelle
"shipped"-Fassung behalten.

**Bekannte Rest-Flakes (Volltest unter Pipeline-Last, solo grün — Follow-up:
MachineBound-Trait oder Isolationsfix):** `AdHocUsageBusParityTests.LegacyAndBusReaders…`
(fiel 2× im Vollauf — zuerst analysieren, nicht nur ausschließen!),
`BuildTestGateRunnerBehaviorTests.CancellationDuringHostLoadWait…`,
`MergeEndpointsIntegrationTests.CompletedLaneAuditRoutes…`,
`TaskWatcherServiceTests.RelevantBurst_DispatchesOnceAfterTheQuietWindow`.

## 3. Salvage-Reconciliation (19 Karten)

Muster pro Karte: frischer `task/<slug>` von aktuellem develop, `git merge --squash
origin/runner/agent-runner-01/AGT-XXXX`, Konflikte develop-erhaltend gelöst, ein
Squash-Commit mit Provenienz, Push auf origin, Karte → `2-ready` (an Queue-Kopf).

**Welle 1 (waren escalated, alle 10 reconciled + requeued):**
AGT-2108* · 2133 · 2152 · 2160 · 2167 · 2180 · 2181 · 2188 · 2190 · 2195

*AGT-2108 Sonderfall: lokaler WIP-Snapshot (12.07.) + Salvage waren zwei Iterationen
derselben Arbeit. Branch neu aufgebaut auf develop+Salvage; wikiSourceBranch in
develops atomaren `ProjectRegistry.Update()`-Pfad integriert statt Salvages
Per-Feld-Dispatch. WIP-Stand gesichert unter `backup/agt-2108-wip-20260717`.

**Welle 2 (heute Abend nacheskaliert, alle 9 reconciled):**
AGT-2156 · 2159 · 2162 · 2163 · 2177 · 2178 · 2191 · 2192 · 2193 — requeued bis auf
2162/2163/2178, die bei Redaktionsschluss noch ihre laufende Post-Processing-Runde
(auf dem alten Leer-Diff) beendeten; nach dem Verdict requeuen.

**Nicht reconciled (bewusst):**

- AGT-2197 — Grade B + `requirement:concerns`: legitime Eskalation, braucht Roberts Urteil.
- CAC-7 — kein Salvage-Fall: Completion-Gate wollte Tests im echten Checkout.
  TS-Narrowing-Fehler in `conversation-projection.spec.ts` gefixt, im Checkout
  verifiziert (tsc sauber, vitest 173/173), requeued. Der Re-Run hat den Fix
  absorbiert, alles nach **local main** gemergt (ahead 1, ungepusht) und
  Release 0.2.1 vorbereitet — Ende **legitim eskaliert**: `npm publish` scheitert
  an fehlender Auth (E401, der bekannte ausstehende npm-Erstpublish). → Robert:
  main pushen + npm-Publish 0.2.1 freigeben (oder Karte parken).
- QS-15 — hing seit 13.07. in toter `post-processing-running`-Phase
  (missing-terminal-sentinel). Requeued (Phase durch Lane-Move bereinigt) → läuft wieder.

### Befunde aus der Reconciliation (für Review/Merge relevant)

- **Salvage-Kreuzkontamination:** Die runner/-Branches bauen teils aufeinander auf.
  Konkret trägt `task/wiki-dark-theme-color-regression` (AGT-2191) nahezu das komplette
  WikiSourceBranch-Feature von AGT-2108 mit — beide Auflösungen sind konvergent
  (develops `Update()` + `ValidateWikiSourceBranch`), aber beim Accept/Merge wird der
  zweite der beiden weitgehend No-Op bzw. leicht konfliktig. Reihenfolge beachten.
- **Verlorene Library-Companion-Änderung:** AGT-2162s Salvage band `[composerContext]`
  an `<cac-chat>` — diese API ging am 11.07. im Library-Repo komplett verloren
  (existiert auf keinem Branch). Im Studio app-lokal über den
  `[chat-foot-start]`-Projektionsslot gebrückt; Follow-up-Ticket
  `cac-chat-composer-context-first-class-input` im CAC-Backlog angelegt.
- **Zwei parallele Tooltip-Systeme:** AGT-2156 bringt `[appTooltip]` (eigenes Overlay),
  develop nutzt bereits `[cacTooltip]` aus coding-agent-chat/shared. Kein Konflikt,
  aber Konsolidierungskandidat.
- **AGT-2163 Verhaltenswechsel:** Der Salvage stellt den Orchestrator-Chat backendseitig
  von Claude-Session-Resume auf GPT-only Codex-One-Shots um (`DecideCodexAsync`, kein
  Claude-Fallback) — laut Salvage-Docs Ticket-Absicht, aber beim Review bewusst abnehmen.
- **AGT-2193 Security-Merge:** PBKDF2-SHA512/600k statt der im Ziel-Doc geforderten
  Argon2-Klasse (dokumentierte Zielabweichung); `RunnerLeaseAuthorization.IsCurrent`
  ist im local-Profil bewusst fail-open; Salvage-Rewrite von
  `docs/operations/security/overview.md` ließ die "Surfaced project UI"-Leitplanken
  entfallen — beim Review prüfen.

## 4. Offene Punkte / Entscheidungen für Robert

1. **Steer-pending (beide warten auf menschliche Antwort, timeout=0):**
   - CAC-6 (seit 17.07. 19:53): "agent-studio-worktree-unavailable — ohne
     Worktree-Isolation direkt im Projektordner arbeiten?" Empfehlung: Nein;
     stattdessen im existierenden Task-Worktree (`chat-nachrichten-vollsta-4f3d0715`)
     weiterarbeiten lassen bzw. Karte neu queuen.
   - CAC-10 (seit **13.07.** 22:09, vermutlich vergessen): "which port should I use?"
     Empfehlung: Konvention klären (angular.json) und antworten oder Karte neu queuen.
2. **Doppelte Quality-Studio-Registrierung:** PROJ-017 "QS2" mit korruptem Pfad
   `C:Projectsquality-studio.orchestratorjobs` (Backslashes verloren). Führt u.a. dazu,
   dass Task-Moves via `watchPath` für QS/CAC 404 liefern (Workaround: `?project=`-Handle).
   Registry-Bereinigung ist ein Operator-Eingriff → Entscheid nötig.
3. **Strukturelle Lücke bleibt:** Solange Salvage→task-Branch-Integration manuell ist,
   erzeugt jede Remote-Welle wieder Grade-D-Phantome. AGT-2177 (jetzt mit echtem
   Salvage-Inhalt reconciled) ist das Ticket dafür — nach dem Durchlauf prüfen, ob die
   Implementierung die Lücke wirklich schließt; sonst nachschärfen.
4. **Human-Review-Berg:** 40 Karten in `5-human-review` — unverändert, rein manuell.

## 5. Verifikation

- Testfixes: betroffene Klassen 21/21 grün, LaneMutex-Race in 4 Wiederholungsläufen
  stabil, develop gepusht.
- Reconcile-Branches: Konfliktmarker-Checks überall; bei Hand-Konflikten dotnet build
  bzw. tsc (AGT-2160 zusätzlich ng test 17/17).
- Pipeline nimmt requeute Karten an (CAC-7 + QS-15 liefen bei Redaktionsschluss aktiv).
