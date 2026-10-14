"use client";

import { useActionState, useState, useTransition } from "react";
import { CodeFields } from "@/components/study/code-fields";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { register, suggestName, type FormState } from "@/lib/auth/actions";

export function RegisterForm({
  proposedName,
  groups,
}: {
  proposedName: string;
  groups: { id: string; letter: string }[];
}) {
  const [name, setName] = useState(proposedName);
  const [suggesting, startSuggesting] = useTransition();
  const [state, action, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await register(previous, formData);
    // Bei einem vergebenen Namen schickt der Server gleich einen neuen Vorschlag mit
    if (result?.fields?.username) setName(result.fields.username);
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Field
          label="Dein Benutzername"
          hint="Ein zufälliger Fantasiename. Mit ihm meldest du dich an, notiere ihn dir."
        >
          <input
            name="username"
            value={name}
            readOnly
            autoComplete="username"
            className={`${inputClass} border-transparent bg-accent-soft text-lg font-semibold`}
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={suggesting}
          onClick={() => startSuggesting(async () => setName(await suggestName()))}
        >
          {suggesting ? "Neuer Name …" : "Anderen Namen vorschlagen"}
        </Button>
      </div>
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
      <Field label="Passwort wiederholen">
        <input
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </Field>
      <CodeFields defaults={state?.fields} />
      {groups.length > 0 && (
        <Field
          label="Deine Gruppe"
          hint="Falls du sie noch nicht kennst, trägst du sie später ein. Ändern kann sie danach nur die Studienleitung."
        >
          <select name="groupId" defaultValue={state?.fields?.groupId ?? ""} className={inputClass}>
            <option value="">Noch nicht bekannt</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                Gruppe {group.letter}
              </option>
            ))}
          </select>
        </Field>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-accent" />
        <span>
          Ich bin einverstanden, dass meine Aufnahmen gespeichert und von einer KI in der EU
          transkribiert werden und dass die wissenschaftliche Begleitung sie anhören und lesen kann.
        </span>
      </label>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Konto wird angelegt …" : "Konto anlegen"}
      </Button>
    </form>
  );
}
