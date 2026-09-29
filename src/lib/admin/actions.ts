"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { generateTempPassword, hashPassword, TEMP_PASSWORD_TTL_MS } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { entries, recordings, teams, users } from "@/lib/db/schema";
import { isUuid } from "@/lib/entries";
import { processRecording, summarizeEntry } from "@/lib/pipeline";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const teamName = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Namen ein.")
  .max(60, "Der Name darf höchstens 60 Zeichen haben.");

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export async function createTeam(_state: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = teamName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const created = await db.insert(teams).values({ name: parsed.data }).onConflictDoNothing().returning();
  if (created.length === 0) return { error: "Ein Team mit diesem Namen gibt es schon." };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function renameTeam(
  teamId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = teamName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.update(teams).set({ name: parsed.data }).where(eq(teams.id, teamId));
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ein Team mit diesem Namen gibt es schon." };
    throw error;
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Mitglieder bleiben erhalten und stehen danach unter "Ohne Team". */
export async function deleteTeam(teamId: string) {
  await assertAdmin();
  await db.delete(teams).where(eq(teams.id, teamId));
  revalidatePath("/admin", "layout");
}

export async function assignTeam(userId: string, formData: FormData) {
  await assertAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  if (teamId && !isUuid(teamId)) return;

  await db
    .update(users)
    .set({ teamId: teamId || null })
    .where(and(eq(users.id, userId), eq(users.role, "user")));
  revalidatePath("/admin", "layout");
}

export async function setRole(userId: string, role: "user" | "admin") {
  const admin = await assertAdmin();
  // Sonst könnte sich der letzte Admin selbst aussperren
  if (userId === admin.id) return;

  await db
    .update(users)
    .set({ role, ...(role === "admin" ? { teamId: null } : {}) })
    .where(eq(users.id, userId));
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

export type LookupState = { error?: string; found?: { id: string; displayName: string } } | undefined;

/** Findet ein Konto über die exakte E-Mail-Adresse, ohne die Adresse selbst anzuzeigen. */
export async function findByEmail(_state: LookupState, formData: FormData): Promise<LookupState> {
  await assertAdmin();
  const parsed = z.email().trim().toLowerCase().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Bitte gib eine vollständige E-Mail-Adresse ein." };

  const [found] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.email, parsed.data));
  return found ? { found } : { error: "Zu dieser Adresse gibt es kein Konto." };
}

/** Stößt die Verarbeitung eines Eintrags neu an, wenn Transkription oder Zusammenfassung hängen. */
export async function retryEntry(entryId: string) {
  await assertAdmin();

  const open = await db
    .update(recordings)
    .set({ attempts: 0, status: "uploaded", error: null, updatedAt: new Date() })
    .where(and(eq(recordings.entryId, entryId), ne(recordings.status, "done")))
    .returning({ id: recordings.id });
  await db
    .update(entries)
    .set({ summaryAttempts: 0, summaryStatus: "pending", summaryError: null, updatedAt: new Date() })
    .where(eq(entries.id, entryId));

  after(async () => {
    for (const { id } of open) await processRecording(id);
    if (open.length === 0) await summarizeEntry(entryId);
  });
  revalidatePath("/admin", "layout");
}
