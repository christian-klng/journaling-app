"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import type { FormState } from "@/lib/auth/actions";
import { assertUser } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { CodePartsSchema, codeStemFromParts } from "./code";
import { deleteParticipantAccount } from "./delete-account";

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

/** Widerruf der Einwilligung: löscht das eigene Konto mit allen Einträgen und Aufnahmen sofort. */
export async function deleteOwnAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await assertUser();
  if (user.role !== "user") return { error: "Admin-Konten löscht ein anderer Admin." };
  if (!(await verifyPassword(user.passwordHash, String(formData.get("password") ?? "")))) {
    return { error: "Das Passwort stimmt nicht." };
  }

  // Erst löschen, dann abmelden: Scheitert das Löschen, bleibt die Person angemeldet und sieht den Fehler
  await deleteParticipantAccount(user.id, true);
  await destroySession();
  redirect("/login?geloescht=1");
}
