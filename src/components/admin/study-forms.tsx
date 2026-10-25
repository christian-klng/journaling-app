"use client";

import { useActionState, useState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/admin/actions";
import type { Questionnaire, QuestionnaireItem, StudyGroup } from "@/lib/db/schema";
import {
  addItem,
  copyQuestionnaire,
  createGroup,
  createQuestionnaire,
  importStudy,
  saveStudyPeriod,
  updateGroupLabel,
  updateItem,
  updateQuestionnaire,
} from "@/lib/study/actions";
import { ITEM_TYPE_LABELS, ITEM_TYPES, WEEKDAYS, type ItemTypeKey } from "@/lib/study/config";

function Saved({ state, pending, text = "Gespeichert" }: { state: ActionState; pending: boolean; text?: string }) {
  if (!state?.ok || pending) return null;
  return (
    <span className="text-sm text-muted" role="status">
      {text}
    </span>
  );
}

const textareaClass = `${inputClass} min-h-20 resize-y py-2 leading-relaxed`;

export function StudyPeriodForm({ start, end }: { start: string | null; end: string | null }) {
  const [state, action, pending] = useActionState(saveStudyPeriod, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start">
          <input type="date" name="start" required defaultValue={start ?? ""} className={inputClass} />
        </Field>
        <Field label="Ende">
          <input type="date" name="end" required defaultValue={end ?? ""} className={inputClass} />
        </Field>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Zeitraum speichern
        </Button>
        <Saved state={state} pending={pending} />
      </div>
    </form>
  );
}

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, undefined);
  return (
    <div className="space-y-2">
      <form action={action} key={String(state?.ok)} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="letter"
          required
          maxLength={1}
          placeholder="A"
          aria-label="Buchstabe der neuen Gruppe"
          className={`${inputClass} uppercase sm:w-20`}
        />
        <input
          name="label"
          maxLength={100}
          placeholder="Interne Bezeichnung, z. B. Guided Reflection"
          aria-label="Interne Bezeichnung der neuen Gruppe"
          className={inputClass}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          Gruppe anlegen
        </Button>
      </form>
      <ErrorMessage>{state?.error}</ErrorMessage>
    </div>
  );
}

export function GroupLabelForm({ group }: { group: StudyGroup }) {
  const [state, action, pending] = useActionState(updateGroupLabel.bind(null, group.id), undefined);
  return (
    <form action={action} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          name="label"
          maxLength={100}
          defaultValue={group.label}
          placeholder="Interne Bezeichnung"
          aria-label={`Interne Bezeichnung von Gruppe ${group.letter}`}
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          Speichern
        </Button>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
    </form>
  );
}

function WeekdayFields({ opensOn = 1, closesOn = 7 }: { opensOn?: number; closesOn?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(
        [
          ["opensOn", "Verfügbar ab", opensOn],
          ["closesOn", "bis einschließlich", closesOn],
        ] as const
      ).map(([name, label, value]) => (
        <Field key={name} label={label}>
          <select name={name} defaultValue={value} className={inputClass}>
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index + 1}>
                {day}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </div>
  );
}

export function CreateQuestionnaireForm({ group }: { group: StudyGroup }) {
  const [state, action, pending] = useActionState(createQuestionnaire.bind(null, group.id), undefined);
  return (
    <details className="group/new rounded-xl border border-dashed border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
        + Abfrage für Gruppe {group.letter} anlegen
      </summary>
      <form action={action} className="space-y-3 border-t border-border p-3">
        <Field label="Name, wie ihn die Teilnehmenden sehen">
          <input name="name" required maxLength={60} placeholder="z. B. Check-In" className={inputClass} />
        </Field>
        <WeekdayFields />
        <ErrorMessage>{state?.error}</ErrorMessage>
        <Button type="submit" disabled={pending}>
          Anlegen und bearbeiten
        </Button>
      </form>
    </details>
  );
}

export function QuestionnaireForm({ questionnaire }: { questionnaire: Questionnaire }) {
  const [state, action, pending] = useActionState(updateQuestionnaire.bind(null, questionnaire.id), undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Name, wie ihn die Teilnehmenden sehen">
        <input name="name" required maxLength={60} defaultValue={questionnaire.name} className={inputClass} />
      </Field>
      <WeekdayFields opensOn={questionnaire.opensOn} closesOn={questionnaire.closesOn} />
      <Field label="Einleitung" hint="Erscheint vor dem ersten Element. Leer lassen, wenn es keine braucht.">
        <textarea name="intro" maxLength={2000} rows={3} defaultValue={questionnaire.intro} className={textareaClass} />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Speichern
        </Button>
        <Saved state={state} pending={pending} />
      </div>
    </form>
  );
}

function ItemFields({ type, item }: { type: ItemTypeKey; item?: QuestionnaireItem }) {
  return (
    <>
      <Field label={type === "audio" ? "Frage" : "Frage bzw. Aussage"}>
        <textarea name="text" required maxLength={500} rows={2} defaultValue={item?.text} className={textareaClass} />
      </Field>
      {type === "scale" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Beschriftung bei 0">
            <input
              name="minLabel"
              maxLength={60}
              defaultValue={item?.minLabel}
              placeholder="z. B. gar nicht stressig"
              className={inputClass}
            />
          </Field>
          <Field label="Beschriftung bei 10">
            <input
              name="maxLabel"
              maxLength={60}
              defaultValue={item?.maxLabel}
              placeholder="z. B. extrem stressig"
              className={inputClass}
            />
          </Field>
        </div>
      )}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="required" defaultChecked={item?.required ?? true} className="size-5 accent-accent" />
        Pflicht
      </label>
    </>
  );
}

export function ItemForm({ item }: { item: QuestionnaireItem }) {
  const [state, action, pending] = useActionState(updateItem.bind(null, item.id), undefined);
  return (
    <form action={action} className="space-y-3">
      <ItemFields type={item.type} item={item} />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Speichern
        </Button>
        <Saved state={state} pending={pending} />
      </div>
    </form>
  );
}

export function AddItemForm({ questionnaireId }: { questionnaireId: string }) {
  const [type, setType] = useState<ItemTypeKey>("audio");
  const [state, action, pending] = useActionState(addItem.bind(null, questionnaireId), undefined);
  return (
    // Neuer Schlüssel nach Erfolg leert die Felder
    <form action={action} key={`${String(state?.ok)}-${type}`} className="space-y-3">
      <Field label="Typ">
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as ItemTypeKey)}
          className={inputClass}
        >
          {ITEM_TYPES.map((key) => (
            <option key={key} value={key}>
              {ITEM_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
      </Field>
      <ItemFields type={type} />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <Button type="submit" disabled={pending}>
        Element hinzufügen
      </Button>
    </form>
  );
}

export function CopyQuestionnaireForm({
  questionnaireId,
  groups,
}: {
  questionnaireId: string;
  groups: StudyGroup[];
}) {
  const [state, action, pending] = useActionState(copyQuestionnaire.bind(null, questionnaireId), undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <select name="groupId" aria-label="Zielgruppe der Kopie" className={inputClass}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              Gruppe {group.letter}
              {group.label && ` – ${group.label}`}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          Kopieren
        </Button>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importStudy, undefined);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const message =
          "Konfiguration importieren? Die bisherigen Abfragen der Gruppen aus der Datei werden archiviert und durch die neuen ersetzt.";
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="space-y-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="file"
          name="file"
          accept="application/json,.json"
          required
          aria-label="Datei für den Import"
          className={`${inputClass} py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1`}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? "Wird importiert …" : "Importieren"}
        </Button>
      </div>
      <ErrorMessage>{state?.error}</ErrorMessage>
      {state?.summary && !pending && (
        <p className="text-sm text-muted" role="status">
          {state.summary}
        </p>
      )}
    </form>
  );
}
