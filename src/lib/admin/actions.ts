"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import * as z from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { createAdminAccount } from "@/lib/auth/accounts";
import { generateTempPassword, hashPassword, TEMP_PASSWORD_TTL_MS } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deletionNotices, recordings, studyGroups, users } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { processRecording } from "@/lib/pipeline";
import {
  setSetting,
  TRANSCRIPTION_ENABLED_KEY,
  TRANSCRIPTION_PROMPT_KEY,
  TRANSCRIPTION_PROMPT_MAX_LENGTH,
} from "@/lib/settings";
import { deleteByPrefix } from "@/lib/storage";
import { parseCodeStem, parseGroupAssignments } from "@/lib/study/code";
import { deleteParticipantAccount } from "@/lib/study/delete-account";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** Admins können die Gruppe jederzeit setzen oder entfernen, Teilnehmende nur einmal selbst. */
export async function assignStudyGroup(userId: string, formData: FormData) {
  await assertAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  if (groupId && !isUuid(groupId)) return;

  await db
    .update(users)
    .set({ studyGroupId: groupId || null })
    .where(and(eq(users.id, userId), eq(users.role, "user")));
  revalidatePath("/admin", "layout");
}

/** Korrigiert einen falsch eingegebenen Code, z. B. "KA-03-BE". */
export async function updateCodeStem(userId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const stem = parseCodeStem(String(formData.get("codeStem") ?? ""));
  if (!stem) return { error: "Der Code muss so aussehen: KA-03-BE (ohne Gruppe)." };

  await db.update(users).set({ codeStem: stem }).where(and(eq(users.id, userId), eq(users.role, "user")));
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Löscht ein Konto der Teilnehmenden endgültig, mit allen Einträgen und Aufnahmen. */
export async function deleteParticipant(userId: string) {
  await assertAdmin();
  if (!(await deleteParticipantAccount(userId, false))) return;
  revalidatePath("/admin", "layout");
  redirect("/admin?geloescht=1");
}

/** Die Studienleitung hat die gelöschte Person auch aus ihren Exporten entfernt. */
export async function dismissDeletionNotice(id: string) {
  await assertAdmin();
  if (!isUuid(id)) return;
  await db.delete(deletionNotices).where(eq(deletionNotices.id, id));
  revalidatePath("/admin");
}

export type BulkState = (ActionState & { report?: string[] }) | undefined;

/**
 * Weist Gruppen über den Code zu, eine Zeile pro Person ("KA-03-BE A"). Zeilen, die nicht
 * eindeutig zu genau einer Person passen, bleiben unverändert und erscheinen im Bericht.
 */
export async function assignGroupsInBulk(_state: BulkState, formData: FormData): Promise<BulkState> {
  await assertAdmin();
  const { assignments, invalid } = parseGroupAssignments(String(formData.get("lines") ?? ""));
  if (assignments.length === 0 && invalid.length === 0) return { error: "Bitte trage mindestens eine Zeile ein." };

  const [groups, people] = await Promise.all([
    db.select({ id: studyGroups.id, letter: studyGroups.letter }).from(studyGroups),
    db
      .select({ id: users.id, displayName: users.displayName, codeStem: users.codeStem, studyGroupId: users.studyGroupId })
      .from(users)
      .where(eq(users.role, "user")),
  ]);
  const report = invalid.map((i) => `Zeile ${i.line}: „${i.text}“ ist kein gültiger Code mit Gruppe.`);
  let changed = 0;

  for (const { line, stem, letter } of assignments) {
    const group = groups.find((g) => g.letter === letter);
    const matches = people.filter((p) => p.codeStem === stem);
    if (!group) report.push(`Zeile ${line}: Gruppe ${letter} gibt es nicht.`);
    else if (matches.length === 0) report.push(`Zeile ${line}: Kein Konto mit dem Code ${stem}.`);
    else if (matches.length > 1) {
      const names = matches.map((m) => m.displayName).join(", ");
      report.push(`Zeile ${line}: ${stem} gibt es mehrfach (${names}). Bitte auf der Seite der Person zuweisen.`);
    } else if (matches[0].studyGroupId !== group.id) {
      await db.update(users).set({ studyGroupId: group.id }).where(eq(users.id, matches[0].id));
      changed++;
    }
  }

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    report: [`${changed === 1 ? "1 Person" : `${changed} Personen`} zugewiesen.`, ...report],
  };
}

/**
 * Admin-Konten sind von Anfang an getrennt von denen der Teilnehmenden. Name und
 * Einmal-Passwort werden nur hier einmal zurückgegeben.
 */
export async function createAdmin(): Promise<{ displayName: string; tempPassword: string }> {
  await assertAdmin();
  const { displayName, tempPassword } = await createAdminAccount();
  revalidatePath("/admin", "layout");
  return { displayName, tempPassword };
}

export async function deleteAdmin(userId: string) {
  const admin = await assertAdmin();
  // Sonst könnte sich der letzte Admin selbst aussperren
  if (userId === admin.id) return;

  await db.delete(users).where(and(eq(users.id, userId), eq(users.role, "admin")));
  revalidatePath("/admin", "layout");
}

/**
 * Vergibt ein Einmal-Passwort und meldet den Nutzer überall ab. Das Passwort wird nur hier
 * einmal zurückgegeben, gespeichert wird ausschließlich der Hash.
 */
export async function resetPassword(userId: string): Promise<{ tempPassword: string } | { error: string }> {
  const admin = await assertAdmin();
  if (userId === admin.id) return { error: "Dein eigenes Passwort änderst du über das Menü oben rechts." };

  const tempPassword = generateTempPassword();
  const updated = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (updated.length === 0) return { error: "Konto nicht gefunden." };

  await destroyAllSessions(userId);
  return { tempPassword };
}

export async function saveTranscriptionPrompt(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = z
    .string()
    .trim()
    .max(TRANSCRIPTION_PROMPT_MAX_LENGTH, `Höchstens ${TRANSCRIPTION_PROMPT_MAX_LENGTH} Zeichen.`)
    .safeParse(formData.get("prompt"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await setSetting(TRANSCRIPTION_PROMPT_KEY, parsed.data);
  revalidatePath("/admin/einstellungen");
  return { ok: true };
}

/** Schaltet die KI-Transkription für alle neuen Aufnahmen ein oder aus. */
export async function setTranscriptionEnabled(enabled: boolean) {
  await assertAdmin();
  await setSetting(TRANSCRIPTION_ENABLED_KEY, String(enabled));
  revalidatePath("/admin/einstellungen");
}

/**
 * Löscht alle Audiodateien, etwa nach dem Ende der Studie. Transkripte, Skalenwerte und Konten
 * bleiben. Löscht alles unter users/, also auch Dateien, zu denen keine Aufnahme mehr gehört.
 */
export async function deleteAllAudio(_state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== "LÖSCHEN") {
    return { error: "Bitte tippe LÖSCHEN in das Feld." };
  }

  const startedAt = new Date();
  await deleteByPrefix("users/");
  // Nur, was vor dem Löschen hochgeladen war. Noch nicht Transkribiertes gilt als erledigt, sonst
  // warteten Ansicht und Hintergrundlauf ewig darauf.
  await db
    .update(recordings)
    .set({ audioDeletedAt: startedAt, status: "done", updatedAt: startedAt })
    .where(and(isNull(recordings.audioDeletedAt), lt(recordings.createdAt, startedAt)));
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Stößt die Transkription eines Eintrags neu an, wenn sie hängt. */
export async function retryEntry(entryId: string) {
  await assertAdmin();

  const open = await db
    .update(recordings)
    .set({ attempts: 0, status: "uploaded", error: null, updatedAt: new Date() })
    .where(and(eq(recordings.entryId, entryId), ne(recordings.status, "done")))
    .returning({ id: recordings.id });

  after(async () => {
    for (const { id } of open) await processRecording(id);
  });
  revalidatePath("/admin", "layout");
}
