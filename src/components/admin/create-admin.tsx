"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { createAdmin } from "@/lib/admin/actions";

export function CreateAdmin() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState<{ displayName: string; tempPassword: string } | null>(null);

  function create() {
    if (!window.confirm("Neues Admin-Konto anlegen? Admins sehen alle Einträge aller Personen.")) return;
    startTransition(async () => {
      setAccount(await createAdmin());
      dialogRef.current?.showModal();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={create} disabled={pending}>
        {pending ? "Wird angelegt …" : "Admin anlegen"}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-admin-title"
        onClose={() => setAccount(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-background p-6 text-foreground"
      >
        <div className="space-y-4">
          <h2 id="new-admin-title" className="text-lg font-semibold">
            Neues Admin-Konto
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-muted">Benutzername</dt>
              <dd className="select-all text-xl font-semibold">{account?.displayName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Einmal-Passwort</dt>
              <dd className="select-all rounded-2xl bg-accent-soft py-4 text-center font-mono text-3xl tracking-widest">
                {account?.tempPassword}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted">
            Gib beides jetzt weiter. Das Passwort wird nur dieses eine Mal angezeigt und gilt 72
            Stunden. Bei der ersten Anmeldung muss ein eigenes Passwort vergeben werden.
          </p>
          <Button onClick={() => dialogRef.current?.close()} className="w-full">
            Ich habe es weitergegeben
          </Button>
        </div>
      </dialog>
    </>
  );
}
