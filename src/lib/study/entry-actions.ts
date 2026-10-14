"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { assertUser, HttpError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { answers, entries, questionnaireItems, recordings, type User } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { SCALE_MAX, SCALE_MIN } from "./config";
import { getParticipantSchedule } from "./participant";
import { findSlot } from "./schedule";

type Result = { error: string } | undefined;

async function participant() {
  const user = await assertUser();
  if (user.role !== "user" || !user.studyGroupId) throw new HttpError(403, "Keine Gruppe eingetragen");
  return user as User & { studyGroupId: string };
}

/** Eigener, noch nicht abgeschlossener Eintrag einer Abfrage. */
async function openEntry(entryId: string, userId: string) {
  if (!isUuid(entryId)) return null;
  const [entry] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId), isNull(entries.completedAt)));
  return entry?.questionnaireId ? entry : null;
}

/**
 * Legt den Eintrag zu einer Abfrage und Woche an, sobald jemand mit dem Ausfüllen beginnt. Gibt
 * es ihn schon, etwa nach einem Abbruch, wird er weiterverwendet.
 */
export async function startEntry(questionnaireId: string, weekStart: string): Promise<{ entryId: string } | { error: string }> {
  const user = await participant();
  const schedule = await getParticipantSchedule(user);
  const slot = findSlot(schedule.slots, questionnaireId, weekStart);
  if (!slot || slot.state === "upcoming") return { error: "Diese Abfrage ist gerade nicht verfügbar." };
  if (slot.entry?.completedAt) return { error: "Diese Abfrage hast du schon abgeschlossen." };
  if (slot.entry) return { entryId: slot.entry.id };

  const [created] = await db
    .insert(entries)
    .values({
      userId: user.id,
      questionnaireId,
      weekStart,
      studyGroupId: user.studyGroupId,
      late: slot.state === "past",
    })
    .onConflictDoNothing()
    .returning({ id: entries.id });
  if (created) return { entryId: created.id };

  // Zwei Tabs gleichzeitig: der andere war schneller
  const [existing] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.userId, user.id), eq(entries.questionnaireId, questionnaireId), eq(entries.weekStart, weekStart)));
  return { entryId: existing.id };
}

/** Speichert einen Skalenwert. Ohne Wert wird eine frühere Antwort entfernt (optionale Fragen). */
export async function saveAnswer(entryId: string, itemId: string, value: number | null): Promise<Result> {
  const user = await participant();
  const entry = await openEntry(entryId, user.id);
  if (!entry || !isUuid(itemId)) return { error: "Dieser Eintrag lässt sich nicht mehr bearbeiten." };

  const [item] = await db
    .select()
    .from(questionnaireItems)
    .where(and(eq(questionnaireItems.id, itemId), eq(questionnaireItems.questionnaireId, entry.questionnaireId!)));
  if (!item || item.type === "audio") return { error: "Diese Frage gibt es nicht." };

  if (value === null) {
    if (item.required) return { error: "Bitte wähle eine Antwort." };
    await db.delete(answers).where(and(eq(answers.entryId, entry.id), eq(answers.itemId, item.id)));
    return;
  }
  const [min, max] = item.type === "smiley" ? [1, 5] : [SCALE_MIN, SCALE_MAX];
  if (!Number.isInteger(value) || value < min || value > max) return { error: "Bitte wähle eine Antwort." };

  await db
    .insert(answers)
    .values({ entryId: entry.id, itemId: item.id, itemType: item.type, itemText: item.text, value })
    .onConflictDoUpdate({
      target: [answers.entryId, answers.itemId],
      set: { value, itemText: item.text, updatedAt: new Date() },
    });
  await db.update(entries).set({ updatedAt: new Date() }).where(eq(entries.id, entry.id));
}

/** Schließt den Eintrag ab, wenn alle Pflichtfragen beantwortet sind. */
export async function completeEntry(entryId: string): Promise<Result> {
  const user = await participant();
  const entry = await openEntry(entryId, user.id);
  if (!entry) return { error: "Dieser Eintrag lässt sich nicht mehr abschließen." };

  const [items, given, recorded] = await Promise.all([
    db
      .select()
      .from(questionnaireItems)
      .where(and(eq(questionnaireItems.questionnaireId, entry.questionnaireId!), isNull(questionnaireItems.archivedAt))),
    db.select({ itemId: answers.itemId }).from(answers).where(eq(answers.entryId, entry.id)),
    db.select({ itemId: recordings.itemId }).from(recordings).where(eq(recordings.entryId, entry.id)),
  ]);
  const missing = items.filter(
    (item) =>
      item.required &&
      !(item.type === "audio" ? recorded.some((r) => r.itemId === item.id) : given.some((a) => a.itemId === item.id)),
  );
  if (missing.length > 0) {
    return { error: `Es fehlt noch eine Antwort auf: ${missing.map((m) => `„${m.text}“`).join(", ")}` };
  }

  await db.update(entries).set({ completedAt: new Date(), updatedAt: new Date() }).where(eq(entries.id, entry.id));
  revalidatePath("/", "layout");
  redirect(`/?erledigt=${entry.id}`);
}
