"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { assignGroupsInBulk, updateCodeStem } from "@/lib/admin/actions";

export function CodeStemForm({ userId, codeStem }: { userId: string; codeStem: string | null }) {
  const [state, action, pending] = useActionState(updateCodeStem.bind(null, userId), undefined);
  return (
    <form action={action} className="space-y-1.5">
      <span className="text-sm font-medium">Persönlicher Code (ohne Gruppe)</span>
      <div className="flex gap-2">
        <input
          name="codeStem"
          required
          defaultValue={codeStem ?? ""}
          placeholder="KA-03-BE"
          aria-label="Persönlicher Code ohne Gruppe"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          Korrigieren
        </Button>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
      {state?.ok && !pending && (
        <p className="text-sm text-muted" role="status">
          Gespeichert
        </p>
      )}
    </form>
  );
}

export function BulkGroupForm() {
  const [state, action, pending] = useActionState(assignGroupsInBulk, undefined);
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="lines"
        rows={5}
        aria-label="Codes mit Gruppe, eine Zeile pro Person"
        placeholder={"KA-03-BE A\nMI-11-HH B"}
        spellCheck={false}
        className={`${inputClass} min-h-28 resize-y py-2 font-mono uppercase`}
      />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Wird zugewiesen …" : "Gruppen zuweisen"}
      </Button>
      {state?.report && !pending && (
        <ul className="space-y-1 text-sm" role="status">
          {state.report.map((line, index) => (
            <li key={index} className={index === 0 ? "font-medium" : "text-muted"}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
