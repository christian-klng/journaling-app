"use client";

import { useActionState } from "react";
import { CodeFields } from "@/components/study/code-fields";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { saveOwnCode, setOwnGroup } from "@/lib/study/participant-actions";

export function CodeForm() {
  const [state, action, pending] = useActionState(saveOwnCode, undefined);
  return (
    <form action={action} className="space-y-4">
      <CodeFields defaults={state?.fields} />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        Code speichern
      </Button>
    </form>
  );
}

export function GroupForm({ groups }: { groups: { id: string; letter: string }[] }) {
  const [state, action, pending] = useActionState(setOwnGroup, undefined);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const select = event.currentTarget.elements.namedItem("groupId") as HTMLSelectElement;
        const letter = select.selectedOptions[0]?.text ?? "";
        if (!window.confirm(`${letter} eintragen? Ändern kann sie danach nur noch die Studienleitung.`)) {
          event.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <Field label="Deine Gruppe" hint="Die Studienleitung teilt dir mit, ob du in Gruppe A oder B bist.">
        <select name="groupId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Bitte wählen
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              Gruppe {group.letter}
            </option>
          ))}
        </select>
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending}>
        Gruppe eintragen
      </Button>
    </form>
  );
}
