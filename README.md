# Journaling – Audio-Tagebuch

Web-App für regelmäßige, gesprochene Rückblicke auf Projekt- oder Gründungsarbeit. Teilnehmende
beantworten wöchentliche Abfragen (z. B. Check-In und Check-Out) mit Skalen und gesprochenen
Antworten, die App transkribiert die Aufnahmen. Admins begleiten die Teilnehmenden wissenschaftlich, legen
die Abfragen pro Gruppe fest, sehen alle Einträge und exportieren sie als ZIP.

Die App ist für das Mobiltelefon gebaut und funktioniert genauso am Desktop.

## Funktionen

**Teilnehmende**

- Registrierung mit Passwort und persönlichem Code. Jede Person bekommt einen zufälligen
  Fantasienamen, der zugleich der Benutzername ist. Die App speichert keine E-Mail-Adressen und
  keine echten Namen.
- Der persönliche Code (z. B. KA-03-BE-A) besteht aus den ersten zwei Buchstaben des Vornamens
  der Mutter, dem Geburtsmonat, den ersten zwei Buchstaben des Geburtsortes und der Gruppe. Die
  Gruppe lässt sich bei der Registrierung oder später unter „Code und Gruppe" genau einmal selbst
  eintragen; solange sie fehlt, blinkt ein roter Punkt.
- Bei der Anmeldung spielen Groß- und Kleinschreibung keine Rolle, Umlaute dürfen als ae, oe, ue
  geschrieben werden.
- Die Startseite zeigt die Abfragen der eigenen Gruppe, deren Zeitfenster gerade läuft, verpasste
  Abfragen zum Nachholen und die nächste, die noch kommt. Ohne Gruppe gibt es keine Fragen.
- Eine Abfrage führt Schritt für Schritt durch ihre Fragen: Smiley-Skala 1–5, Skala 0–10 oder
  Audio-Frage. Pflichtfragen lassen sich nicht überspringen. Jede Antwort wird sofort gespeichert;
  eine unterbrochene Abfrage geht bei der ersten offenen Frage weiter.
- Auf eine Audio-Frage antwortet man mit einer oder mehreren Aufnahmen, die transkribiert werden.
  Bricht der Upload ab, bleibt die Aufnahme auf dem Gerät gesichert und lässt sich später senden.
- Erledigte Abfragen lassen sich mit Antworten, Aufnahmen und Transkripten ansehen.

**Studienleitung (Admins)**

- *Studie:* Studienzeitraum, Gruppen (Buchstabe für den Code, interne Bezeichnung) und pro Gruppe
  Abfragen mit Zeitfenster, Einleitung und Fragen, jeweils Pflicht oder optional. Vorschau aus Sicht
  der Teilnehmenden, Kopieren in eine andere Gruppe, Import und Export als JSON. Abfragen und
  Fragen werden archiviert statt gelöscht; Textkorrekturen sind jederzeit möglich, gegebene
  Antworten behalten den Text, den die Person gesehen hat.
- *Übersicht:* alle Teilnehmenden nach Gruppe geordnet, mit Code und Zahl der Einträge. Doppelte
  Codes werden angezeigt. Gruppen lassen sich einzeln oder gesammelt über eine Liste von Codes zuweisen.
- *Personenseite:* Einträge lesen und anhören, Gruppe ändern, Code korrigieren, Passwort
  zurücksetzen (Einmal-Passwort, 72 Stunden gültig), Konto samt Einträgen und Audiodateien löschen.
- *Teilnahme:* Tabelle pro Person und Woche, ob jede Abfrage erledigt, nachgeholt, begonnen oder
  verpasst ist.
- *Export* als ZIP für alles, eine Gruppe oder eine Person: `antworten.csv` mit einer Zeile pro
  beantworteter Frage, `teilnahme.csv`, Audiodateien mit Transkripten in Ordnern nach Gruppe, Code
  und Woche sowie `liesmich.txt` mit der Erklärung der Spalten.
- *Admins:* weitere Admins anlegen und löschen. Admin-Konten sind von denen der Teilnehmenden
  getrennt.
- *Einstellungen:* Hinweistext für die Transkription mit Namen, Fachbegriffen und Abkürzungen, die
  das Modell richtig schreiben soll.

## Ablauf einer Studie

1. Unter **Studie** die Gruppen und Abfragen anlegen oder eine vorbereitete JSON-Datei importieren.
   Die Fragen gehören nicht ins Repository; die Importdatei bleibt bei der Studienleitung.
2. Den **Studienzeitraum** eintragen. Ohne ihn sehen Teilnehmende keine Fragen.
3. Die Teilnehmenden registrieren sich und bilden dabei ihren persönlichen Code.
4. Sobald die Gruppen feststehen, sie den Teilnehmenden mitteilen. Diese tragen sie selbst ein,
   oder die Studienleitung weist sie in der Übersicht gesammelt über die Codes zu.
5. Während der Studie unter **Teilnahme** verfolgen, wer welche Abfrage erledigt hat.
6. Zum Schluss alles als ZIP exportieren.

## Zeitplan

- Woche 1 ist die Woche (Montag bis Sonntag), in die der Studienstart fällt.
- Jede Abfrage hat ein Zeitfenster innerhalb der Woche, z. B. Montag bis Mittwoch. Zeitfenster, die
  ganz vor dem Start oder nach dem Ende liegen, entfallen.
- Ist das Zeitfenster vorbei, erscheint die Abfrage unter „Nachholen". Nachgeholte Einträge zählen
  zu ihrer ursprünglichen Woche und sind im Export gekennzeichnet.
- Alle Tage und Uhrzeiten gelten in deutscher Zeit.

## Wo was im Code steht

| Thema | Dateien |
|---|---|
| Datenmodell | `src/lib/db/schema.ts`, Migrationen in `drizzle/` |
| Anmeldung, Sitzungen, Passwörter | `src/lib/auth/` |
| Persönlicher Code | `src/lib/study/code.ts` |
| Zeitplan und Teilnahme | `src/lib/study/schedule.ts`, `src/lib/study/participation.ts` |
| Abfragen ausfüllen | `src/lib/study/entry-actions.ts`, `src/components/study/` |
| Aufnahme, Upload, Umwandlung, Transkription | `src/components/study/use-recorder.ts`, `src/app/api/recordings/`, `src/lib/pipeline.ts`, `src/lib/cortecs.ts` |
| Audio-Speicher | `src/lib/storage.ts` |
| Export | `src/app/api/admin/export/route.ts`, `src/lib/export.ts` |
| Konto löschen | `deleteParticipant` in `src/lib/admin/actions.ts` |

## Lokal entwickeln

Voraussetzungen: Node.js 22 oder neuer, Docker.

```bash
npm install
cp .env.example .env        # danach E2E_PASSWORD und ggf. CORTECS_API_KEY eintragen
npm run dev:services        # Postgres und S3-Speicher starten
npm run db:migrate
npm run admin:create        # ersten Admin anlegen, gibt Benutzername und Einmal-Passwort aus
npm run dev
```

Die App läuft dann unter http://localhost:3000.

Ohne Cortecs-Key hilft `CORTECS_MOCK=true` in der `.env`: Das Transkript ist dann ein fester
Beispieltext, der Rest der Kette (Upload, Umwandlung, Speicher) läuft echt.

### Cortecs prüfen

```bash
npm run cortecs:check -- pfad/zur/aufnahme.mp3
```

Das Skript transkribiert die Datei mit dem echten Key. So lässt sich vor dem ersten Deployment
prüfen, ob Key und Modell funktionieren.

### Tests

```bash
npm test             # Unit-Tests
npm run test:e2e     # kompletter Ablauf im Browser, braucht die lokalen Dienste
npm run lint
npm run typecheck
```

Die End-to-End-Tests starten einen eigenen Server auf Port 3200, nutzen einen Testton als Mikrofon
und einen Beispieltext statt der Transkription. Den Test-Admin legen sie selbst in der Datenbank an,
ebenso eine Testgruppe X mit einer täglich offenen Abfrage und einem Studienstart in der Vorwoche.

### Datenbank ändern

Nach einer Änderung an `src/lib/db/schema.ts` die Migration erzeugen und anwenden:

```bash
npm run db:generate -- --name kurze-beschreibung
npm run db:migrate
```

Auf dem Server laufen neue Migrationen beim nächsten Start des Containers automatisch.

## Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Audio-Speicher |
| `S3_FORCE_PATH_STYLE` | Nur lokal `true` |
| `CORTECS_API_KEY` | API-Key von cortecs.ai |
| `CORTECS_TRANSCRIPTION_MODEL` | Standard `whisper-large-v3` |
| `CORTECS_TRANSCRIPTION_LANGUAGE` | Standard `de`, leer für automatische Erkennung |
| `CORTECS_EU_NATIVE` | Standard `true`, nur Anbieter in der EU |

## Deployment mit Coolify auf Hetzner

Coolify baut die App aus dem `Dockerfile`. Der Container führt beim Start zuerst die Migrationen
aus und startet dann den Server. Den Healthcheck (`/api/health`) bringt das `Dockerfile` mit;
Coolify übernimmt ihn und schaltet bei einem neuen Deployment erst um, wenn der neue Container
gesund ist.

### 1. Audio-Speicher bei Hetzner

1. In der Hetzner Console unter **Object Storage** einen Bucket anlegen, Standort in der EU
   (z. B. `fsn1`), Sichtbarkeit **privat**.
2. Unter **Sicherheit → S3-Zugangsdaten** Zugangsdaten erzeugen. Der Secret Key wird nur einmal
   angezeigt.
3. Der Endpoint ist `https://<standort>.your-objectstorage.com`, die Region der Standort.

### 2. Datenbank in Coolify

**New Resource → Database → PostgreSQL** im selben Projekt wie die App. Nicht öffentlich
erreichbar machen. Die **interne** Postgres-URL ist später `DATABASE_URL`. Unter **Backups**
lassen sich regelmäßige Sicherungen einrichten, z. B. in einen zweiten Bucket bei Hetzner.

### 3. App in Coolify

**New Resource → Application → Private Repository (with GitHub App)**, Repository
`christian-klng/journaling-app`, Branch `main`. Über die GitHub-App wird bei jedem Push
automatisch neu deployt.

| Einstellung | Wert |
|---|---|
| Build Pack | Dockerfile |
| Ports Exposes | `3000` |
| Domains | mit `https://` eintragen, sonst gibt der Browser das Mikrofon nicht frei |

Umgebungsvariablen:

```
DATABASE_URL=<interne Postgres-URL aus Coolify>
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=fsn1
S3_BUCKET=<Name des Buckets>
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
CORTECS_API_KEY=…
```

Danach **Deploy**. Die App muss mit **einer** Instanz laufen: Die Verarbeitung der Aufnahmen läuft
im selben Prozess und nimmt nach einem Neustart liegen gebliebene Aufnahmen selbst wieder auf.

### 4. Ersten Admin anlegen

Im **Terminal** der App in Coolify:

```bash
node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-admin.ts
```

Das Skript gibt Benutzername und Einmal-Passwort aus. Nach der ersten Anmeldung vergibt der Admin
ein eigenes Passwort und legt unter „Studie" die Gruppen und Abfragen an.

### Lange Uploads

Traefik, der Proxy von Coolify, bricht sehr langsame Uploads je nach Version nach 60 Sekunden ab.
Scheitern lange Aufnahmen über mobiles Netz, in Coolify unter **Servers → Proxy** in der
Konfiguration beim `command` ergänzen und den Proxy neu starten:

```
- '--entrypoints.https.transport.respondingTimeouts.readTimeout=10m'
```

## Datenschutz

- Bei der Registrierung willigen Teilnehmende ein, dass ihre Aufnahmen gespeichert, per KI
  transkribiert und von der wissenschaftlichen Begleitung eingesehen werden.
- Die App speichert weder E-Mail-Adressen noch echte Namen. Konten heißen nach einem zufälligen
  Fantasienamen, den die App vorschlägt; eigene Namen lassen sich nicht eintragen.
- Der persönliche Code verknüpft Antworten mit späteren Befragungen, ohne Namen zu erfassen. Die
  App kennt nur Fantasiename, Code und Gruppe. Eine Zuordnung zu echten Namen führt, falls
  nötig, die Studienleitung außerhalb der App.
- Gespeichert werden Skalenwerte, Audiodateien, Transkripte und Zeitpunkte der Abgabe. Das
  Geschlecht oder andere Merkmale erfasst die App nicht.
- Teilnehmende sehen nur ihre eigenen Einträge und von den Gruppen nur den Buchstaben. Die interne
  Bezeichnung der Gruppen und die Fragen der anderen Gruppe bekommen sie nicht zu sehen.
- Audio und Texte liegen in der EU, auf dem Server und im Object Storage bei Hetzner. Cortecs leitet
  zur Transkription nur an Anbieter in der EU weiter. Sonst gibt die App keine Daten weiter.
- Teilnehmende können Einträge nicht selbst löschen. Auf Wunsch löscht ein Admin das ganze Konto
  samt Einträgen und Audiodateien.

## Bekannte Grenzen

- Eine Aufnahme ist höchstens 30 Minuten lang. Danach endet sie automatisch, eine weitere lässt
  sich anhängen.
- iOS beendet Aufnahmen, wenn der Bildschirm gesperrt oder die App gewechselt wird. Das bis dahin
  Gesprochene wird gesichert und hochgeladen.
- Es gibt kein „Passwort vergessen" per Mail. Ein vergessenes Passwort setzt ein Admin zurück.
- Zeitfenster liegen innerhalb einer Woche; eines von Freitag bis Montag ist nicht möglich.
- Persönliche Codes können zufällig doppelt vorkommen. Die Übersicht weist darauf hin, auflösen
  muss es die Studienleitung.
- Es gibt keine Erinnerungen per Mail oder Push.
