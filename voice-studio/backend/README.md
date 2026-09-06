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
