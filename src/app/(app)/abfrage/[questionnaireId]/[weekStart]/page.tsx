import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { QuestionnaireFlow } from "@/components/study/questionnaire-flow";
import { requireParticipant } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { answers, questionnaireItems, questionnaires, recordings } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { getParticipantSchedule } from "@/lib/study/participant";
import { findSlot, formatRange } from "@/lib/study/schedule";

export const metadata: Metadata = { title: "Abfrage" };

export default async function QuestionnairePage({ params }: PageProps<"/abfrage/[questionnaireId]/[weekStart]">) {
  const user = await requireParticipant();
  const { questionnaireId, weekStart } = await params;
  if (!isUuid(questionnaireId) || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) notFound();

  // Nur Abfragen der eigenen Gruppe, deren Zeitfenster schon begonnen hat
  const schedule = await getParticipantSchedule(user);
  const slot = findSlot(schedule.slots, questionnaireId, weekStart);
  if (!slot || slot.state === "upcoming") notFound();
  if (slot.entry?.completedAt) redirect(`/eintraege/${slot.entry.id}`);

  const [[questionnaire], items, given, recorded] = await Promise.all([
    db
      .select({ id: questionnaires.id, name: questionnaires.name, intro: questionnaires.intro })
      .from(questionnaires)
      .where(eq(questionnaires.id, questionnaireId)),
    db
      .select({
        id: questionnaireItems.id,
        type: questionnaireItems.type,
        text: questionnaireItems.text,
        required: questionnaireItems.required,
        minLabel: questionnaireItems.minLabel,
        maxLabel: questionnaireItems.maxLabel,
      })
      .from(questionnaireItems)
      .where(and(eq(questionnaireItems.questionnaireId, questionnaireId), isNull(questionnaireItems.archivedAt)))
      .orderBy(asc(questionnaireItems.position)),
    slot.entry
      ? db.select({ itemId: answers.itemId, value: answers.value }).from(answers).where(eq(answers.entryId, slot.entry.id))
      : [],
    slot.entry
      ? db.select({ itemId: recordings.itemId }).from(recordings).where(eq(recordings.entryId, slot.entry.id))
      : [],
  ]);

  const counts: Record<string, number> = {};
  for (const { itemId } of recorded) if (itemId) counts[itemId] = (counts[itemId] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Startseite
      </Link>
      <QuestionnaireFlow
        questionnaire={questionnaire}
        slot={{
          weekStart,
          weekNumber: slot.weekNumber,
          range: formatRange(slot.from, slot.to),
          late: slot.state === "past",
        }}
        items={items}
        initialEntryId={slot.entry?.id ?? null}
        initialValues={Object.fromEntries(given.map((a) => [a.itemId, a.value]))}
        initialCounts={counts}
      />
    </div>
  );
}
