"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { register } from "@/lib/auth/actions";

export function RegisterForm({ teams }: { teams: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="E-Mail-Adresse">
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.fields?.email}
          className={inputClass}
        />
      </Field>
      <Field label="Passwort" hint="Mindestens 8 Zeichen">
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </Field>
      <Field label="Team">
        <select name="teamId" defaultValue={state?.fields?.teamId ?? ""} className={inputClass}>
          <option value="">Kein Team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-accent" />
        <span>
          Ich bin einverstanden, dass meine Aufnahmen gespeichert, von einer KI in der EU
          transkribiert und zusammengefasst werden und dass die wissenschaftliche Begleitung sie
          anhören und lesen sowie meine E-Mail-Adresse einsehen kann.
        </span>
      </label>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Konto wird angelegt …" : "Konto anlegen"}
      </Button>
    </form>
  );
}
