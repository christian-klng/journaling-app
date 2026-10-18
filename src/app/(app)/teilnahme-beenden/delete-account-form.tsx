"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { deleteOwnAccount } from "@/lib/study/participant-actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteOwnAccount, undefined);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Konto und alle Einträge jetzt endgültig löschen?")) event.preventDefault();
      }}
      className="space-y-3"
    >
      <Field label="Zur Bestätigung dein Passwort">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Wird gelöscht …" : "Konto und Einträge löschen"}
      </Button>
    </form>
  );
}
