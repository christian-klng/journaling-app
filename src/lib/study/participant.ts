import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, questionnaires, type User } from "@/lib/db/schema";
import { getStudyPeriod } from "@/lib/settings";
import { addDays, berlinDate, buildSlots, type Slot } from "./schedule";

type ScheduledQuestionnaire = { id: string; name: string; opensOn: number; closesOn: number };
type EntryState = { id: string; completedAt: Date | null };

export type ParticipantSlot = Slot<ScheduledQuestionnaire> & { entry: EntryState | null };

/** Aktive Abfragen einer Gruppe in ihrer Reihenfolge. */
export function activeQuestionnaires(groupId: string) {
  return db
    .select({ id: questionnaires.id, name: questionnaires.name, opensOn: questionnaires.opensOn, closesOn: questionnaires.closesOn })
    .from(questionnaires)
    .where(and(eq(questionnaires.groupId, groupId), isNull(questionnaires.archivedAt)))
    .orderBy(asc(questionnaires.position));
}

/**
 * Was eine Person gerade ausfüllen kann: offene Abfragen der laufenden Woche, verpasste zum
 * Nachholen und die nächste, die noch kommt. Ohne Gruppe oder Studienzeitraum gibt es nichts.
 */
export async function getParticipantSchedule(user: User, now = new Date()) {
  const period = await getStudyPeriod();
  const today = berlinDate(now);
  const empty = { period, today, slots: [] as ParticipantSlot[], open: [], makeUp: [], next: null };
  if (!user.studyGroupId || !period.start || !period.end) return empty;

  const [list, own] = await Promise.all([
    activeQuestionnaires(user.studyGroupId),
    db
      .select({ id: entries.id, questionnaireId: entries.questionnaireId, weekStart: entries.weekStart, completedAt: entries.completedAt })
      .from(entries)
      .where(eq(entries.userId, user.id)),
  ]);

  const withEntry = (slot: Slot<ScheduledQuestionnaire>): ParticipantSlot => ({
    ...slot,
    entry: own.find((e) => e.questionnaireId === slot.questionnaire.id && e.weekStart === slot.weekStart) ?? null,
  });
  const slots = buildSlots({ studyStart: period.start, studyEnd: period.end, today, questionnaires: list }).map(withEntry);
  const notDone = (slot: ParticipantSlot) => !slot.entry?.completedAt;

  // Die nächste Abfrage kann auch erst in der kommenden Woche liegen
  const ahead = buildSlots({ studyStart: period.start, studyEnd: period.end, today: addDays(today, 7), questionnaires: list });
  const next = ahead.find((slot) => slot.from > today) ?? null;

  return {
    period,
    today,
    slots,
    open: slots.filter((s) => s.state === "open" && notDone(s)),
    // Die jüngsten zuerst, die sind meist noch am besten in Erinnerung
    makeUp: slots.filter((s) => s.state === "past" && notDone(s)).reverse(),
    next,
  };
}
