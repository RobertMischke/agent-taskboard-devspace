# Voice Studio Backend

ASP.NET Core (.NET 10). Semantische Reviews verwenden CodingAgentRunner; der TypeScript-Quelladapter verwendet die lokal installierte TypeScript-Bibliothek.

Start aus der Voice-Studio-Projektwurzel:

```sh
dotnet run --project backend/VoiceStudio.Api
dotnet run --project backend/VoiceStudio.Tests
```

Voice Studio bindet 127.0.0.1:5188; die echte Beispielwebsite mit eigenen Scripts und Browserzuständen läuft isoliert auf 127.0.0.1:5189. Dieser zweite Origin liefert ausschließlich öffentliche Beispieldateien und die Review-Library, keine Studio-API oder Review-Metadaten. `VOICE_STUDIO_HOME` kann die Projektwurzel setzen. Das gebaute Angular-Frontend wird unter `/` ausgeliefert, die Library unter `/library/voice-review.js` und das Integrationsbeispiel unter `/examples/library-embed/index.html`.

## Sitzung

Eine pro Workspace gehaltene exklusive Dateisperre verhindert gleichzeitige Instanzen vor der Erneuerung der Sitzungsschlüssel. Ein zweiter Start beendet sich mit Fehlerstatus und lässt die laufende Sitzung unverändert. Das Startprotokoll nennt die Prozess-ID.

Der pro Start erneuerte Bearer und Pairing-Code liegen im Benutzerprofil unter `LocalApplicationData/VoiceStudio/sessions/<workspaceHash>/session.json`. Der neue Sitzungsordner und die Datei erhalten unter Windows eine ACL nur für den aktuellen Benutzer, unter Unix 0700/0600. `.voice-studio/session-location.json` enthält ausschließlich den Dateipfad. Der Pairing-Code steht zusätzlich im lokalen Startprotokoll.

`GET /api/session` zeigt den Status. `POST /api/session/pair` mit `{code}` liefert `{token}`. Projektoperationen benötigen `Authorization: Bearer ...`. Host und Origin sind auf localhost/127.0.0.1 und Ports 4188/5188 beschränkt. Externe CORS-Freigaben fehlen bewusst; Einbindungen nutzen denselben Origin oder einen lokalen Dev-Proxy.

## Daten und Änderungen

Registrierungen liegen in `.voice-studio/projects.json`. Feedback, Vorschläge und lokale Verbesserungsaufträge liegen im jeweiligen Projekt unter `.voice-lint/reviews/doc-*.voice-meta.json`. GET-Dokument-Unterpfade `/proposals` und `/requests` liefern die gespeicherte Historie, jeweils neueste zuerst. Vorschläge sind `pending` oder `applied`; Aufträge bleiben `queued-local` und starten keinen Agenten.

Feedback prüft Quellversion und Reviewrevision; Request-IDs machen Wiederholungen idempotent. Vorschläge enthalten den vollständigen Quelldiff. Nur eine explizite Anwendung mit passender SHA-256-Quellversion schreibt die Datei. UTF-8-BOM und Zeilenenden bleiben erhalten. Backups und Journale unter `.voice-lint/backups` und `.voice-lint/transactions` sichern die Anwendung und helfen bei Wiederanlauf. DELETE einer Registrierung entfernt keine Projektdatei.

Unterstützt sind UTF-8-HTML, eine begrenzte Markdown-Teilmenge und explizit konfigurierte TypeScript-Inhaltsmodule (siehe unten). Auswahlen zählen UTF-16-Codeeinheiten. Änderungen über Markupgrenzen, geteilte Unicode-Zeichen, dynamische Interpolationen und data-i18n-Fallbacks werden abgelehnt. Im HTML-Adapter sind Scripts, Übersetzungs-Dictionaries, Frameworkcode und HTML-Attribute nicht Teil der Analyse. Der TypeScript-Adapter liest ausschließlich die unten beschriebenen konfigurierten Inhalte. Vier lokale Regeln liefern Hinweise; Claims sind keine Faktenprüfung. Coverage nennt diese Grenzen. Es gibt keinen Voice-Score.

## Echte Website und Angular-Quellen

`PATCH /api/projects/{id}/browser` speichert `{url}` als lokale Browseradresse. Zugelassen sind ausschließlich HTTP(S) auf localhost, 127.0.0.1 oder ::1, ohne eingebettete Zugangsdaten und auf einem anderen Origin als Studio. Die Website muss die Review-Bridge selbst einbinden; der Server lädt oder proxyt keine fremden URLs.

Ein Projekt kann mit `voice.config.json` explizit TypeScript-Content freigeben: `version: 1`, `sourceFiles: ["src/app/content/*.ts"]`, `liveUrl` und `routes` (Browserpfad auf Quellmodul). `sourceContexts` ordnet Quellmodulen vorhandene Angular-Komponenten-/Template-Dateien für einen semantischen Review zu. Alle Pfade bleiben im Projekt. Ohne diese Freigabe werden TypeScript-Dateien nicht analysiert.

Der TypeScript-AST-Adapter verwendet Node.js und die installierte TypeScript-Bibliothek; er führt die Website-Dateien nicht aus. Er extrahiert Textliterale aus exportierten Objekt-/Arraywerten für ausgewählte redaktionelle Eigenschaften. String-Escapes und UTF-16-Positionen werden exakt abgebildet. Ausführbarer Code, importierte Werte und interpolierte Templates bleiben ausgeschlossen. Teilbereichsänderungen bewahren die String-Begrenzer und werden vor der Anwendung erneut geparst. Konfigurierte Komponentenkontexte sind schreibgeschützt und begrenzt; gekürzte Kontextdateien werden ausdrücklich markiert.

TypeScript-Projektberichte extrahieren kalte Quelldateien in begrenzten Node-Batches. Ein nach Quellinhalt adressierter, prozesslokaler FIFO-Cache hält höchstens 256 Dokumente und zwei Millionen Text-Codeeinheiten; es entsteht kein zusätzlicher persistenter Analysecache. Ein Bericht verwendet eine Dateiinventur und validiert gemeinsam verwendete Komponentenkontexte einmal. Quelländerungen bleiben durch SHA-256-Vorbedingungen geschützt.

## Durable editorial tasks

The document-scoped `/api/projects/{projectId}/documents/{documentId}/tasks`
API persists an instruction, explicit feedback selection, source/review versions
and a frozen copyable prompt before any model runs. Existing `/requests`
records remain available; they are not silently migrated or dispatched.

- `GET/POST /tasks`: list or save queued tasks.
- `GET /tasks/{id}`: current durable state and complete proposal diff.
- `GET /tasks/{id}/prompt`: frozen Plan B prompt with its source/review versions.
- `POST /tasks/{id}/start`: explicit, idempotent start through the existing
  CodingAgentRunner service and server-configured CLI/model route.
- `POST /tasks/{id}/cancel`: request cancellation; no automatic retry.
- `POST /tasks/{id}/apply`: explicitly apply one reviewed source-file proposal.
- `POST /tasks/{id}/resolve`: mark a non-running task handled with a required
  human explanation and current source/review preconditions; writes no source.

States are `queued`, `running`, `cancelling`, `ready`, `failed`,
`cancelled`, `stale`, `interrupted`, `applied`, `needs_review` and `completed`.
A successful run explicitly confirming `already_satisfied`, with a reason and
no open findings, is `completed` with `resolution: agent_no_changes`. Missing
facts or unsupported structural/multi-file work becomes `needs_review`. Manual completion records `resolution: manual`
and a rationale. Ready means a proposal awaits human review, not that every
factual question has been resolved. Agent notes remain visible.
Each task has one explicit run attempt; another attempt is a new task.
Server restart never restarts inference.

Task records live in `.voice-lint/tasks/{documentId}/{taskId}.json` and link
the persisted semantic run to a single composite proposal. The model receives
one full supported source file, only the selected feedback, and bounded explicit
component context, in an isolated clean read-only workspace. It can return up to
50 exact, non-overlapping text replacements. The existing source adapters validate
all edits before any proposal is persisted; no partial batch or multi-file edit
is applied. HTML bindings, Markdown syntax and TypeScript string escapes retain
the same guards as manual proposals. Full-file hashes protect context files even
when only a prefix is supplied to the model.

Task revisions, source hashes, review revisions and component-context hashes are
checked at the relevant transitions. Applying a task proposal through the generic
proposal route is rejected. Source writes retain the existing backup/journal
recovery, and applying a task never silently resolves human feedback.

Run the isolated fake-runner workflow suite with
`dotnet run --project backend/VoiceStudio.TaskTests`.
It requires no model account or paid invocation.

Source-unit fingerprints also bind saved feedback, tasks and semantic runs to
the parser's current mapping. An adapter upgrade can change unit IDs without
changing the source hash. Legacy or changed mappings trigger one durable review
revision; a note is reattached only when its quote and stored prefix/suffix
identify exactly one location, otherwise it needs manual reattachment. A task
with no feedback is also invalidated by a changed unit map. Existing semantic
evidence with an older map becomes stale.

## Local project checks

Explicit project build/test checks are configured only in the private host session directory. See [CHECKS.md](CHECKS.md) for the fixed-command configuration, guarded source fingerprint, API, bounded logs and isolated tests. They are independent of semantic agent runs and never start automatically after applying a proposal.
