"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { login } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="Benutzername">
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="words"
          spellCheck={false}
          required
          placeholder="z. B. Mutiger Otter"
          defaultValue={state?.fields?.username}
          className={inputClass}
        />
      </Field>
      <Field label="Passwort">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Anmelden …" : "Anmelden"}
      </Button>
    </form>
  );
}
