"use client";

import { useRef, useState, useTransition } from "react";
import { Button, ErrorMessage } from "@/components/ui";
import { resetPassword } from "@/lib/admin/actions";

export function ResetPassword({ userId, displayName }: { userId: string; displayName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    if (!window.confirm(`Passwort von ${displayName} zurücksetzen? Die Person wird überall abgemeldet.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetPassword(userId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setTempPassword(result.tempPassword);
        dialogRef.current?.showModal();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={reset} disabled={pending}>
        {pending ? "Wird zurückgesetzt …" : "Passwort zurücksetzen"}
      </Button>
      <ErrorMessage>{error}</ErrorMessage>

      <dialog
        ref={dialogRef}
        aria-labelledby="temp-password-title"
        onClose={() => setTempPassword(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-background p-6 text-foreground"
      >
        <div className="space-y-4">
          <h2 id="temp-password-title" className="text-lg font-semibold">
            Einmal-Passwort für {displayName}
          </h2>
          <p className="select-all rounded-2xl bg-accent-soft py-4 text-center font-mono text-3xl tracking-widest">
            {tempPassword}
          </p>
          <p className="text-sm text-muted">
            Gib dieses Passwort jetzt weiter. Es wird nur dieses eine Mal angezeigt und gilt 72
            Stunden. Nach der Anmeldung muss die Person ein eigenes Passwort vergeben.
          </p>
          <Button onClick={() => dialogRef.current?.close()} className="w-full">
            Ich habe es weitergegeben
          </Button>
        </div>
      </dialog>
    </>
  );
}
