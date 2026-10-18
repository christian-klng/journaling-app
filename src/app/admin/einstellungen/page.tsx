import type { Metadata } from "next";
import Link from "next/link";
import { and, count, isNull, ne } from "drizzle-orm";
import { DeleteAudioForm } from "@/components/admin/delete-audio-form";
import { TranscriptionPromptForm } from "@/components/admin/transcription-prompt-form";
import { Button, Card } from "@/components/ui";
import { setTranscriptionEnabled } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { recordings } from "@/lib/db/schema";
import { formatShortDate } from "@/lib/format";
import {
  getStudyPeriod,
  getTranscriptionPrompt,
  isTranscriptionEnabled,
  TRANSCRIPTION_PROMPT_MAX_LENGTH,
} from "@/lib/settings";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  await requireAdmin();
  const [prompt, enabled, period, [withAudio], [untranscribed]] = await Promise.all([
    getTranscriptionPrompt(),
    isTranscriptionEnabled(),
    getStudyPeriod(),
    db.select({ n: count() }).from(recordings).where(isNull(recordings.audioDeletedAt)),
    db
      .select({ n: count() })
      .from(recordings)
      .where(and(isNull(recordings.audioDeletedAt), ne(recordings.status, "done"))),
  ]);
  const studyOver = period.end !== null && new Date(`${period.end}T23:59:59`) < new Date();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Einstellungen</h1>

      <Card className="space-y-3">
        <h2 className="font-semibold">Transkription per KI</h2>
        <p className="text-sm text-muted">
          {enabled
            ? "Eingeschaltet. Neue Aufnahmen gehen zur Transkription an Cortecs (nur Anbieter in der EU)."
            : "Ausgeschaltet. Neue Aufnahmen verlassen den Server nicht und bleiben ohne Transkript. Bereits erstellte Transkripte bleiben erhalten."}
        </p>
        <form action={setTranscriptionEnabled.bind(null, !enabled)}>
          <Button type="submit" variant="secondary">
            {enabled ? "Transkription ausschalten" : "Transkription einschalten"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-semibold">Hinweistext für die Transkription</h2>
          <p className="text-sm text-muted">
            Der Hinweistext wird dem Transkriptionsmodell vor jeder Aufnahme mitgegeben. Es übernimmt
            daraus Schreibweisen und Stil. Am besten wirkt ein kurzer Text, der klingt wie ein
            typisches Transkript, mit den Namen, Fachbegriffen und Abkürzungen, die häufig vorkommen.
            Er ist keine Anweisung: „Bitte alles groß schreiben“ bewirkt nichts.
          </p>
          <p className="text-sm text-muted">
            Höchstens {TRANSCRIPTION_PROMPT_MAX_LENGTH} Zeichen; das Modell berücksichtigt nur die
            letzten rund 200 Wörter. Die Änderung gilt für alle Aufnahmen ab dem Speichern, bereits
            erstellte Transkripte bleiben unverändert.
          </p>
        </div>
        <TranscriptionPromptForm initialValue={prompt ?? ""} maxLength={TRANSCRIPTION_PROMPT_MAX_LENGTH} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Audiodateien löschen</h2>
        <p className="text-sm text-muted">
          Löscht alle Aufnahmen endgültig aus dem Speicher, zum Beispiel nach dem Ende der Studie.
          Transkripte, Skalenwerte und Konten bleiben, auch im Export. Vorher am besten alles
          exportieren.
        </p>
        {withAudio.n === 0 ? (
          <p className="text-sm">Es gibt keine Audiodateien.</p>
        ) : (
          <>
            <p className="text-sm">
              {withAudio.n === 1 ? "1 Aufnahme hat" : `${withAudio.n} Aufnahmen haben`} noch eine Audiodatei.
              {untranscribed.n > 0 &&
                ` ${untranscribed.n} davon ${untranscribed.n === 1 ? "ist" : "sind"} noch nicht transkribiert und ${untranscribed.n === 1 ? "wäre" : "wären"} danach leer.`}
              {!studyOver &&
                (period.end
                  ? ` Die Studie läuft noch bis ${formatShortDate(period.end)}.`
                  : " Es ist noch kein Studienende eingetragen.")}
            </p>
            <DeleteAudioForm />
          </>
        )}
      </Card>

      <p className="text-sm">
        <Link href="/admin" className="text-muted hover:text-foreground">
          ← Zur Übersicht
        </Link>
      </p>
    </div>
  );
}
