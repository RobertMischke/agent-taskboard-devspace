# Task Detail Pipeline UI - Umsetzungsplanung

Stand: 2026-07-05

## Zielbild

Die Task-Detail-Ansicht soll die komplette konfigurierbare Pipeline jederzeit sichtbar machen, aber die Darstellung kompakt halten. Wichtige Betriebsdaten wie Tokens, Status, Last Activity und Owner muessen direkt sichtbar sein. Tiefergehende Informationen wie Prompt, Dokumentation, Result, Concerns und Time gehoeren in eine Detail-Ebene.

## Festgelegte UI-Regeln

- Die Pipeline zeigt immer alle Schritte.
- Deaktivierte Schritte bleiben sichtbar.
- Enable/Disable ist inline pro optionalem, noch nicht ausgefuehrtem Step sichtbar; abgeschlossene/resultierte Steps sind nicht nachtraeglich abschaltbar.
- Pipeline-Sections koennen kollabiert werden.
- Sections kollabieren durch Klick auf die gesamte Section-Zeile, nicht durch einen separaten Icon-Button.
- Sections ohne aktive/problematische Schritte starten standardmaessig kollabiert.
- Pipeline-Sections zeigen ihren aggregierten Status als dezente Flaeche auch im kollabierten Zustand: gruen fuer abgeschlossen, rot fuer failed/blocked, amber fuer running, grau fuer deaktiviert.
- Step-Typen werden als kurze Icons angezeigt, nicht als breite Text-Lane.
- Pipeline-Runs werden als kompaktes Run-Band direkt oberhalb der Pipeline sichtbar; Mehrfachstarts duerfen nicht nur in Freitext-Metriken stecken.
- Core-Agent-Work darf aggregiert bleiben, muss aber bei mehreren Agent-Runs einen sichtbaren Run-Count und eine Detail-History anbieten.
- Tokens sind bei gelaufenen Steps sichtbar und kurz formatiert, z. B. `21k`, `123k`, `1.4m`; leere/nicht gelaufene Zeilen zeigen keine `0`.
- Duration ist pro gelaufenem Step direkt in der Pipeline sichtbar; Start- und Endzeitpunkt liegen im Step-Detail.
- `Result` wird nur angezeigt, wenn ein echtes Result vorhanden ist.
- Jeder Step mit Prompt-Bezug braucht Zugriff auf Prompt-Details.
- Prompt, Docs, Result und Concerns werden ueber Step-Details erreichbar.
- Concerns brauchen eigene visuelle Behandlung und ein konkretes Beispiel.
- Die linke Overview-Spalte bleibt ein normales Panel; kein separater Rail-Collapse.
- Summary-Daten wie Status, Owner, Agent, Tokens und Signals werden tabellarisch gezeigt, nicht als Chip-/Tag-Suppe.
- Summary-Inhalte bleiben neutral; Statusfarbe erscheint als dezenter Rahmen und im Summary-Header.
- Der Run-Summary-Header zeigt die kurze Decision; die Tabelle wiederholt sie nicht als Status-Zeile.
- Die Run-Summary kombiniert letzte Aktivitaet und Totalzeit in einer `Activity`-Zeile.
- Buttonartige Status-Pills wie `Released to main` werden in Summary-Flaechen vermieden.
- Pipeline-Filter neben dem Pipeline-Titel entfallen; die Pipeline soll direkt lesbar sein.
- Prompt, Docs und Result werden ueber einen gemeinsamen Step-Detail-Zugang gezeigt; separate Buttons lohnen sich nur bei unterschiedlichen Zielansichten.
- Pipeline-Status wird ueber Flaeche und Icon gezeigt; keine linke Statuslinie in Step-Zeilen.
- Pipeline-Schrift bleibt bewusst leichter als Panel- und Summary-Schrift.

## Aktueller Workbench-Status

- Standalone Workbench liegt in `artifacts/task-detail-full-view-workbench.html`.
- Szenarien: `Blocked`, `Running`, `Done`, `Empty`, `Sparse`.
- Pipeline ist kompakt und zeigt Token-Use pro gelaufenem Step mit dem Board-Token-Control.
- Config-UI ist entfernt.
- Inline Enable/Disable pro optionalem, offenem Step ist sichtbar.
- Abgeschlossene/resultierte Steps zeigen eine statische Icon-Markierung statt eines Schalters.
- Sections sind kollabierbar.
- Fertige/inaktive Sections starten in der Workbench automatisch kollabiert.
- Step-Detail-Modal existiert.
- Collapsed-left Rail ist entfernt.
- `Result` erscheint im Step-Detail nur noch bei vorhandenem Result.
- Run-Summary nutzt eine tabellarische Darstellung statt frei umbrechender Chips.
- Run-Summary nutzt neutrale Inhaltsflaeche mit farbiger Umrandung und farbigem Header.
- Run-Summary-Header zeigt die kurze Decision.
- Run-Summary zeigt Totalzeit in der `Activity`-Zeile.
- Pipeline-Filterbuttons sind entfernt.
- Step-Actions sind auf einen Detailzugang plus optionale Concerns reduziert.
- Linke Statuslinie in Pipeline-Zeilen ist entfernt.
- Pipeline-Typografie ist leichter gesetzt.
- Enable/Disable nutzt iconische Controls statt `on/off/req` Text.
- Pipeline-Run-Band zeigt `0`, `1` oder mehrere Runs inklusive Restart-Count.
- Core-Agent-Work zeigt bei mehreren Agent-Runs einen kompakten Run-Count und im Step-Detail eine Run-History.
- Pipeline-Zeilen zeigen Duration fuer gelaufene Steps.
- Pipeline-Sections tragen einen Aggregatstatus auf Group-Ebene, sodass collapsed und expanded denselben Status-Grundton behalten.
- Step-Detail-Modal zeigt Status, Duration, Start, End, Tokens, Owner, Agent, Run-Kontext, Prompt, Docs, Result, Concerns, Activity und ggf. Run-History.

## Offene TODOs

1. Step-Icon-System finalisieren
   - Icons fuer `pre`, `agent`, `tool`, `decision`, `aspect`, `drift` fachlich pruefen.
   - Tooltips mit Standard-Modal/Tooltip-Komponente des Produkts ersetzen.

2. Token-Modell anbinden
   - Quelle fuer Step-Tokens definieren.
   - Summe pro Section und Task aus echten Activity-/Run-Daten berechnen.
   - Formatierung zentralisieren: `999`, `21k`, `123k`, `1.4m`.
   - Sicherstellen, dass Done-Steps nur dann ohne Token-Use bleiben, wenn keine Activity-Daten existieren.

3. Status-Metadaten anbinden
   - Last Activity, Owner, Agent und Lane aus realen Taskdaten beziehen.
   - Klaeren, ob Owner Mensch, Workspace oder Runner meint.

4. Step-Detail-Datenmodell definieren
   - Prompt-Referenzen pro Step.
   - Docs-Referenzen pro Step.
   - Result-Artefakte pro Step.
   - Concerns pro Step.
   - Time/Duration/Started/Ended pro Step.
   - Run-History pro Step, besonders fuer Core-Agent-Work.
   - Echte Activity-Event-Timestamps statt Workbench-Fallbacks anbinden.

5. Result-Sichtbarkeit absichern
   - `Show result` nur rendern, wenn ein Result-Artefakt oder ein finaler Result-Status existiert.
   - Pending, running, disabled und locked duerfen keinen leeren Result-Zugang zeigen.

6. Concerns-Beispiel ausarbeiten
   - Beispiel fuer blockierende Test-Evidence.
   - Beispiel fuer fehlende Artefakte im Sparse-Szenario.
   - Severity und Count in Pipeline-Zeile sichtbar machen.

7. Section-Collapse produktnah machen
   - Collapse-Zustand pro Task lokal speichern.
   - Summary-Zeile fuer kollabierte Sections finalisieren.
   - Aggregatstatus-Regeln produktnah gegen echte Pipeline-State-Daten absichern.
   - Tastatur- und Screenreader-Verhalten pruefen.

8. Tests und Akzeptanz
   - Szenario-Snapshots fuer Blocked, Running, Done, Empty, Sparse.
   - Interaktionstest fuer Section-Collapse.
   - Interaktionstest fuer Step-Detail-Modal.
   - Test: `Result` ist bei Pending/Disabled/Running nicht sichtbar.
   - Test: Tokens bleiben fuer gelaufene Steps in allen Szenarien sichtbar.
   - Test: Pipeline-Run-Band zeigt Empty/Single/Multi-Run korrekt.
   - Test: Core-Agent-Work zeigt Mehrfach-Runs im Modal.
   - Test: Jeder gelaufene sichtbare Step zeigt eine Duration.
   - Test: Step-Detail zeigt Start, End, Duration und Prompt.
   - Test: Kollabierte abgeschlossene/problematische Sections behalten gruenen/roten Statusgrund.

## Akzeptanzkriterien

- Die Pipeline ist ohne horizontales Scrollen nutzbar.
- Die gesamte Pipeline bleibt sichtbar, auch bei deaktivierten Schritten.
- Offene optionale Steps koennen direkt in der Pipeline aktiviert/deaktiviert werden.
- Bereits ausgefuehrte Steps koennen nicht nachtraeglich deaktiviert werden.
- Kollabierte Pipeline-Sections zeigen abgeschlossen/problematisch sofort ueber ihren Hintergrund.
- Pipeline-Runs sind direkt in der Pipeline-Ansicht sichtbar, inklusive Restart-Count bei mehreren Runs.
- Core-Agent-Work verliert fruehere Agent-Runs nicht; Details zeigen die einzelne Run-Historie.
- Tokens sind bei jedem gelaufenen Pipeline-Step sichtbar; leere/nicht gelaufene Steps bleiben ohne Token-Wert.
- Duration ist bei jedem gelaufenen sichtbaren Pipeline-Step sichtbar.
- Start- und Endzeitpunkt sind im Step-Detail sichtbar.
- Jeder Prompt-basierte Step hat einen Prompt-Zugang.
- Concerns sind direkt erkennbar und im Detail nachvollziehbar.
- `Result` erscheint nur, wenn wirklich ein Result existiert.
- Die linke Overview-Spalte kann als Panel ein- und ausgeblendet werden, aber nicht in eine Rail kollabieren.
