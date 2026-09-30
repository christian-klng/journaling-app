"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { saveTranscriptionPrompt } from "@/lib/admin/actions";

export function TranscriptionPromptForm({
  initialValue,
  maxLength,
}: {
  initialValue: string;
  maxLength: number;
}) {
  const [state, action, pending] = useActionState(saveTranscriptionPrompt, undefined);

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Hinweistext für die Transkription</span>
        <textarea
          name="prompt"
          defaultValue={initialValue}
          maxLength={maxLength}
          rows={5}
          placeholder="Wöchentlicher Rückblick von Gründerinnen und Gründern des Startups Xplrs. Themen: MVP, Pitch-Deck, Investor Relations, Customer Discovery, OKRs."
          className={`${inputClass} min-h-32 resize-y py-2 leading-relaxed`}
        />
      </label>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
        {state?.ok && !pending && (
          <span className="text-sm text-muted" role="status">
            Gespeichert. Gilt für alle neuen Aufnahmen.
          </span>
        )}
      </div>
    </form>
  );
}
