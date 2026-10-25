"use client";

import { useEffect, useState, useTransition } from "react";
import { completeEntry, saveAnswer, startEntry } from "@/lib/study/entry-actions";
import { Button, Card, ErrorMessage } from "../ui";
import { AudioAnswer } from "./audio-answer";
import { NumberScale, SmileyScale } from "./scales";

export type FlowItem = {
  id: string;
  type: "smiley" | "scale" | "audio";
  text: string;
  required: boolean;
  minLabel: string;
  maxLabel: string;
};

type Step = "intro" | number | "finish";

/** Führt Schritt für Schritt durch eine Abfrage. Jede Antwort wird sofort gespeichert. */
export function QuestionnaireFlow({
  questionnaire,
  slot,
  items,
  initialEntryId,
  initialValues,
  initialCounts,
}: {
  questionnaire: { id: string; name: string; intro: string };
  slot: { weekStart: string; weekNumber: number; range: string; late: boolean };
  items: FlowItem[];
  initialEntryId: string | null;
  initialValues: Record<string, number>;
  initialCounts: Record<string, number>;
}) {
  const [entryId, setEntryId] = useState(initialEntryId);
  const [values, setValues] = useState(initialValues);
  const [counts, setCounts] = useState(initialCounts);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const answered = (item: FlowItem) => (item.type === "audio" ? (counts[item.id] ?? 0) > 0 : item.id in values);
  const firstOpen = () => {
    const index = items.findIndex((item) => !answered(item));
    return index === -1 ? "finish" : index;
  };
  const [step, setStep] = useState<Step>(() => (initialEntryId ? firstOpen() : "intro"));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };
  const nextOf = (index: number): Step => (index + 1 < items.length ? index + 1 : "finish");

  function begin() {
    if (entryId) return go(firstOpen());
    startTransition(async () => {
      const result = await startEntry(questionnaire.id, slot.weekStart);
      if ("error" in result) return setError(result.error);
      setEntryId(result.entryId);
      go(items.length > 0 ? 0 : "finish");
    });
  }

  function submitScale(event: React.FormEvent<HTMLFormElement>, item: FlowItem, index: number) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get(item.id);
    const value = raw === null ? null : Number(raw);
    startTransition(async () => {
      const result = await saveAnswer(entryId!, item.id, value);
      if (result?.error) return setError(result.error);
      setValues((current) => {
        const copy = { ...current };
        if (value === null) delete copy[item.id];
        else copy[item.id] = value;
        return copy;
      });
      go(nextOf(index));
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await completeEntry(entryId!);
      if (result?.error) setError(result.error);
    });
  }

  const header = (
    <div className="space-y-1">
      <p className="text-sm text-muted">
        Woche {slot.weekNumber} · {slot.range}
        {slot.late && " · wird nachgeholt"}
      </p>
      <h1 className="text-xl font-semibold">{questionnaire.name}</h1>
    </div>
  );

  if (step === "intro") {
    return (
      <div className="space-y-6">
        {header}
        {questionnaire.intro && <p className="whitespace-pre-wrap leading-relaxed">{questionnaire.intro}</p>}
        <p className="text-sm text-muted">
          {items.length === 1 ? "1 Frage" : `${items.length} Fragen`}. Deine Antworten werden sofort
          gespeichert, du kannst also jederzeit unterbrechen und später weitermachen.
        </p>
        <ErrorMessage>{error}</ErrorMessage>
        <Button onClick={begin} disabled={pending} className="w-full">
          {entryId ? "Weitermachen" : "Los geht's"}
        </Button>
      </div>
    );
  }

  if (step === "finish") {
    const missing = items.filter((item) => item.required && !answered(item));
    return (
      <div className="space-y-6">
        {header}
        <Card className="space-y-3">
          <h2 className="font-semibold">Fast geschafft</h2>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  className="flex w-full items-start gap-3 rounded-lg py-1 text-left hover:text-accent-ink"
                >
                  <span aria-hidden className={answered(item) ? "text-accent-ink" : "text-muted"}>
                    {answered(item) ? "✓" : "–"}
                  </span>
                  <span className="text-sm">
                    {item.text}
                    {!answered(item) && (
                      <span className="text-muted">{item.required ? " (fehlt noch)" : " (übersprungen)"}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="space-y-2">
          <Button onClick={finish} disabled={pending || missing.length > 0} className="w-full">
            {pending ? "Wird abgeschlossen …" : "Abschließen"}
          </Button>
          {items.length > 0 && (
            <Button variant="ghost" onClick={() => go(items.length - 1)} className="w-full">
              Zurück
            </Button>
          )}
        </div>
      </div>
    );
  }

  const item = items[step];
  const progress = (
    <div className="space-y-1.5">
      <p className="text-sm text-muted">
        Frage {step + 1} von {items.length}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / items.length) * 100}%` }} />
      </div>
    </div>
  );
  const back = step > 0 && (
    <Button type="button" variant="ghost" disabled={busy || pending} onClick={() => go(step - 1)} className="w-full">
      Zurück
    </Button>
  );

  if (item.type === "audio") {
    const done = answered(item);
    return (
      <div className="space-y-6">
        {header}
        {progress}
        <Card className="space-y-4">
          <p className="text-lg font-medium leading-snug">
            {item.text}
            {!item.required && <span className="font-normal text-muted"> (optional)</span>}
          </p>
          <AudioAnswer
            key={item.id}
            entryId={entryId!}
            itemId={item.id}
            count={counts[item.id] ?? 0}
            onBusyChange={setBusy}
            onUploaded={() => setCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))}
          />
        </Card>
        <div className="space-y-2">
          {(done || !item.required) && (
            <Button variant={done ? "primary" : "secondary"} disabled={busy} onClick={() => go(nextOf(step))} className="w-full">
              {done ? "Weiter" : "Überspringen"}
            </Button>
          )}
          {back}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {progress}
      {/* Neuer Schlüssel pro Frage, damit die gespeicherte Antwort vorausgewählt ist */}
      <form key={item.id} onSubmit={(event) => submitScale(event, item, step)} className="space-y-6">
        <Card>
          {item.type === "smiley" ? (
            <SmileyScale name={item.id} question={item.text} required={item.required} defaultValue={values[item.id]} />
          ) : (
            <NumberScale
              name={item.id}
              question={item.text}
              required={item.required}
              minLabel={item.minLabel}
              maxLabel={item.maxLabel}
              defaultValue={values[item.id]}
            />
          )}
        </Card>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="space-y-2">
          <Button type="submit" disabled={pending} className="w-full">
            Weiter
          </Button>
          {back}
        </div>
      </form>
    </div>
  );
}
