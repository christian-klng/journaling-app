"use client";

import { useActionState, useState, useTransition } from "react";
import { CodeFields } from "@/components/study/code-fields";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { register, suggestNames, type FormState } from "@/lib/auth/actions";

export function RegisterForm({
  proposedNames,
  groups,
  randomGroup,
}: {
  proposedNames: string[];
  groups: { id: string; letter: string }[];
  randomGroup: boolean;
}) {
  const [names, setNames] = useState(proposedNames);
  const [name, setName] = useState(proposedNames[0]);
  const [suggesting, startSuggesting] = useTransition();
  const [state, action, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await register(previous, formData);
    // Bei einem vergebenen Namen schickt der Server gleich einen neuen Vorschlag mit; er ersetzt den
    // gewählten Namen und ist sofort ausgewählt
    const submitted = formData.get("username");
    const proposed = result?.fields?.username;
    if (proposed && proposed !== submitted) {
      setNames((current) =>
        current.includes(proposed)
          ? current
          : current.includes(String(submitted))
            ? current.map((n) => (n === submitted ? proposed : n))
            : [proposed, ...current.slice(1)],
      );
      setName(proposed);
    }
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Dein Benutzername</legend>
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 font-medium transition-colors hover:bg-accent-soft has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="username"
                value={n}
                checked={n === name}
                onChange={() => setName(n)}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">
          Mit diesem Namen meldest du dich an, notiere ihn dir.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={suggesting}
          onClick={() =>
            startSuggesting(async () => {
              const fresh = await suggestNames();
              setNames(fresh);
              setName(fresh[0]);
            })
          }
        >
          {suggesting ? "Neue Namen …" : "Andere Namen vorschlagen"}
        </Button>
      </fieldset>
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
      <CodeFields defaults={state?.fields} randomGroup={randomGroup} />
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
      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>
            Ich habe die{" "}
            {/* Neuer Tab, damit das halb ausgefüllte Formular erhalten bleibt */}
            <a href="/datenschutz" target="_blank" className="font-medium text-accent-ink underline underline-offset-4">
              Datenschutzinformation
            </a>{" "}
            gelesen und willige ein, dass meine Antworten und Aufnahmen für die Studie gespeichert, von
            einer KI in der EU transkribiert und von der Studienleitung angehört und ausgewertet werden.
            Spreche ich von mir aus über meine Gesundheit oder andere besonders geschützte Themen, gilt
            meine Einwilligung ausdrücklich auch dafür. Ich kann sie jederzeit widerrufen.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="adult" required className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>
            Ich habe die{" "}
            <a href="/studienbedingungen" target="_blank" className="font-medium text-accent-ink underline underline-offset-4">
              Studienbedingungen
            </a>{" "}
            gelesen, bin mindestens 18 Jahre alt und nehme freiwillig teil.
          </span>
        </label>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Konto wird angelegt …" : "Konto anlegen"}
      </Button>
    </form>
  );
}
