# Agent-Studio-Website: redaktionelle Prüfung vom 6. September 2026

Geprüft: **27 von 27 Routen, 30 von 30 Inhaltsdateien**. 36 gezielte Befunde; Website-Quelltext unverändert. Maschinenlesbare Befunde einschließlich Literalankern und Source-Hashes: [agent-studio-website-2026-09-06.json](./agent-studio-website-2026-09-06.json).

Die höchste Priorität hat die News-Meldung: Die verlinkte Anbieterquelle hat die angekündigte Änderung ausgesetzt. Die lokale Angular-Planung beschreibt bereits erledigte Architektur-/Lint-Arbeit noch als Ausgangszustand. Setup, Host-Zugangsdaten und Roadmap benötigen einen gemeinsamen Abgleich mit dem veröffentlichten Produktstand. Die aktuelle Dev-Dokumentation ist dafür ein Gegenbeleg, kein Release-Nachweis.

## Umfang und Bewertungsmaßstab

Alle 30 TypeScript-Inhaltsdateien vollständig gelesen; 27 lokale Routen erfasst; ausgewählte aktuelle Produktdokumente und Implementierungsquellen gegengeprüft; zwei einschlägige offizielle Webquellen gelesen. Befunde durch TypeScript-AST auf exakte decodierte Literaltexte geprüft. Kein zusätzlich gestarteter Coding-Agent-/LLM-Runner, keine Website-Quelltextänderung.

Lokaler Website-Stand und aktueller Dev-Checkout; keine unabhängige Bestätigung eines veröffentlichten Produkt-Releases. Befunde mit needs-product-verification sind Abgleichaufträge. Kein umfassender Sicherheits-, Rechts-, Browser-, Accessibility- oder Laufzeittest.

Ein Befund ist kein automatischer Fehlerentscheid: **Belegter Widerspruch**, **Produktstand abgleichen**, **Beleg ergänzen** und **redaktioneller Vorschlag** bleiben getrennt. Confidence bezeichnet die Sicherheit des Review-Bedarfs, nicht die Wahrscheinlichkeit einer ungeprüften falschen Produktbehauptung. Ein Ersatztext ist immer begrenzt auf das zitierte Literalstück und bedarf der inhaltlichen Annahme.

Die englische Originalsorte bleibt erhalten. Qualifizierte Leistungsversprechen, persönliche Positionierung, ausdrücklich datierte Kennzahlen, benannte Demo-Captures und als Outline bezeichnete Forschungstexte werden nicht allein wegen starker Wörter markiert. Insbesondere bleibt das deutsche Manifest als gekennzeichnetes Original unangetastet. Bei Captures wurden nur tatsächlich gerenderte Zweige bewertet; ausgeblendete statische Kennzahlen sind kein veröffentlichter Claim.

## Empfohlene Reihenfolge

1. News zuerst mit dem aktuellen Hinweis der verlinkten Anbieterquelle korrigieren; Titel, Lead und Body zusammen prüfen.
2. Website-Zielrelease festlegen; Setup, Status und Host-Sicherheits-/Roadmap-Text daran gemeinsam abgleichen.
3. Angular-Plan und Pricing-Verantwortung anhand lokaler Implementierung aktualisieren.
4. Konkrete redaktionelle Vorschläge selektiv übernehmen; Research-Outlines und schematische Karten passend kennzeichnen.
5. Im Voice-Studio zunächst Feedback mit Belegen importieren. Ersatztexte bleiben Vorschläge; kein Auto-Apply. sourceVersion und exaktes Zitat vor Import/Fix erneut validieren.

## Abdeckung

| Inhaltsdatei | Route / Rolle | Befunde | Prüfvermerk |
| --- | --- | --- | --- |
| [about.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/about.ts) | /about | Kein konkreter Befund | Biografischer und persönlicher Kontext; kein konkreter redaktioneller Änderungsbedarf. Private Tatsachen wurden nicht unabhängig nachrecherchiert. |
| [agents.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/agents.ts) | shared-content | Kein konkreter Befund | Gemeinsame Agentenbeschreibungen gelesen. Kein pauschaler Befund gegen Wörter wie powerful/strong; heutige Eignung der Anbieter für alle Aufgaben nicht unabhängig qualifiziert. |
| [article-specs-context-not-control.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/article-specs-context-not-control.ts) | /articles/specs-are-context-not-control | ASW-034 | Gesamter Artikel gelesen. Grundstruktur von Kiro anhand offizieller Specs-Dokumentation geprüft; Positionierung und Meinungsargument bleiben als solche bestehen. |
| [article-workforce-sensemaking-cli.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/article-workforce-sensemaking-cli.ts) | /articles/workforce-sensemaking-cli | ASW-035 | Gesamtes Outline gelesen. Draft-Status ist erkennbar; fehlende Beobachtungsbelege werden nicht durch erfundene Beispiele ersetzt. |
| [articles.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/articles.ts) | /articles | ASW-033 | Beide Einträge und ihre vorhandenen Routen geprüft. Outline-Label ist keine Täuschung über einen fertigen Erfahrungsbericht. |
| [best-practice-angular-quality-rails.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/best-practice-angular-quality-rails.ts) | /patterns/angular-quality-rails | ASW-002, ASW-003 | Vollständig gelesen und mit package.json, getrenntem Template und Inhaltsinventar abgeglichen. Kein Lint-Lauf für diese redaktionelle Prüfung. |
| [captures.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/captures.ts) | shared-content | ASW-036 | Alle gemeinsamen Captions, Texte, Zahlen und Beispielzeilen gelesen; Renderer-Verzweigung geprüft. metrics/rows bei imageSrc sind nicht sichtbar und werden nicht als veröffentlichte Kennzahlen beanstandet. Kein Pixel-/Screenshot-Beweis für jede Caption. |
| [comparison.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/comparison.ts) | /compared-to-other-products | ASW-027, ASW-028 | Vergleichstext und Matrix gelesen, lokale Ziele geprüft. Aktuelle externe Feature-Matrix nicht vollständig unabhängig verifiziert; keine unbelegte Behauptung, Anbieterfunktionen seien falsch. |
| [context-management.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/context-management.ts) | /context-management | ASW-021 | Gesamtes Projekt-/Task-Kontextmodell gelesen. Zukunftsformulierungen zu Query/History nicht automatisch als fertige Funktion bewertet. |
| [documentation.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/documentation.ts) | /documentation | ASW-022, ASW-023 | Gesamte Lesefolge und Begriffe gelesen. Keine Rechts-/Security-Garantie aus logischem Repository-Scope abgeleitet. |
| [dossier-model.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/dossier-model.ts) | /dossiers | Kein konkreter Befund | Alle Phasen, Dossier-/Epic-/Task-Abgrenzungen und Übergänge gelesen. Kein hinreichend konkreter Änderungsbedarf; abstrakte Modellbegriffe sind im erklärenden Kontext vertretbar. |
| [getting-started.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/getting-started.ts) | /getting-started | ASW-005, ASW-006, ASW-007 | Gesamte Voraussetzungen, Architektur und Zeitfolge gelesen. Setup-Kohorte muss an veröffentlichten Stand gebunden werden; Zeitversprechen nicht gemessen. |
| [home.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts) | / | ASW-015, ASW-016, ASW-017, ASW-018, ASW-019, ASW-020 | Gesamte Homepage gelesen. Historische Commit-/Zeilen-Zahlen mit Zeitfenster und Zählmethode bleiben als Snapshot erhalten; sie wurden nicht als heutige Qualität bewiesen oder pauschal beanstandet. |
| [imprint.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/imprint.ts) | /imprint | Kein konkreter Befund | Alle Anbieter-, Kontakt- und Datenschutztexte gelesen. Kein sprachlicher Änderungsbedarf festgestellt. Dies ist keine juristische Vollständigkeitsprüfung und keine Prüfung der realen Hosting-/E-Mail-Verarbeitung. |
| [index.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/index.ts) | loader-registry | Kein konkreter Befund | Gesamtes Registry-/Loader-Modul geprüft; technische Zuordnung, keine eigenständige öffentliche Seitenprosa. |
| [manifesto.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/manifesto.ts) | /manifesto | Kein konkreter Befund | Englische Argumentation und ausdrücklich wörtlicher deutscher Originaltext vollständig gelesen. Zuspitzungen sind als Manifest/These gerahmt. Keine stillschweigende Redaktion des als Original bezeichneten Textes; keine allgemeine Produktivitätsmessung behauptet. |
| [news.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/news.ts) | /news | ASW-001 | Gesamte Meldung und ihre verlinkte aktuelle Primärquelle geprüft. Korrektur betrifft einen überprüften Widerspruch, nicht nur eine Stilpräferenz. |
| [open-source.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/open-source.ts) | /open-source | ASW-008 | Lizenz-/Beteiligungs-/Repository-Text gelesen; kanonischen Link abgeglichen. Keine Rechtsberatung zum Umfang der Lizenz. |
| [pattern-external-cli-on-the-side.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/pattern-external-cli-on-the-side.ts) | /patterns/external-cli-on-the-side | ASW-031 | Gesamter Seitenworkflow und API-Voraussetzungen gelesen; keine zusätzlichen universellen CLI-Fähigkeiten behauptet. |
| [pattern-plus-one-developer.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/pattern-plus-one-developer.ts) | /patterns/plus-one-developer | Kein konkreter Befund | Gesamtes Muster gelesen. Zusätzliche Kapazität ist durch Scope, getrennte Arbeitsbereiche und menschliche Aufmerksamkeit qualifiziert; kein erzwungener Befund gegen die +N-Metapher. |
| [pattern-workforce-sensemaking-cli.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/pattern-workforce-sensemaking-cli.ts) | /patterns/workforce-sensemaking-cli | ASW-032 | Gesamtes Muster samt Research-Abschnitt gelesen. Ausdrücklicher Outline-Status wird erhalten. |
| [patterns.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/patterns.ts) | /patterns | ASW-029, ASW-030 | Alle Katalogeinträge und vorhandenen Detailrouten gelesen. Muster können Arbeitsweisen beschreiben und müssen nicht sämtlich automatische Produktfunktionen sein. |
| [product.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/product.ts) | /product | ASW-009, ASW-010, ASW-014 | Alle Produktbereiche einschließlich Remote-Hosts, Agenten, Modelle, Token, Review, Chat und Drift gelesen; aktuelle Setup-/Host-Dokumentation als qualifizierter Gegenbeleg genutzt. |
| [relationship-model.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/relationship-model.ts) | /relationship-model | Kein konkreter Befund | Gesamtes Modell zu Task, Job, Branch, Commit, Review und Release gelesen. Integration vor menschlicher Annahme ist ausdrücklich beschrieben und wird nicht in eine andere Sicherheitszusage umgedeutet. Keine vollständige Laufzeitprüfung jeder Relation. |
| [screenshots-tour.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/screenshots-tour.ts) | /screenshots | Kein konkreter Befund | Alle vier Tourabschnitte gelesen. Reale Captures und gepinnte Demo-Zustände werden ausdrücklich erklärt. Kein neuer vollständiger Screenshot-/Video- oder Reproduzierbarkeitstest; kein unbelegter Mockup-Vorwurf. |
| [security.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/security.ts) | /security | ASW-026 | Alle Grenzen, Konten, Credentials und Review-Hinweise gelesen. Qualifizierte Aussagen und Verantwortung des Betreibers bleiben erhalten; keine Sicherheitszertifizierung durchgeführt. |
| [software-quality.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/software-quality.ts) | /software-quality | ASW-025 | Gesamte Qualitätsargumentation gelesen. Prüfungen, menschliche Entscheidung und risikobasierte Intensität bleiben erhalten; Screenshot-Geltungsbereich wird präzisiert. |
| [status.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/status.ts) | /status | ASW-004, ASW-011 | Vollständiger Alpha-/Beta-/Roadmap-Text gelesen. Unbekannte Veröffentlichung wird nicht als bestätigte Verfügbarkeit ausgegeben. |
| [tokens.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/tokens.ts) | /tokens | ASW-012, ASW-013 | Gesamte Kosten-/Produktionsfaktor-Argumentation gelesen und Library-Zuordnung im aktuellen Quellcode geprüft. Historische Preise/unknown-Behandlung werden unterstützt, keine pauschale Aktualität aller Tarife behauptet. |
| [work-model.ts](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/work-model.ts) | /how-work-happens | ASW-024 | Gesamter Lebenszyklus gelesen, einschließlich Abbruch, Fortschrittsdimensionen, externer Erledigung und Integration vor Annahme. Konkrete Release-Semantik bleibt erhalten. |

## Befunde

### ASW-001 · Ausgesetzte Anbieteränderung als geltende Änderung dargestellt

**claims · error · Belegter Widerspruch · Confidence 0.99**

[src/app/content/news.ts:10](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/news.ts:10) — /news

> On June 15, 2026, Claude Code Agent SDK and claude -p usage on Claude subscription plans move to a separate monthly Agent SDK credit.

Die verlinkte Primärquelle enthält inzwischen einen ausdrücklichen Aufschub. Der frühere Haupttext darunter gilt nur noch als historische Referenz. Die Website übernimmt dessen Aussage ohne den korrigierenden Hinweis. Titel und Abschnitt „What Changes“ müssen zusammen abgeglichen werden.

Vorschlag: “Anthropic paused the announced Claude Agent SDK usage changes on June 15, 2026. Check the current policy when configuring a CLI workflow.”

Belege: [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan).

### ASW-002 · Ist-Analyse beschreibt einen überholten Website-Stand

**claims · warning · Belegter Widerspruch · Confidence 0.99**

[src/app/content/best-practice-angular-quality-rails.ts:12](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/best-practice-angular-quality-rails.ts:12) — /patterns/angular-quality-rails

> This plan is based on the current website app: Angular 21, Prettier installed, no ESLint or Stylelint scripts yet, one large `site-content.ts`, large `page.component.scss`, and mostly inline templates. The goal is better structure before the site becomes hard to maintain.

Im geprüften Repository existieren bereits Lint-Scripts für TypeScript, Templates und SCSS, 30 Inhaltsmodule und ein separates HTML-Template. Der als aktuell bezeichnete Ausgangspunkt ist damit überholt. Den Plan als datierten Rückblick kennzeichnen oder auf verbleibende Arbeit umstellen; die allgemeinen Qualitätsregeln bleiben sinnvoll.

Vorschlag: “The website now has per-route content modules, separate HTML templates and lint commands for TypeScript, templates and SCSS. Keep these checks and component boundaries effective as the site grows.”

Belege: [agent-studio-for-software-website/04-angular-static-final/package.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/package.json); [agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts); [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-003 · Nicht vorhandene Lint-Scripts werden behauptet

**claims · warning · Belegter Widerspruch · Confidence 0.99**

[src/app/content/best-practice-angular-quality-rails.ts:26](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/best-practice-angular-quality-rails.ts:26) — /patterns/angular-quality-rails

> The package has Prettier but no ESLint, Angular template linting or Stylelint scripts yet.

package.json enthält bereits lint:ts, lint:templates und lint:scss. Dies ist ein konkreter Gegenbeleg zur Negativaussage; die Existenz der Scripts sagt allein noch nichts über den aktuellen Check-Erfolg aus.

Vorschlag: “The package includes lint commands for TypeScript, Angular templates and SCSS.”

Belege: [agent-studio-for-software-website/04-angular-static-final/package.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/package.json).

### ASW-004 · Installationsstatus mit aktueller Produktdokumentation abgleichen

**claims · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/status.ts:24](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/status.ts:24) — /status

> Build from source: there is no installer and no hosted account — you clone the repository and build the binaries.

Die aktuellen Dev-Dokumente beschreiben Docker Compose als Einstieg und einen geführten Linux-Setup-Weg. Das passt nicht zum uneingeschränkten „kein Installer“. Vor der Textfreigabe klären, auf welchen veröffentlichten Produktstand sich die Website bezieht; die Dev-Dokumentation allein beweist keine öffentliche Release-Verfügbarkeit. Das fehlende Hosted-Angebot wird hier nicht bestritten.

Vorschlag: “Follow the repository’s current setup guide for the supported installation paths. Agent Studio does not provide a hosted account.”

Belege: [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md); [agent-taskboard-dev/docs/operations/setup/getting-started.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/setup/getting-started.md).

### ASW-005 · Einstiegsanleitung setzt einen alten Build-Pfad voraus

**claims · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/getting-started.ts:14](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/getting-started.ts:14) — /getting-started

> This is the shortest useful path through an early-alpha tool. You build the three binaries from source, connect one repository and run a coding-agent CLI you already use — on your workstation or a remote host. There is no installer or hosted account yet.

Der Leser soll drei Binaries selbst bauen, während die aktuellen Produktdokumente einen Docker-Einstieg und getrenntes Host-Onboarding beschreiben. Den freigegebenen Einstieg festlegen und anschließend Zusammenfassung, Schritte, Voraussetzungen und Zeitangaben gemeinsam daran ausrichten. Die 30 Minuten sind ohne gemessenen Ablauf weder bestätigt noch als falsch eingestuft.

Vorschlag: “Start with the repository’s current setup guide. Once Agent Studio is running, connect a repository and configure an Agent Host with the coding-agent CLI you intend to use.”

Belege: [agent-taskboard-dev/docs/operations/setup/getting-started.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/setup/getting-started.md); [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md).

### ASW-006 · Voraussetzungen passen nicht zum dokumentierten Docker-Einstieg

**structure · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/getting-started.ts:25](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/getting-started.ts:25) — /getting-started

> Install Git, Node.js and the coding-agent CLI you intend to run.

Beim dokumentierten Docker-Weg benötigt der erste Start Git und Docker Compose; Node.js und eine angemeldete CLI sind dort keine Host-Voraussetzung. Die CLI kommt mit der Ausführungsumgebung hinzu. Nach Wahl des veröffentlichten Setup-Pfads die Schritte trennen, statt Nutzer unnötig lokale Entwicklungswerkzeuge installieren zu lassen.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-taskboard-dev/docs/operations/setup/getting-started.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/setup/getting-started.md).

### ASW-007 · Repository-Name weicht vom kanonischen Projektlink ab

**structure · warning · Belegter Widerspruch · Confidence 0.99**

[src/app/content/getting-started.ts:42](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/getting-started.ts:42) — /getting-started

> Clone github.com/RobertMischke/agent-studio and enter the checkout.

Der gemeinsame Website-Link und das aktuelle Produkt-README nennen agent-orc/agent-studio. Prosa und benachbarten Clone-Befehl auf diesen kanonischen Link vereinheitlichen. Ob GitHub den alten Namen weiterleitet, wurde nicht geprüft; der Befund behauptet keinen kaputten Redirect.

Vorschlag: “Clone github.com/agent-orc/agent-studio and enter the checkout.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts); [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md).

### ASW-008 · Zweiter abweichender Repository-Name

**structure · info · Belegter Widerspruch · Confidence 0.99**

[src/app/content/open-source.ts:24](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/open-source.ts:24) — /open-source

> Repository: github.com/RobertMischke/agent-studio.

Auch die Open-Source-Seite verwendet den alten Owner-Namen, während der zentrale Link agent-orc nutzt. Gemeinsamen kanonischen Wert verwenden; daraus folgt keine Aussage über die Erreichbarkeit des alten Links.

Vorschlag: “Repository: github.com/agent-orc/agent-studio.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts); [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md).

### ASW-009 · Remote-Host-Zugangsdaten zu absolut ausgeschlossen

**claims · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/product.ts:185](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/product.ts:185) — /product

> The security model is deliberate: the host holds no Git-hosting credentials, nothing listens publicly, and an SSH tunnel is the only door until you decide otherwise.

Der aktuelle Host-Runbook beschreibt Schreib-Deploy-Keys beziehungsweise Push-Identitäten pro Host und Repository. Das widerspricht einem generellen Verzicht auf Git-Hosting-Zugangsdaten auf dem Host. Netzwerkzugang und Zugangsdaten müssen für den tatsächlich veröffentlichten Betriebsmodus beschrieben werden; ein früheres Tunnel-Modell darf nicht als universeller heutiger Zustand erscheinen.

Vorschlag: “Configure host credentials and network exposure explicitly. Follow the current host setup guide for repository access and the connection model.”

Belege: [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md).

### ASW-010 · Host-Verwaltung pauschal als Roadmap geführt

**claims · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/product.ts:187](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/product.ts:187) — /product

> Roadmap: remote hosts become first-class product objects — a host registry with per-CLI quota, per-project execution assignment and a guided onboarding wizard.

Aktuelle Produktdokumente beschreiben bereits die Verwaltung und das geführte Hinzufügen von Execution Hosts sowie projektbezogene Repository-Konfiguration. Pro Teilfunktion den veröffentlichten Stand prüfen und nur verbleibende Arbeit als Roadmap ausweisen; aus dem Runbook folgt nicht automatisch, dass jede genannte Quotenfunktion veröffentlicht ist.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md).

### ASW-011 · Roadmap wiederholt möglicherweise bereits gelieferte Host-Funktionen

**claims · warning · Produktstand abgleichen · Confidence 0.94**

[src/app/content/status.ts:44](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/status.ts:44) — /status

> Remote hosts as first-class objects: a host registry, per-CLI quota and per-project execution assignment.

Diese Roadmap-Liste muss dieselbe Release-Entscheidung wie die Produktseite verwenden. Der aktuelle Host-Runbook belegt bereits Teile davon; noch offene Quoten-/Zuweisungsdetails getrennt benennen. Keine pauschale Ersetzung durch „alles fertig“.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md).

### ASW-012 · Pricing-Verantwortung dem falschen Paket zugeordnet

**claims · warning · Belegter Widerspruch · Confidence 0.99**

[src/app/content/tokens.ts:69](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/tokens.ts:69) — /tokens

> the coding-agent-runner pricing library

Der aktuelle Studio-Adapter importiert Token Economy und verwendet TokenEconomyPriceProvider. Coding-Agent-Runner ist damit nicht die in diesem Quellstand verwendete Pricing-Quelle. Den gesamten Absatz einschließlich seiner Zielzustands-Klammer aktualisieren; vor Veröffentlichung den beabsichtigten Release-Stand bestätigen.

Vorschlag: “the Token Economy pricing library”

Belege: [agent-taskboard-dev/backend/Features/Runner/TokenPricing.cs](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/backend/Features/Runner/TokenPricing.cs); [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md).

### ASW-013 · Allgemeiner Kostenvorteil ohne Vergleichsgrundlage

**claims · warning · Beleg ergänzen · Confidence 0.94**

[src/app/content/tokens.ts:25](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/tokens.ts:25) — /tokens

> The cost is lower than classical software production, but it is still a strategic factor.

Aus Tokenpreisen allein folgt kein allgemeiner Vorteil bei Gesamtkosten. Die Seite nennt selbst Nacharbeit, Prüfung und menschliche Zeit als Faktoren. Einen konkreten Vergleich mit Aufgabe, Zeitraum und Kostenumfang belegen oder die Aussage konditional formulieren. Der Befund behauptet nicht, agentische Entwicklung sei grundsätzlich teurer.

Vorschlag: “Whether agent-assisted development costs less depends on the task, rework, verification and human time.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/tokens.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/tokens.ts).

### ASW-014 · Dynamische Modellzahl ohne nachvollziehbaren Stichtag

**claims · warning · Beleg ergänzen · Confidence 0.94**

[src/app/content/product.ts:29](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/product.ts:29) — /product

> 255 tool-capable models on OpenRouter

Die präzise Zahl benötigt einen Katalogstand und eine Definition des Filters „tool-capable“. Die Rubrik Open-Weight Models wirft zusätzlich die Frage auf, ob auch nach Gewichtsverfügbarkeit gefiltert wurde. Inventar und Zahl wurden hier nicht neu erhoben: als zu prüfen kennzeichnen, nicht als falsch. Verfügbarkeit ist außerdem kein Qualitätsnachweis für eine Aufgabe.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts).

### ASW-015 · Startnutzen konkreter als garantierte Entlastung ausdrücken

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:30](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:30) — /

> Agent Studio turns Codex, Claude Code and Gemini into bounded, reviewable software work. Keep tasks, project context, agent runs, evidence and decisions in one place — so more agent output does not become more mental overhead.

Die Zusammenfassung verbindet konkrete Funktionen mit einem uneingeschränkten Entlastungsergebnis. Für den ersten Kontakt lässt sich genauer sagen, was der Leser zuweisen und gemeinsam prüfen kann. Die Positionierung rund um kognitive Last bleibt sinnvoll; sie muss nicht als garantiertes Ergebnis jedes Einsatzes erscheinen.

Vorschlag: “Use Agent Studio to assign tasks to Codex, Claude Code and Gemini. Keep each task’s scope, project context, runs, evidence and review decisions together.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts); [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-016 · Gewünschten Review-Ablauf nicht jedem Run zusichern

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:92](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:92) — /

> A successful agent run is not completed software. Every run starts with a bounded task, gathers evidence and ends with an explicit review decision.

„Every run … ends“ beschreibt den idealen Prozess wie einen unvermeidlichen Ausgang. Die Workflow-Seite berücksichtigt auch gestoppte und unvollständige Runs. Als Handlungsfolge formuliert bleibt der gewünschte Qualitätsanspruch erhalten, ohne diese Zustände auszublenden.

Vorschlag: “Define the task’s scope before starting an agent. Review the resulting changes and evidence, then decide whether to accept the work or request a follow-up.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-017 · UX-Fachbegriff verdeckt die konkrete Bedienfolge

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:125](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:125) — /

> Progressive disclosure starts with the current state and required decision, then shows the summarized result. Evidence is directly accessible; protocol, history and diffs remain available for deep inspection.

„Progressive disclosure“ erklärt die Designmethode. Ein neuer Nutzer braucht hier vor allem die Reihenfolge seiner Prüfung und die verfügbaren Ansichten. Der Vorschlag übersetzt dieselbe Funktion in eine Bedienhandlung.

Vorschlag: “Check the task’s current status and result summary first. Open the run log, history or diff when you need to inspect how the result was produced.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts); [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-018 · Ausführung überall ist weiter als der belegte Betriebsumfang

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:133](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:133) — /

> Central state. Execution anywhere.

Die Kurzzeile löst die Aussage vom konfigurierten lokalen oder entfernten Host. Die Produktseite nennt ausdrücklich eine begrenzte OS-Validierung. „Local or remote“ vermittelt die Architektur, ohne Kompatibilität mit beliebigen Umgebungen anzudeuten.

Vorschlag: “Shared task state. Local or remote execution.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts); [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md).

### ASW-019 · Architekturbeschreibung auf konfigurierte Hosts begrenzen

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:135](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:135) — /

> One Task Server keeps every task, run and review decision coherent. Agent Runners execute coding-agent CLIs on any host you control. Agent Studio gives the work one browser surface.

„Any host“ überspringt Installation, unterstützte Laufzeit und Konfiguration. Der konkrete Zusammenhang zwischen gespeichertem Task-Zustand, CLI-Ausführung und Browser-Review reicht zur Erklärung aus. Keine unbelegte Liste zusätzlicher unterstützter Betriebssysteme ergänzen.

Vorschlag: “The Task Server stores tasks, runs and review decisions. Agent Runners execute coding-agent CLIs on configured local or remote hosts. Use Agent Studio in the browser to review the work.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts); [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md).

### ASW-020 · Ersten Schritt als überprüfbare Handlung formulieren

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/home.ts:187](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/home.ts:187) — /

> Clone Agent Studio, connect a safe repository and take one deliberately small change from bounded intent to an evidence-backed decision.

„Safe repository“, „bounded intent“ und „evidence-backed decision“ komprimieren mehrere interne Begriffe. Den gewünschten Ablauf mit einem gefahrlos änderbaren Repository, kleiner Aufgabe und Prüfung vor Annahme ausdrücken. Der Setup-Link vermeidet einen erneuten Build-first-Claim, solange der Release-Abgleich offen ist.

Vorschlag: “Follow the setup guide, connect a Git repository you can safely change, and start with one small task. Inspect the changes and recorded checks before accepting the result.”

Belege: [agent-taskboard-dev/docs/operations/setup/getting-started.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/setup/getting-started.md); [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-021 · Interne Umbenennung steht vor dem Lesernutzen

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/context-management.ts:14](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/context-management.ts:14) — /context-management

> Context Management replaces the old Docs framing: Agent Studio separates project-level context from task-level context and makes both useful for agent runs, review and drift control.

Die alte Navigations-/Positionierungsentscheidung hilft neuen Lesern nicht. Der folgende Unterschied zwischen Projektregeln und aufgabenbezogenem Kontext ist hingegen nützlich und kann direkt den Einstieg bilden.

Vorschlag: “Agent Studio keeps repository rules and architecture decisions separate from the context of each task. Both remain available during execution and review.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts); [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-022 · Interne Dokumentstruktur statt Lesehilfe beschrieben

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/documentation.ts:12](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/documentation.ts:12) — /documentation

> Read this in order once, then return by concept. It distills the product model instead of mirroring an internal concepts folder file by file.

Der Vergleich mit einem internen concepts-Ordner erklärt den redaktionellen Ursprung. Konkrete Themen als Orientierung sind für den Leser hilfreicher und erhalten die beabsichtigte Leserichtung.

Vorschlag: “Read the task, execution, evidence and context sections in order, then return to the concept you need.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-023 · Acute Context ist im Englischen mehrdeutig

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/documentation.ts:74](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/documentation.ts:74) — /documentation

> Give the Run Acute Context; Keep the Rest as History

„Acute“ wird im Englischen eher als scharf, schwerwiegend oder dringend verstanden. Der Abschnitt meint den für diesen Run relevanten Ausschnitt. Den Begriff direkt benennen, ohne ein zusätzliches Kontextmodell einzuführen.

Vorschlag: “Give Each Run Relevant Context; Keep the Rest as History”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-024 · Interne Metapher erschwert die Release-Erklärung

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/work-model.ts:82](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/work-model.ts:82) — /how-work-happens

> the transparent watering-can model

Die Metapher erklärt neuen Lesern nicht, dass Integration vor der endgültigen Annahme stattfinden kann. Gerade diese Reihenfolge ist entscheidend und sollte direkt benannt werden. Der dokumentierte Workflow wird nicht in ein anderes Freigabemodell umgedeutet.

Vorschlag: “a workflow that integrates task changes before final acceptance”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-025 · Screenshot-Evidenz wird als vollständiger Beweis formuliert

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/software-quality.ts:55](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/software-quality.ts:55) — /software-quality

> Visual evidence proves UI changes and catches layout regressions.

Visuelle Evidenz zeigt bestimmte Zustände und kann bei der Erkennung von Layoutfehlern helfen. Ein Screenshot beweist weder alle Interaktionen noch alle Viewports. Die präzisere Aussage stärkt die Rolle visueller Prüfung, ohne sie mit vollständiger Verifikation gleichzusetzen.

Vorschlag: “Screenshots show captured UI states and help reviewers spot layout regressions.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/software-quality.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/software-quality.ts); [agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html).

### ASW-026 · Isolierte Sicherheitsformel verliert die Einschränkung des Fließtexts

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/security.ts:52](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/security.ts:52) — /security

> Security is a function of token investment, workflow and model quality.

Der Fließtext nennt weitere Faktoren wie Berechtigungen, Zugangsdaten und Ausführungsgrenzen und formuliert den Budgetbeitrag vorsichtiger. Die isolierte Formel lässt Sicherheit insgesamt wie ein Ergebnis von LLM-Investition wirken. Auf den Aufwand für gezieltes Sicherheitsreview begrenzen; keine zusätzliche Sicherheitszusage ergänzen.

Vorschlag: “Targeted security review requires budget, a defined workflow and suitable models.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/security.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/security.ts).

### ASW-027 · Seitenplatzierung statt Vergleichsnutzen im Einstieg

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/comparison.ts:14](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/comparison.ts:14) — /compared-to-other-products

> Comparison content lives outside the main product path. It maps Agent Studio against terminal-only agents, hosted platforms, IDE agents and open-source orchestrators.

Die Position in der Informationsarchitektur ist eine Autorenentscheidung. Der Leser kommt für den Vergleich der Arbeitsabläufe und Kategorien; damit kann der Einstieg direkt beginnen.

Vorschlag: “Compare Agent Studio with terminal agents, hosted platforms, IDE agents and open-source orchestrators.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts).

### ASW-028 · Weiterführende Vergleichsseiten werden ohne vorhandene Ziele angekündigt

**structure · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/comparison.ts:61](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/comparison.ts:61) — /compared-to-other-products

> This hub gives developers the quick answer first, then maps deeper comparison paths: Agent Studio alternatives, Agent Studio vs Codex, Agent Studio vs Claude Code, Agent Studio vs Cursor or Windsurf, and tools for managing coding agents in 2026.

In den 27 lokalen Routen existiert nur dieser Vergleichshub, keine separaten Seiten zu den genannten Gegenüberstellungen. Wenn „paths“ lediglich Themen meint, sollte das so heißen; andernfalls konkrete vorhandene Ziele verlinken. Die Aussage bewertet keine unüberprüften Wettbewerbsfunktionen.

Vorschlag: “This page compares tool categories and the task, review and usage workflows of Agent Studio, Codex and Claude Code.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts); [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-029 · Autorenklassifikation vor den nutzbaren Workflows

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/patterns.ts:10](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/patterns.ts:10) — /patterns

> This is a product learning surface, not a general handbook for agentic software work. Patterns name the repeatable work shapes Agent Studio supports. Best practices are concrete operating rules for using Agent Studio well.

Der Text grenzt das redaktionelle Format ab, bevor Leser eine Aufgabe erkennen. Die angebotenen Workflows lassen sich konkret nennen; die Unterscheidung zwischen Mustern und Checklisten kann in der Listenstruktur verbleiben.

Vorschlag: “Choose a workflow for using Agent Studio: start asynchronous tasks, connect an existing CLI, preserve evidence or set up project checks.”

Belege: [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-030 · Katalogkarte führt bereits eingerichtete Prüfungen als künftigen Plan

**claims · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/patterns.ts:157](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/patterns.ts:157) — /patterns

> Plan ESLint, template linting, SCSS linting, component splitting and reusable Angular components before the website grows further.

Die verlinkte Best-Practice-Seite und ihre Katalogkarte sollten gemeinsam aktualisiert werden. Die Lint-Werkzeuge sind bereits eingerichtet; Komponentenarbeit kann weiterhin offen sein. Erledigte Checks und verbleibende Strukturarbeit getrennt beschreiben.

Vorschlag: “Keep TypeScript, template and SCSS checks effective, and review component boundaries as the website grows.”

Belege: [agent-studio-for-software-website/04-angular-static-final/package.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/package.json); [agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts).

### ASW-031 · Benötigten Kontext als Voraussetzung nennen

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/pattern-external-cli-on-the-side.ts:51](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/pattern-external-cli-on-the-side.ts:51) — /patterns/external-cli-on-the-side

> The agent has enough project context to shape the task, call the API and put the work into the task board.

Der Nutzungshinweis setzt ausreichenden Kontext einfach voraus. Für einen konkreten Workflow ist hilfreicher, welche Informationen und erlaubten API-Aktionen vor dem Erstellen einer Aufgabe feststehen müssen. Die Fähigkeit zur API-Nutzung selbst wird hier nicht bestritten.

Vorschlag: “Provide the project identity, scope, acceptance criteria and permitted API actions before asking the CLI to create the task.”

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-032 · Öffentliche Pattern-Seite enthält einen Auftrag an künftige Autoren

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/pattern-workforce-sensemaking-cli.ts:61](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/pattern-workforce-sensemaking-cli.ts:61) — /patterns/workforce-sensemaking-cli

> A researcher writing the full article should study the pattern as a real operating loop, not as a tooling preference. The central question is how a human keeps understanding while an agent workforce continues producing change.

Der Abschnitt ist ausdrücklich ein Research Outline und deshalb kein versteckter Fertigstellungsclaim. Er unterbricht trotzdem den Nutzungsablauf mit einer Arbeitsanweisung an Autoren. Als öffentliche Forschungsnotiz klar abtrennen oder durch beobachtete Anwendungsschritte ersetzen; keine Sitzung oder Evidenz erfinden.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-033 · Artikelübersicht erklärt ihre Funktion für die Positionierung

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/articles.ts:12](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/articles.ts:12) — /articles

> Articles give Agent Studio a place for durable positioning that is deeper than a feature page but still directly connected to the product. The first article draws the line between spec-driven coding tools such as Kiro and Agent Studio.

„A place for durable positioning“ beschreibt, warum der Autor diese Rubrik gebaut hat. Der Leser sollte erfahren, welche Fragen die Beiträge beantworten. Die Kiro-Grundbeschreibung ist durch die offizielle Specs-Dokumentation gedeckt und wird nicht pauschal als Wettbewerbsabwertung markiert.

Vorschlag: “Read how Agent Studio uses specifications as task context and how a separate CLI can help you review parallel agent work.”

Belege: [Kiro Specs documentation](https://kiro.dev/docs/specs/); [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-034 · Internes Kürzel ohne Erklärung im Argument

**wording · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/article-specs-context-not-control.ts:33](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/article-specs-context-not-control.ts:33) — /articles/specs-are-context-not-control

> APEGs, TASKs and explicit specs preserve intent for concrete agent work.

APEG wird für neue Leser nicht aufgelöst; zusammen mit TASKs wirkt die Aussage wie internes Prozessvokabular. Beim ersten Vorkommen den belegten Begriff erklären oder die tatsächlich gemeinten öffentlich dokumentierten Arbeitsobjekte benennen. Die Bedeutung von APEG wurde hier nicht geraten.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts).

### ASW-035 · Artikel bleibt bei einem Forschungsauftrag statt einem beobachteten Beispiel

**meta · info · Redaktioneller Vorschlag · Confidence 0.91**

[src/app/content/article-workforce-sensemaking-cli.ts:44](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/article-workforce-sensemaking-cli.ts:44) — /articles/workforce-sensemaking-cli

> The article should document how a human keeps orientation while parallel agent work is happening. The best evidence will come from watching a real session and asking which moments would have been harder without the second CLI.

Die Zusammenfassung nennt das Dokument ehrlich ein Outline. Für Leser, die einen nutzbaren Artikel erwarten, fehlt aber das angekündigte Beispiel. Entweder als Forschungsnotiz mit offenen Fragen publizieren oder eine tatsächliche Sitzung dokumentieren und die Autorenanweisungen ersetzen. Ein fertiger Erfahrungsbericht lässt sich nicht allein sprachlich herstellen.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json).

### ASW-036 · Synthetischer Chat-Inhalt braucht eine sichtbare Beispielkennzeichnung

**meta · warning · Redaktioneller Vorschlag · Confidence 0.96**

[src/app/content/captures.ts:329](C:\Projects\agent-taskboard-devspace\agent-studio-for-software-website\04-angular-static-final/src/app/content/captures.ts:329) — /product, /how-work-happens

> 2 projects have high drift. Reissues concentrate token spend.

Dieser feste Text wird als Zeile einer bildlosen Chat-Karte gerendert. Das Template verwendet dafür denselben Rahmen „Agent Studio Stable“ wie für echte Screenshots, ohne hier ein Beispiel-Label zu ergänzen. Die Darstellung kann deshalb wie beobachtete Produkt-Evidenz wirken. Den ganzen bildlosen Kartentyp sichtbar als schematisches Beispiel kennzeichnen; echte Bildcaptions und ausgeblendete Kennzahlen sind davon zu unterscheiden.

Vorschlag: gezielte Prüfung/Überarbeitung; kein Ersatztext ohne die fehlende Entscheidung oder Evidenz.

Belege: [agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html); [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts).

## Quellen und Grenzen der Belege

- **website-package** — [agent-studio-for-software-website/04-angular-static-final/package.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/package.json). ESLint für TypeScript und Angular-Templates sowie Stylelint für SCSS sind als ausführbare Scripts eingerichtet; dies belegt die Existenz, nicht einen aktuellen erfolgreichen Lint-Lauf. Fundstelle: scripts.lint, lint:ts, lint:templates, lint:scss.

- **website-renderer** — [agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/page.component.ts). Das Seiten-Template liegt in einer separaten HTML-Datei. Die Inhaltsmodule werden pro Route geladen. Fundstelle: templateUrl: './page.component.html'.

- **website-routes** — [agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/site-content.ts). Kanonischer Repository-Link agent-orc/agent-studio; 27 veröffentlichte Routen in der lokalen Seitenkonfiguration, nur ein Vergleichshub. Fundstelle: productRepositoryUrl; sitePageMeta.

- **website-config** — [agent-studio-for-software-website/04-angular-static-final/voice.config.json](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/voice.config.json). Vollständige Zuordnung der 27 Routen zu 27 Seitenmodulen; drei weitere gemeinsame Inhaltsdateien. Fundstelle: routes; sourceFiles; sourceContexts.

- **website-readme** — [agent-studio-for-software-website/04-angular-static-final/README.md](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/README.md). Lokale Website-Struktur und dokumentierter Workflow. Ältere Absätze zum Screenshot-Stand sind kein ausreichender Beleg gegen einzelne heutige Captures. Fundstelle: content structure; lint commands; product visual workflow.

- **product-readme** — [agent-taskboard-dev/README.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/README.md). Aktueller Dev-Checkout beschreibt Docker Compose als ersten Einstieg, einen Linux-x64-Setup-Weg sowie Token Economy als Pricing-/Accounting-Abhängigkeit. Kein unabhängiger Nachweis des öffentlich veröffentlichten Release-Stands. Fundstelle: Getting started; Docker Compose; guided setup; Token Economy.

- **product-setup** — [agent-taskboard-dev/docs/operations/setup/getting-started.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/setup/getting-started.md). Dokumentierter Docker-Einstieg benötigt Git, Docker Compose v2 und freien Speicher; ein Coding-Agent-CLI wird erst mit einem ausführenden Host benötigt. Ein geführter Setup-Weg ist separat dokumentiert. Veröffentlichung muss abgeglichen werden. Fundstelle: primary Docker setup; prerequisites; agent-orchestrator-setup; Agent Host onboarding.

- **product-hosts** — [agent-taskboard-dev/docs/operations/remote-hosts.md](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/docs/operations/remote-hosts.md). Aktuelle Produktdokumentation beschreibt Host-Verwaltung, Onboarding und Schreibidentitäten für Repository-Zugriff. Ein Host kann dafür Git-Hosting-Zugangsdaten benötigen; Release-Geltung gesondert prüfen. Fundstelle: Add execution host; per-host/per-repository deploy key; AGT-1922; AGT-2141.

- **product-pricing** — [agent-taskboard-dev/backend/Features/Runner/TokenPricing.cs](C:/Projects/agent-taskboard-devspace/agent-taskboard-dev/backend/Features/Runner/TokenPricing.cs). Der aktuelle Studio-Adapter bezieht Katalog und historische Preise aus Token Economy und führt unbekannte Preise mit ModelKnown=false. Das ist Quellcodebeleg, keine vollständige Laufzeitprüfung aller Berichte. Fundstelle: using EconomyPricing = TokenEconomy; TokenEconomyPriceProvider; ModelKnown; recordedAt.

- **product-claims** — [agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/product.ts). Die Produktseite selbst begrenzt die nachgewiesene Remote-Ausführung auf Ubuntu 24.04 und beschreibt konkrete Task-/Runner-Funktionen. Fundstelle: remote-execution; Ubuntu 24.04 constraint; modelPool.

- **workflow-copy** — [agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/work-model.ts). Die Seite unterscheidet laufende Prozesse, Task-Fortschritt, unvollständige Ergebnisse und menschliche Annahme. Integration und Annahme sind ausdrücklich verschiedene Schritte. Fundstelle: process progress; task progress; failed/stopped runs; release flow.

- **quality-copy** — [agent-studio-for-software-website/04-angular-static-final/src/app/content/software-quality.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/software-quality.ts). Tests, visuelle Prüfung und menschliche Entscheidungen ergänzen sich; ein einzelner Screenshot deckt nicht alle Zustände oder Verhalten ab. Fundstelle: automated checks; visual evidence; human review.

- **security-copy** — [agent-studio-for-software-website/04-angular-static-final/src/app/content/security.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/security.ts). Der Fließtext qualifiziert den Beitrag von Review-Budget und nennt weitere Sicherheitsgrenzen. Die isolierte Formel sollte diesen Geltungsbereich behalten. Fundstelle: security investment; owned boundaries; credentials; partly.

- **tokens-copy** — [agent-studio-for-software-website/04-angular-static-final/src/app/content/tokens.ts](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/content/tokens.ts). Die eigene Kostenargumentation berücksichtigt Nacharbeit, Prüfung und menschliche Zeit; ein allgemeiner Kostenvorteil wird nicht mit einem Vergleich belegt. Fundstelle: production factor; human time; rework; outcomes.

- **capture-renderer** — [agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html](C:/Projects/agent-taskboard-devspace/agent-studio-for-software-website/04-angular-static-final/src/app/capture-card.component.html). Echte Bilder und synthetische Zeilen teilen den Rahmen Agent Studio Stable. Bei Bildern werden die statischen metrics/rows nicht angezeigt; diese wurden daher nicht als veröffentlichte Zahlenbehauptungen gewertet. Fundstelle: screen-bar; @if imageSrc; @else metrics/rows.

- **anthropic-policy** — [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan). Der aktuelle Hinweis setzt die angekündigte Änderung aus. Der darunterstehende frühere Artikel bleibt ausdrücklich nur als Referenz erhalten. Fundstelle: Update June 15; article dated June 16, 2026; note before the superseded body.

- **kiro-specs** — [Kiro Specs documentation](https://kiro.dev/docs/specs/). Die beschriebene Grundstruktur aus Anforderungen, Design und Aufgaben ist durch die offizielle Dokumentation gedeckt. Damit wird nicht jede weitergehende Wettbewerbsbewertung bestätigt. Fundstelle: Core Structure; Three-Phase Workflow; page updated August 27, 2026.

## Übergabe an Voice-Studio

Die JSON-Datei enthält pro Befund `sourcePath`, `exactQuote`, `category`, `severity`, deutsche `explanation`, optionalen englischen `replacement`, `evidenceRefs`, `confidence`, `disposition` sowie Datei-Hash und UTF-16-Literalanker. Die Hashes beziehen sich auf den gelesenen Quellstand. UTF-16-Offsets des decodierten Literaltexts sind bei Escape-Sequenzen nicht identisch mit Quelloffsets. Für das Persistieren zunächst das aktuelle DocumentDetail laden, Quote und Source-Version prüfen und die passende TextUnit bestimmen; keine Unit-IDs aus Reihenfolgen raten.

Wiederholte Befunde sind über `group` zusammengefasst. Ein gemeinsamer redaktioneller Auftrag kann mehrere konkrete Textanker enthalten. Eine Datei ohne Befund bleibt ausdrücklich als geprüft erfasst; daraus folgt keine Vollständigkeitsgarantie für Sicherheit, Recht, alle Laufzeitfunktionen oder fremde Produktkataloge.

Prüfzeitpunkt: 2026-09-06T20:24:08.613Z; Datum in Europe/Berlin.
