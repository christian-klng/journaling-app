# Journaling – Audio-Tagebuch

Web-App für regelmäßige, gesprochene Rückblicke auf Projekt- oder Gründungsarbeit. Nutzer sprechen
einen Eintrag ein, die App transkribiert ihn. Admins begleiten die Teams wissenschaftlich, sehen alle
Einträge und exportieren sie als ZIP.

Die App ist für das Mobiltelefon gebaut und funktioniert genauso am Desktop.

## Funktionen

**Nutzer**

- Registrierung mit Passwort und Team-Auswahl. Jeder bekommt einen zufälligen Fantasienamen, der
  zugleich der Benutzername ist. Die App speichert keine E-Mail-Adressen und keine echten Namen.
- Bei der Anmeldung spielen Groß- und Kleinschreibung keine Rolle, Umlaute dürfen als ae, oe, ue
  geschrieben werden.
- „Neuer Eintrag" öffnet ein Modal, die Aufnahme startet sofort.
- Nach der Aufnahme erscheint das Transkript.
- „Aufnahme fortsetzen" hängt weitere Aufnahmen an einen Eintrag.
- Eigene Aufnahmen lassen sich anhören.
- Bricht der Upload ab, bleibt die Aufnahme auf dem Gerät gesichert und kann später gesendet werden.

**Admins**

- Startseite mit allen Teams und ihren Mitgliedern, dazu die Gruppe „Ohne Team".
- Teams anlegen, umbenennen, löschen. Personen einem Team zuordnen.
- Einträge jeder Person lesen und anhören.
- ZIP-Export für alles, ein Team oder eine Person.
- Hinweistext für die Transkription pflegen (unter „Einstellungen"): Namen, Fachbegriffe und
  Abkürzungen, die das Modell richtig schreiben soll.
- Passwort zurücksetzen: Ein Einmal-Passwort wird einmalig angezeigt und gilt 72 Stunden. Die
  Person muss danach ein eigenes Passwort vergeben.
- Weitere Admins anlegen (unter „Teams"). Admin-Konten sind von denen der Teilnehmenden getrennt
  und bekommen ebenfalls einen Fantasienamen und ein Einmal-Passwort.

## Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Datenbank | Postgres mit Drizzle ORM |
| Audio-Speicher | S3-kompatibel (Railway Bucket) |
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

## Deployment auf Railway

Gebaut wird aus dem `Dockerfile`. Railway liest für neue Dienste keine `railway.json` mehr, die
folgenden Einstellungen stehen deshalb direkt am Dienst (Settings):

| Einstellung | Wert |
|---|---|
| Pre-Deploy Command | `node scripts/migrate.mjs` |
| Healthcheck Path | `/api/health` |
| Healthcheck Timeout | 120 Sekunden |
| Restart Policy | On Failure, 5 Versuche |

1. Projekt in der Region **EU West** anlegen.
2. **Postgres** hinzufügen.
3. **Bucket** hinzufügen, ebenfalls in der EU. Die Region lässt sich später nicht mehr ändern.
4. Den Web-Service aus dem Repository anlegen und diese Variablen setzen:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   S3_ENDPOINT=${{audio.ENDPOINT}}
   S3_REGION=${{audio.REGION}}
   S3_BUCKET=${{audio.BUCKET}}
   S3_ACCESS_KEY_ID=${{audio.ACCESS_KEY_ID}}
   S3_SECRET_ACCESS_KEY=${{audio.SECRET_ACCESS_KEY}}
   CORTECS_API_KEY=…
   ```

   `Postgres` und `audio` sind die Namen von Datenbank und Bucket im Projekt.
5. Eine öffentliche Domain erzeugen.
6. Im Container `node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-admin.ts`
   ausführen. Das Skript gibt Benutzername und Einmal-Passwort des ersten Admins aus.
7. Als Admin unter „Teams" die Teams anlegen, die bei der Registrierung zur Auswahl stehen sollen.

Der Service muss mit **einer** Instanz laufen. Die Verarbeitung der Aufnahmen läuft im selben
Prozess und nimmt nach einem Neustart liegen gebliebene Aufnahmen selbst wieder auf.

## Datenschutz

- Bei der Registrierung willigen Nutzer ein, dass ihre Aufnahmen gespeichert, per KI transkribiert
  und von der wissenschaftlichen Begleitung eingesehen werden.
- Die App speichert weder E-Mail-Adressen noch echte Namen. Konten heißen nach einem zufälligen
  Fantasienamen, den die App vorschlägt; eigene Namen lassen sich nicht eintragen.
- Audio und Texte liegen in der EU (Railway EU West). Cortecs leitet nur an Anbieter in der EU weiter.
- Nutzer können Einträge derzeit nicht selbst löschen. Löschwünsche müssen über die Datenbank
  erfüllt werden.

## Bekannte Grenzen

- Eine Aufnahme ist höchstens 30 Minuten lang. Danach endet sie automatisch, eine weitere lässt
  sich anhängen.
- iOS beendet Aufnahmen, wenn der Bildschirm gesperrt oder die App gewechselt wird. Das bis dahin
  Gesprochene wird gesichert und hochgeladen.
- Es gibt kein „Passwort vergessen" per Mail. Ein vergessenes Passwort setzt ein Admin zurück.
