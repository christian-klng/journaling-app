import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionPromptForm } from "@/components/admin/transcription-prompt-form";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranscriptionPrompt, TRANSCRIPTION_PROMPT_MAX_LENGTH } from "@/lib/settings";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  await requireAdmin();
  const prompt = await getTranscriptionPrompt();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Einstellungen</h1>

      <Card className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-semibold">Transkription</h2>
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

      <p className="text-sm">
        <Link href="/admin" className="text-muted hover:text-foreground">
          ← Zur Übersicht
        </Link>
      </p>
    </div>
  );
}
