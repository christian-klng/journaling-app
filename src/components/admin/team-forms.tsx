"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { createTeam, deleteTeam, renameTeam } from "@/lib/admin/actions";

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, undefined);

  return (
    <div className="space-y-2">
      {/* Neuer Schlüssel nach Erfolg leert das Feld */}
      <form action={action} key={String(state?.ok)} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="Name des neuen Teams"
          aria-label="Name des neuen Teams"
          className={inputClass}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Wird angelegt …" : "Team anlegen"}
        </Button>
      </form>
      <ErrorMessage>{state?.error}</ErrorMessage>
    </div>
  );
}

export function TeamRow({
  team,
}: {
  team: { id: string; name: string; memberCount: number };
}) {
  const [state, action, pending] = useActionState(renameTeam.bind(null, team.id), undefined);

  function confirmDelete(event: React.FormEvent) {
    const members =
      team.memberCount > 0
        ? ` Die ${team.memberCount} Mitglieder bleiben erhalten und stehen danach unter „Ohne Team“.`
        : "";
    if (!window.confirm(`Team „${team.name}“ löschen?${members}`)) event.preventDefault();
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={action} className="flex flex-1 gap-2">
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={team.name}
            aria-label={`Name von Team ${team.name}`}
            className={inputClass}
          />
          <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
            Umbenennen
          </Button>
        </form>
        <form action={deleteTeam.bind(null, team.id)} onSubmit={confirmDelete}>
          <Button type="submit" variant="danger" className="w-full sm:w-auto">
            Löschen
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted">
        {team.memberCount === 1 ? "1 Mitglied" : `${team.memberCount} Mitglieder`}
        {state?.ok && " · Gespeichert"}
      </p>
      <ErrorMessage>{state?.error}</ErrorMessage>
    </li>
  );
}
