"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import type { FormState } from "@/lib/auth/actions";
import { assertUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { studyGroups, users } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { CodePartsSchema, codeStemFromParts } from "./code";

/** Für Konten, die vor dem persönlichen Code entstanden sind. Danach korrigieren ihn nur Admins. */
export async function saveOwnCode(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await assertUser();
  const fields = {
    mother: String(formData.get("mother") ?? ""),
    month: String(formData.get("month") ?? ""),
    birthplace: String(formData.get("birthplace") ?? ""),
  };
  const parsed = CodePartsSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  await db
    .update(users)
    .set({ codeStem: codeStemFromParts(parsed.data) })
    .where(and(eq(users.id, user.id), eq(users.role, "user"), isNull(users.codeStem)));
  revalidatePath("/", "layout");
  redirect("/");
}

/** Die eigene Gruppe lässt sich genau einmal setzen. Ändern kann sie danach nur ein Admin. */
export async function setOwnGroup(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await assertUser();
  const groupId = formData.get("groupId");
  if (!isUuid(groupId)) return { error: "Bitte wähle deine Gruppe." };

  const [group] = await db.select({ id: studyGroups.id }).from(studyGroups).where(eq(studyGroups.id, groupId));
  if (!group) return { error: "Diese Gruppe gibt es nicht." };

  const updated = await db
    .update(users)
    .set({ studyGroupId: group.id })
    .where(and(eq(users.id, user.id), eq(users.role, "user"), isNull(users.studyGroupId)))
    .returning({ id: users.id });
  if (updated.length === 0) {
    return { error: "Deine Gruppe ist schon eingetragen. Ändern kann sie nur die Studienleitung." };
  }
  revalidatePath("/", "layout");
  return undefined;
}
