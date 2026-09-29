# Rückblick – Audio-Tagebuch

Web-App für regelmäßige, gesprochene Rückblicke auf Projekt- oder Gründungsarbeit. Nutzer sprechen
einen Eintrag ein, die App transkribiert ihn und fasst ihn in drei Stichpunkten zusammen. Admins
begleiten die Teams wissenschaftlich, sehen alle Einträge und exportieren sie als ZIP.

Die App ist für das Mobiltelefon gebaut und funktioniert genauso am Desktop.

## Funktionen

**Nutzer**

- Registrierung mit E-Mail, Passwort und Team-Auswahl. Jeder bekommt einen zufälligen Fantasienamen.
- „Neuer Eintrag" öffnet ein Modal, die Aufnahme startet sofort.
- Nach der Aufnahme erscheinen das Transkript und drei Stichpunkte.
- „Aufnahme fortsetzen" hängt weitere Aufnahmen an einen Eintrag. Die Stichpunkte fassen dann alle
  Aufnahmen zusammen.
- Eigene Aufnahmen lassen sich anhören.
- Bricht der Upload ab, bleibt die Aufnahme auf dem Gerät gesichert und kann später gesendet werden.

**Admins**

- Startseite mit allen Teams und ihren Mitgliedern, dazu die Gruppe „Ohne Team".
- Teams anlegen, umbenennen, löschen. Personen einem Team zuordnen.
- Einträge jeder Person lesen und anhören.
- ZIP-Export für alles, ein Team oder eine Person.
- Passwort zurücksetzen: Ein Einmal-Passwort wird einmalig angezeigt und gilt 72 Stunden. Die
  Person muss danach ein eigenes Passwort vergeben.
- Admins sehen nur Fantasienamen. E-Mail-Adressen erscheinen weder in der Oberfläche noch im Export.
  Ein Konto lässt sich über die exakte E-Mail-Adresse finden, ohne dass die Adresse angezeigt wird.

## Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Datenbank | Postgres mit Drizzle ORM |
| Audio-Speicher | S3-kompatibel (Railway Bucket) |
| Anmeldung | Eigene Sessions in der Datenbank, Passwörter mit Argon2id |
| KI | Cortecs AI über die OpenAI-kompatible API, nur EU-Anbieter |
| Audio | ffmpeg wandelt jede Aufnahme in MP3 (mono, 64 kbit/s) um |

## Lokal entwickeln

Voraussetzungen: Node.js 22 oder neuer, Docker.

```bash
npm install
cp .env.example .env        # danach E2E_PASSWORD und ggf. CORTECS_API_KEY eintragen
npm run dev:services        # Postgres und S3-Speicher starten
npm run db:migrate
npm run dev
```

Die App läuft dann unter http://localhost:3000.

Ohne Cortecs-Key hilft `CORTECS_MOCK=true` in der `.env`: Transkript und Stichpunkte sind dann
feste Beispieltexte, der Rest der Kette (Upload, Umwandlung, Speicher) läuft echt.

Der erste Admin entsteht über `ADMIN_EMAILS`: Wer sich mit einer dort eingetragenen Adresse
registriert oder anmeldet, wird Admin.

### Cortecs prüfen

```bash
npm run cortecs:check -- pfad/zur/aufnahme.mp3
```

Das Skript transkribiert die Datei mit dem echten Key und erstellt eine Zusammenfassung. So lässt
sich vor dem ersten Deployment prüfen, ob Key und Modelle funktionieren.

### Tests

```bash
npm test             # Unit-Tests
npm run test:e2e     # kompletter Ablauf im Browser, braucht die lokalen Dienste
npm run lint
npm run typecheck
```

Die End-to-End-Tests starten einen eigenen Server auf Port 3200, nutzen einen Testton als Mikrofon
und Beispieltexte statt der KI.

## Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Audio-Speicher |
| `S3_FORCE_PATH_STYLE` | Nur lokal `true` |
| `CORTECS_API_KEY` | API-Key von cortecs.ai |
| `CORTECS_TRANSCRIPTION_MODEL` | Standard `whisper-large-v3` |
| `CORTECS_LLM_MODEL` | Standard `mistral-small-2603` |
| `CORTECS_TRANSCRIPTION_LANGUAGE` | Standard `de`, leer für automatische Erkennung |
| `CORTECS_EU_NATIVE` | Standard `true`, nur Anbieter in der EU |
| `ADMIN_EMAILS` | Kommagetrennte Adressen, die Admin-Rechte erhalten |

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
   ADMIN_EMAILS=…
   ```

   `Postgres` und `audio` sind die Namen von Datenbank und Bucket im Projekt.
5. Eine öffentliche Domain erzeugen.
6. **Direkt nach dem ersten Deployment** mit der Adresse aus `ADMIN_EMAILS` registrieren. E-Mail-Adressen
   werden nicht verifiziert. Wer sich zuerst mit dieser Adresse registriert, wird Admin.
7. Als Admin unter „Teams" die Teams anlegen, die bei der Registrierung zur Auswahl stehen sollen.

Der Service muss mit **einer** Instanz laufen. Die Verarbeitung der Aufnahmen läuft im selben
Prozess und nimmt nach einem Neustart liegen gebliebene Aufnahmen selbst wieder auf.

## Datenschutz

- Bei der Registrierung willigen Nutzer ein, dass ihre Aufnahmen gespeichert, per KI verarbeitet
  und von der wissenschaftlichen Begleitung eingesehen werden.
- Audio und Texte liegen in der EU (Railway EU West). Cortecs leitet nur an Anbieter in der EU weiter.
- Die Begleitung sieht Fantasienamen. Wer für einen Passwort-Reset seine E-Mail-Adresse oder
  seinen Fantasienamen nennt, gibt sich gegenüber dieser Person zu erkennen.
- Nutzer können Einträge derzeit nicht selbst löschen. Löschwünsche müssen über die Datenbank
  erfüllt werden.

## Bekannte Grenzen

- Eine Aufnahme ist höchstens 30 Minuten lang. Danach endet sie automatisch, eine weitere lässt
  sich anhängen.
- iOS beendet Aufnahmen, wenn der Bildschirm gesperrt oder die App gewechselt wird. Das bis dahin
  Gesprochene wird gesichert und hochgeladen.
- Es gibt keinen E-Mail-Versand, also auch keine Verifizierung der Adresse und kein
  „Passwort vergessen" per Mail.
