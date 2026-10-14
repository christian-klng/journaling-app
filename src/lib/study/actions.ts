"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gt, isNull, lt, max } from "drizzle-orm";
import type { ActionState } from "@/lib/admin/actions";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { questionnaireItems, questionnaires, studyGroups, type ItemType } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { setSetting, STUDY_END_KEY, STUDY_START_KEY } from "@/lib/settings";
import {
  GroupLabelSchema,
  ITEM_TYPES,
  ItemSchema,
  LetterSchema,
  parseStudyFile,
  QuestionnaireSchema,
  StudyPeriodSchema,
} from "./config";

const firstError = (issues: { message: string }[]) => ({ error: issues[0]?.message ?? "Ungültige Eingabe." });

const done = (): ActionState => {
  revalidatePath("/admin/studie", "layout");
  return { ok: true };
};

const editorPath = (questionnaireId: string) => `/admin/studie/abfragen/${questionnaireId}`;

export async function saveStudyPeriod(_state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = StudyPeriodSchema.safeParse({ start: formData.get("start"), end: formData.get("end") });
  if (!parsed.success) return firstError(parsed.error.issues);

  await setSetting(STUDY_START_KEY, parsed.data.start);
  await setSetting(STUDY_END_KEY, parsed.data.end);
  return done();
}

// Gruppen

export async function createGroup(_state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const letter = LetterSchema.safeParse(formData.get("letter"));
  if (!letter.success) return firstError(letter.error.issues);
  const label = GroupLabelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return firstError(label.error.issues);

  const created = await db
    .insert(studyGroups)
    .values({ letter: letter.data, label: label.data })
    .onConflictDoNothing()
    .returning();
  if (created.length === 0) return { error: `Gruppe ${letter.data} gibt es schon.` };
  return done();
}

export async function updateGroupLabel(groupId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const label = GroupLabelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return firstError(label.error.issues);

  await db.update(studyGroups).set({ label: label.data }).where(eq(studyGroups.id, groupId));
  return done();
}

/** Nur leere Gruppen lassen sich löschen; Abfragen, auch archivierte, hängen an ihrer Gruppe. */
export async function deleteGroup(groupId: string) {
  await assertAdmin();
  const [used] = await db
    .select({ id: questionnaires.id })
    .from(questionnaires)
    .where(eq(questionnaires.groupId, groupId))
    .limit(1);
  if (used) return;

  await db.delete(studyGroups).where(eq(studyGroups.id, groupId));
  revalidatePath("/admin/studie", "layout");
}

// Abfragen

function parseQuestionnaire(formData: FormData) {
  return QuestionnaireSchema.safeParse({
    name: formData.get("name"),
    intro: formData.get("intro") ?? "",
    opensOn: formData.get("opensOn"),
    closesOn: formData.get("closesOn"),
  });
}

async function nextQuestionnairePosition(groupId: string) {
  const [{ last }] = await db
    .select({ last: max(questionnaires.position) })
    .from(questionnaires)
    .where(eq(questionnaires.groupId, groupId));
  return (last ?? 0) + 1;
}

export async function createQuestionnaire(
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = parseQuestionnaire(formData);
  if (!parsed.success) return firstError(parsed.error.issues);
  const [group] = await db.select({ id: studyGroups.id }).from(studyGroups).where(eq(studyGroups.id, groupId));
  if (!group) return { error: "Diese Gruppe gibt es nicht mehr." };

  const [created] = await db
    .insert(questionnaires)
    .values({ ...parsed.data, groupId, position: await nextQuestionnairePosition(groupId) })
    .returning({ id: questionnaires.id });
  revalidatePath("/admin/studie", "layout");
  redirect(editorPath(created.id));
}

export async function updateQuestionnaire(
  questionnaireId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = parseQuestionnaire(formData);
  if (!parsed.success) return firstError(parsed.error.issues);

  await db.update(questionnaires).set(parsed.data).where(eq(questionnaires.id, questionnaireId));
  return done();
}

export async function setQuestionnaireArchived(questionnaireId: string, archived: boolean) {
  await assertAdmin();
  await db
    .update(questionnaires)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(questionnaires.id, questionnaireId));
  revalidatePath("/admin/studie", "layout");
}

/** Tauscht die Position mit der benachbarten, nicht archivierten Abfrage derselben Gruppe. */
export async function moveQuestionnaire(questionnaireId: string, direction: "up" | "down") {
  await assertAdmin();
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(questionnaires).where(eq(questionnaires.id, questionnaireId));
    if (!current) return;
    const [neighbor] = await tx
      .select()
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.groupId, current.groupId),
          isNull(questionnaires.archivedAt),
          direction === "up"
            ? lt(questionnaires.position, current.position)
            : gt(questionnaires.position, current.position),
        ),
      )
      .orderBy(direction === "up" ? desc(questionnaires.position) : asc(questionnaires.position))
      .limit(1);
    if (!neighbor) return;
    await tx.update(questionnaires).set({ position: neighbor.position }).where(eq(questionnaires.id, current.id));
    await tx.update(questionnaires).set({ position: current.position }).where(eq(questionnaires.id, neighbor.id));
  });
  revalidatePath("/admin/studie", "layout");
}

/** Legt eine Kopie mit allen aktiven Elementen in einer anderen (oder derselben) Gruppe an. */
export async function copyQuestionnaire(
  questionnaireId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const groupId = formData.get("groupId");
  if (!isUuid(groupId)) return { error: "Bitte wähle eine Gruppe." };

  const source = await db.query.questionnaires.findFirst({
    where: eq(questionnaires.id, questionnaireId),
    with: { items: { where: isNull(questionnaireItems.archivedAt), orderBy: asc(questionnaireItems.position) } },
  });
  const [group] = await db.select({ id: studyGroups.id }).from(studyGroups).where(eq(studyGroups.id, groupId));
  if (!source || !group) return { error: "Abfrage oder Gruppe gibt es nicht mehr." };

  const copyId = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(questionnaires)
      .values({
        groupId,
        name: source.name,
        intro: source.intro,
        opensOn: source.opensOn,
        closesOn: source.closesOn,
        position: await nextQuestionnairePosition(groupId),
      })
      .returning({ id: questionnaires.id });
    if (source.items.length > 0) {
      await tx.insert(questionnaireItems).values(
        source.items.map((item, index) => ({
          questionnaireId: copy.id,
          type: item.type,
          text: item.text,
          required: item.required,
          minLabel: item.minLabel,
          maxLabel: item.maxLabel,
          position: index + 1,
        })),
      );
    }
    return copy.id;
  });
  revalidatePath("/admin/studie", "layout");
  redirect(editorPath(copyId));
}

// Elemente

function parseItem(formData: FormData) {
  return ItemSchema.safeParse({
    text: formData.get("text"),
    required: formData.get("required") === "on",
    minLabel: formData.get("minLabel") ?? "",
    maxLabel: formData.get("maxLabel") ?? "",
  });
}

export async function addItem(questionnaireId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const type = formData.get("type");
  if (!ITEM_TYPES.includes(type as ItemType)) return { error: "Bitte wähle einen Typ." };
  const parsed = parseItem(formData);
  if (!parsed.success) return firstError(parsed.error.issues);

  const [{ last }] = await db
    .select({ last: max(questionnaireItems.position) })
    .from(questionnaireItems)
    .where(eq(questionnaireItems.questionnaireId, questionnaireId));
  await db.insert(questionnaireItems).values({
    ...parsed.data,
    questionnaireId,
    type: type as ItemType,
    position: (last ?? 0) + 1,
  });
  return done();
}

/** Text, Pflicht und Beschriftungen lassen sich ändern, der Typ nicht. */
export async function updateItem(itemId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = parseItem(formData);
  if (!parsed.success) return firstError(parsed.error.issues);

  await db.update(questionnaireItems).set(parsed.data).where(eq(questionnaireItems.id, itemId));
  return done();
}

export async function setItemArchived(itemId: string, archived: boolean) {
  await assertAdmin();
  await db
    .update(questionnaireItems)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(questionnaireItems.id, itemId));
  revalidatePath("/admin/studie", "layout");
}

export async function moveItem(itemId: string, direction: "up" | "down") {
  await assertAdmin();
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(questionnaireItems).where(eq(questionnaireItems.id, itemId));
    if (!current) return;
    const [neighbor] = await tx
      .select()
      .from(questionnaireItems)
      .where(
        and(
          eq(questionnaireItems.questionnaireId, current.questionnaireId),
          isNull(questionnaireItems.archivedAt),
          direction === "up"
            ? lt(questionnaireItems.position, current.position)
            : gt(questionnaireItems.position, current.position),
        ),
      )
      .orderBy(direction === "up" ? desc(questionnaireItems.position) : asc(questionnaireItems.position))
      .limit(1);
    if (!neighbor) return;
    await tx.update(questionnaireItems).set({ position: neighbor.position }).where(eq(questionnaireItems.id, current.id));
    await tx.update(questionnaireItems).set({ position: current.position }).where(eq(questionnaireItems.id, neighbor.id));
  });
  revalidatePath("/admin/studie", "layout");
}

// Import

export type ImportState = (ActionState & { summary?: string }) | undefined;

const MAX_IMPORT_BYTES = 512 * 1024;

/**
 * Übernimmt eine exportierte Konfiguration. Gruppen werden über den Buchstaben zugeordnet,
 * fehlende angelegt. Die bisherigen Abfragen dieser Gruppen werden archiviert, nicht gelöscht,
 * damit gegebene Antworten erhalten bleiben.
 */
export async function importStudy(_state: ImportState, formData: FormData): Promise<ImportState> {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte wähle eine Datei." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "Die Datei ist zu groß." };

  const result = parseStudyFile(await file.text());
  if ("error" in result) return { error: result.error };
  const data = result.data;

  let questionnaireCount = 0;
  let itemCount = 0;
  await db.transaction(async (tx) => {
    for (const group of data.groups) {
      const [row] = await tx
        .insert(studyGroups)
        .values({ letter: group.letter, label: group.label })
        .onConflictDoUpdate({ target: studyGroups.letter, set: { label: group.label } })
        .returning({ id: studyGroups.id });

      await tx
        .update(questionnaires)
        .set({ archivedAt: new Date() })
        .where(and(eq(questionnaires.groupId, row.id), isNull(questionnaires.archivedAt)));
      const [{ last }] = await tx
        .select({ last: max(questionnaires.position) })
        .from(questionnaires)
        .where(eq(questionnaires.groupId, row.id));

      for (const [index, { items, ...questionnaire }] of group.questionnaires.entries()) {
        const [created] = await tx
          .insert(questionnaires)
          .values({ ...questionnaire, groupId: row.id, position: (last ?? 0) + index + 1 })
          .returning({ id: questionnaires.id });
        if (items.length > 0) {
          await tx
            .insert(questionnaireItems)
            .values(items.map((item, i) => ({ ...item, questionnaireId: created.id, position: i + 1 })));
        }
        questionnaireCount++;
        itemCount += items.length;
      }
    }
  });
  if (data.studyStart && data.studyEnd) {
    await setSetting(STUDY_START_KEY, data.studyStart);
    await setSetting(STUDY_END_KEY, data.studyEnd);
  }

  revalidatePath("/admin/studie", "layout");
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const letters = data.groups.map((g) => g.letter).join(", ");
  return {
    ok: true,
    summary:
      `Importiert: ${data.groups.length === 1 ? "Gruppe" : "Gruppen"} ${letters || "keine"}, ` +
      `${count(questionnaireCount, "Abfrage", "Abfragen")}, ${count(itemCount, "Element", "Elemente")}.`,
  };
}
