# Korrektur v0.9.1: „Unbekannte Operation“

Die Browseroberfläche ruft die Function direkt auf und sendet die Operation ausdrücklich. Die Funktion erkennt außerdem die bisherigen /api/search- und /api/recording-Pfade. Das Verhalten der Netlify-Weiterleitung ist damit für neue Anfragen nicht mehr entscheidend.

## Aktualisieren
Inhalt dieses Ordners über die bisherigen Repository-Dateien kopieren und committen. Netlify-Variablen beibehalten. Automatischen Deploy abwarten, Hauptadresse der App öffnen und Strg+F5 drücken. Oben muss v0.9.1 stehen. Testcode setzen und „Bearbeiten“ erneut versuchen.

Die URL-Übergabe wurde lokal geprüft. Live-Ergebnisse müssen danach auf Netlify getestet werden.

---

# MusicTag Detective – Netlify-Test v0.9

## Was enthalten ist
Netlify Functions statt Python-Server; Titel-/Alben-Testoberfläche; lokale MP3-Auswahl; MusicBrainz-Livesuche erst beim Bearbeiten; Ausgabejahr und Erstveröffentlichung getrennt; Vergleich mit vorausgewählten Änderungen; Player schließen; Prüfstatus und Rückgängig; Export erfolgreicher Datenbankantworten für die spätere Arbeit hier im Chat.

Keine MP3s oder Musik-ZIP enthalten. `public/samples.json` enthält nur die bereits bereitgestellten Metadaten der fünf Testtitel, die damit auf der Testwebsite sichtbar sind. Andere Musikordner werden nicht durchsucht. Die Audiodateien bleiben auf Ihrem Gerät; für die Wiedergabe wählen Sie die fünf entpackten MP3s aus Musik.zip lokal aus.

## Empfohlene Bereitstellung: Git + Netlify
1. ZIP vollständig entpacken. Den INHALT des entpackten Projektordners in ein eigenes GitHub-Repository übernehmen. `netlify.toml` und `package.json` müssen im Repository-Hauptverzeichnis liegen.
2. In Netlify ein neues Projekt aus diesem Repository importieren.
3. Build command: `npm run build`; Publish directory: `public`; Functions directory: `netlify/functions`. Die Datei netlify.toml enthält diese Werte bereits.
4. Zwei Umgebungsvariablen für Functions setzen (nicht als Dateien ins Repository):
   - `MUSICTAG_USER_AGENT`: `MusicTagDetective/0.9 (IHRE_ECHTE_KONTAKT_URL_ODER_EMAIL)` – Kontaktplatzhalter ersetzen.
   - `TEST_ACCESS_CODE`: selbst gewählter zufälliger Testcode mit mindestens 16 Zeichen. Keine Leerzeichen am Anfang/Ende. Diesen Code teilen Sie nur mit Ihren Testern; er schützt die Datenbankabfragen, nicht die öffentlich sichtbare Oberfläche.
5. Nach dem Setzen der Variablen einen neuen Deploy auslösen. Functions benötigen die Variablen zur Laufzeit. Netlify Blobs wird über den Functions-Kontext angesprochen, kein zusätzliches Datenbankkonto erforderlich.
6. Deploy-Protokoll auf erfolgreiche Function-Bereitstellung prüfen; im Netlify-Projekt muss die Function `musicbrainz` erscheinen.
7. Website öffnen, oben denselben Testcode eingeben und „Testcode verwenden“ drücken. Der Code bleibt nur im Arbeitsspeicher des Tabs.

Ein Drag-and-drop von `public/` liefert nur HTML und Beispieldaten, keine Netlify Function. Das reicht nicht für den Live-Test.

## Alternative: Netlify CLI
Node.js 22+ installieren. Im entpackten Ordner:
```
npm install
npx netlify-cli login
npx netlify-cli init
```
Anschließend die beiden Variablen vorzugsweise im Netlify-Dashboard eintragen. Keine geheimen Werte in Befehlsverläufe kopieren. Dann:
```
npx netlify-cli deploy --build --prod
```
Dies veröffentlicht die Testoberfläche und Funktionen für die im Netlify-Projekt eingestellte Zielgruppe. Die fünf Musikdateien werden nicht veröffentlicht. Für lokalen Test nach Verknüpfung mit Netlify kann `npx netlify-cli dev` verwendet werden.

## Testschritte
1. Startseite laden: noch keine MusicBrainz-Anfrage.
2. Testcode setzen.
3. Titelmodus > „Bearbeiten“: echte Suche nach Titel/Interpret/Album startet.
4. Bei keinen Treffern „Ohne Album suchen“. Ein Suchfehler wird ausdrücklich angezeigt; es gibt keine erfundenen Ersatztreffer.
5. Aufnahme bewusst auswählen. Suchscore ist keine Wahrscheinlichkeit. Eine bestimmte Album-Ausgabe separat auswählen; Datum und Quellenlink prüfen.
6. „Änderungen vergleichen“ > unerwünschte Werte abwählen > „Speichern & prüfen“. Leere Datenbankfelder löschen keine vorhandenen Werte.
7. Lokale Audio-Beispiele auswählen, „Anhören“ und „Player schließen“ testen. Es erfolgt dabei kein Upload.
8. Eine weitere erfolgreiche Suche exportieren: „Datenbankantworten für den nächsten Chat exportieren“. Die JSON enthält Suchtexte, Antworten und Zeitstempel, aber keinen Testcode und keine Audiodaten. Diese JSON anschließend hier anhängen. Damit können wir in der Chat-Vorschau echte aufgezeichnete Ergebnisse ohne Live-Anbindung wiederverwenden.

## Gemeinsames Anfragelimit
Beide API-Operationen verwenden denselben siteweiten Netlify-Blobs-Store mit starken Reads und atomaren bedingten Schreiboperationen. Eine Lease serialisiert ausgehende Anfragen über Function-Instanzen hinweg. Nach Abschluss bleiben mindestens zwei Sekunden Pause. Während die Sperre belegt ist, liefert der Server 429 mit Retry-After; die Oberfläche zeigt die Wartezeit, startet aber keine unkontrollierte Wiederholung. Bei Function-Abbruch verfällt die Lease nach 35 Sekunden. Fehler 429/503 von MusicBrainz erhöhen die Wartezeit. Schlägt der gemeinsame Speicher fehl, findet keine ungeschützte Ersatzabfrage statt.

Zusätzlich gibt es ein Netlify-Limit pro Domain/IP. Dies allein wäre kein verlässliches globales MusicBrainz-Limit; entscheidend ist die gemeinsame Lease. Getrennte Netlify-Projekte haben getrennte Sperren. Für mehrere parallel betriebene Projekte wäre ein gemeinsamer externer Broker nötig. Die Lösung ist für einen überschaubaren Test vorgesehen, keine umfassende Verfügbarkeits-/Lastgarantie.

Ergebnisse liegen 24 Stunden im gemeinsamen Cache. Abgelaufene Einträge werden bei Wiederverwendung ersetzt; automatisches Aufräumen aller jemals gesuchten Schlüssel ist für später offen. Netlify-Funktionen und Blobs unterliegen dem jeweiligen Tarif; vor breiter Freigabe Verbrauch im Dashboard prüfen.

## Technische Validierung und Grenzen
`npm test`: zehn Tests zu Unicode/Suchsyntax, IDs, Datumsunterscheidung konkurrierenden Lease-Schreibzugriffen mit simuliertem Store sowie serverseitiger Konfiguration und Testcode-Abweisung.
`npm run build`: Syntaxprüfung der Browserdatei und Ausschluss von Audio-/ZIP-Dateien im Veröffentlichungsordner.

Live-Deployment, echter Netlify-Blobs-Zugriff, Function-Bundling auf Netlify und MusicBrainz-Erreichbarkeit müssen auf Ihrem Netlify-Projekt noch geprüft werden. Die Entwicklungsumgebung konnte MusicBrainz zuvor nicht gültig abrufen. Es wird deshalb nicht behauptet, dass die fünf Titel bereits online korrekt zugeordnet wurden.

Die Oberfläche basiert auf dem v0.8-Integrationstest. Sie ersetzt noch nicht sämtliche Funktionen der früheren Chat-Demos. Die Beispielgruppe enthält überwiegend Einzeltitel verschiedener Alben. Bei Album-Speicherung werden Albumname/Ausgabejahr auf die Gruppe übertragen, Titelinterpret nur auf den geöffneten Titel. Fingerprinting/AcoustID, automatische Genre-Recherche, dauerhafte Server-Prüfstände und echtes Tag-Schreiben sind nicht implementiert.

## Offizielle Dokumentation
https://docs.netlify.com/build/functions/get-started/
https://docs.netlify.com/build/data-and-storage/netlify-blobs/
https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
https://musicbrainz.org/doc/MusicBrainz_API
