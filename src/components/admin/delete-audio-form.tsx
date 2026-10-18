"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { deleteAllAudio } from "@/lib/admin/actions";

export function DeleteAudioForm() {
  const [state, action, pending] = useActionState(deleteAllAudio, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm" role="status">
        Alle Audiodateien sind gelöscht.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field label="Zur Bestätigung LÖSCHEN eintippen">
        <input name="confirm" required autoComplete="off" className={inputClass} />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Wird gelöscht …" : "Alle Audiodateien löschen"}
      </Button>
    </form>
  );
}
