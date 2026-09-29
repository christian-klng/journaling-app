"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { findByEmail } from "@/lib/admin/actions";

export function EmailLookup() {
  const [state, action, pending] = useActionState(findByEmail, undefined);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="E-Mail-Adresse der Person"
          aria-label="E-Mail-Adresse"
          autoComplete="off"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? "Suche …" : "Konto finden"}
        </Button>
      </form>
      <ErrorMessage>{state?.error}</ErrorMessage>
      {state?.found && (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
          Gefunden:{" "}
          <Link
            href={`/admin/nutzer/${state.found.id}`}
            className="font-medium text-accent underline underline-offset-4"
          >
            {state.found.displayName}
          </Link>
        </p>
      )}
    </div>
  );
}
