# Journaling – Audio-Tagebuch

Web-App für regelmäßige, gesprochene Rückblicke auf Projekt- oder Gründungsarbeit. Teilnehmende
beantworten wöchentliche Abfragen (z. B. Check-In und Check-Out) mit Skalen und gesprochenen
Antworten, die App transkribiert die Aufnahmen. Admins begleiten die Teams wissenschaftlich, legen
die Abfragen pro Gruppe fest, sehen alle Einträge und exportieren sie als ZIP.

Die App ist für das Mobiltelefon gebaut und funktioniert genauso am Desktop.

## Funktionen

**Nutzer**

- Registrierung mit Passwort und Team-Auswahl. Jeder bekommt einen zufälligen Fantasienamen, der
  zugleich der Benutzername ist. Die App speichert keine E-Mail-Adressen und keine echten Namen.
- Bei der Anmeldung spielen Groß- und Kleinschreibung keine Rolle, Umlaute dürfen als ae, oe, ue
  geschrieben werden.
- Bei der Registrierung bildet jede Person ihren persönlichen Code (z. B. KA-03-BE-A): erste zwei
  Buchstaben des Vornamens der Mutter, Geburtsmonat, erste zwei Buchstaben des Geburtsortes. Der
  letzte Teil ist die Gruppe. Sie lässt sich bei der Registrierung oder später unter „Code und
  Gruppe" genau einmal selbst eintragen; solange sie fehlt, blinkt ein roter Punkt.
- Die Startseite zeigt die Abfragen der eigenen Gruppe, deren Zeitfenster gerade läuft, dazu
  verpasste Abfragen zum Nachholen und die nächste, die noch kommt. Ohne Gruppe gibt es keine Fragen.
- Eine Abfrage führt Schritt für Schritt durch ihre Fragen: Smiley-Skala, Skala 0–10 oder Audio-Frage.
  Pflichtfragen lassen sich nicht überspringen. Jede Antwort wird sofort gespeichert; eine
  unterbrochene Abfrage geht bei der ersten offenen Frage weiter.
- Auf eine Audio-Frage antwortet man mit einer oder mehreren Aufnahmen. Sie werden transkribiert.
- Erledigte Abfragen lassen sich mit Antworten, Aufnahmen und Transkripten ansehen.
- Bricht der Upload ab, bleibt die Aufnahme auf dem Gerät gesichert und kann später gesendet werden.

**Admins**

- Startseite mit allen Teams und ihren Mitgliedern, dazu die Gruppe „Ohne Team".
- Teams anlegen, umbenennen, löschen. Personen einem Team zuordnen.
- Einträge jeder Person lesen und anhören.
- Teilnahme-Tabelle (unter „Teilnahme"): pro Person und Woche, ob jede Abfrage erledigt,
  nachgeholt, begonnen oder verpasst ist.
- Persönlicher Code und Gruppe in der Übersicht. Doppelte Codes werden angezeigt. Gruppen lassen
  sich auf der Seite der Person oder gesammelt über eine Liste von Codes zuweisen, Codes korrigieren.
- Konten von Teilnehmenden löschen, mit allen Einträgen und Audiodateien.
- ZIP-Export für alles, ein Team oder eine Person: `antworten.csv` mit einer Zeile pro beantworteter
  Frage (Code, Gruppe, Woche, Abfrage, Fragetext wie gesehen, Wert oder Transkript, nachgeholt ja/nein),
  `teilnahme.csv` mit dem Stand pro Person, Woche und Abfrage, die Audiodateien mit Transkripten in
  Ordnern nach Team, Code und Woche sowie `liesmich.txt` mit der Erklärung der Spalten.
- Hinweistext für die Transkription pflegen (unter „Einstellungen"): Namen, Fachbegriffe und
  Abkürzungen, die das Modell richtig schreiben soll.
- Passwort zurücksetzen: Ein Einmal-Passwort wird einmalig angezeigt und gilt 72 Stunden. Die
  Person muss danach ein eigenes Passwort vergeben.
- Studie einrichten (unter „Studie"): Studienzeitraum, Gruppen (Buchstabe für den persönlichen Code
  und interne Bezeichnung) und pro Gruppe Abfragen mit Zeitfenster, Einleitung und Elementen
  (Smiley-Skala 1–5, Skala 0–10, Audio-Frage), jeweils als Pflicht oder optional. Die Fragen stehen
  in der Datenbank, nicht im Code, damit das öffentliche Repository sie nicht verrät.
- Abfragen und Elemente werden nicht gelöscht, sondern archiviert. Textkorrekturen sind jederzeit
  möglich; gegebene Antworten behalten den Text, den die Person gesehen hat.
- Vorschau einer Abfrage aus Sicht der Teilnehmenden, Kopieren in eine andere Gruppe und Import
  bzw. Export der ganzen Konfiguration als JSON.
- Weitere Admins anlegen (unter „Teams"). Admin-Konten sind von denen der Teilnehmenden getrennt
  und bekommen ebenfalls einen Fantasienamen und ein Einmal-Passwort.

## Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Datenbank | Postgres mit Drizzle ORM |
| Audio-Speicher | S3-kompatibel (Hetzner Object Storage) |
| Betrieb | Docker-Container über Coolify auf einem Server bei Hetzner |
| Anmeldung | Eigene Sessions in der Datenbank, Passwörter mit Argon2id |
| Transkription | Whisper über Cortecs AI (OpenAI-kompatible API), nur EU-Anbieter. Sonst nutzt die App keine KI. |
| Audio | ffmpeg wandelt jede Aufnahme in MP3 (mono, 64 kbit/s) um |

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
und einen Beispieltext statt der Transkription. Den Test-Admin legen sie selbst in der Datenbank an.

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
ein eigenes Passwort und legt unter „Teams" die Teams an, die bei der Registrierung zur Auswahl
stehen.

### Lange Uploads

Traefik, der Proxy von Coolify, bricht sehr langsame Uploads je nach Version nach 60 Sekunden ab.
Scheitern lange Aufnahmen über mobiles Netz, in Coolify unter **Servers → Proxy** in der
Konfiguration beim `command` ergänzen und den Proxy neu starten:

```
- '--entrypoints.https.transport.respondingTimeouts.readTimeout=10m'
```

## Datenschutz

- Bei der Registrierung willigen Nutzer ein, dass ihre Aufnahmen gespeichert, per KI transkribiert
  und von der wissenschaftlichen Begleitung eingesehen werden.
- Die App speichert weder E-Mail-Adressen noch echte Namen. Konten heißen nach einem zufälligen
  Fantasienamen, den die App vorschlägt; eigene Namen lassen sich nicht eintragen.
- Audio und Texte liegen in der EU, auf dem Server und im Object Storage bei Hetzner. Cortecs leitet
  zur Transkription nur an Anbieter in der EU weiter.
- Der persönliche Code verknüpft Einträge mit späteren Befragungen, ohne Namen zu erfassen. Die
  App kennt nur Fantasiename, Code und Gruppe.
- Nutzer können Einträge nicht selbst löschen. Auf Wunsch löscht ein Admin das ganze Konto samt
  Einträgen und Audiodateien.

## Bekannte Grenzen

- Eine Aufnahme ist höchstens 30 Minuten lang. Danach endet sie automatisch, eine weitere lässt
  sich anhängen.
- iOS beendet Aufnahmen, wenn der Bildschirm gesperrt oder die App gewechselt wird. Das bis dahin
  Gesprochene wird gesichert und hochgeladen.
- Es gibt kein „Passwort vergessen" per Mail. Ein vergessenes Passwort setzt ein Admin zurück.
