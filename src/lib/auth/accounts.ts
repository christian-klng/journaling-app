import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateUniqueName, normalizeLoginName } from "@/lib/names";
import { generateTempPassword, hashPassword, TEMP_PASSWORD_TTL_MS } from "./password";

export async function isNameTaken(name: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginName, normalizeLoginName(name)));
  return rows.length > 0;
}

/** Ein noch freier Fantasiename. Er wird erst mit dem Anlegen des Kontos vergeben. */
export function proposeName() {
  return generateUniqueName(isNameTaken, randomInt);
}

/** So viele Fantasienamen stehen bei der Registrierung zur Auswahl. */
export const NAME_CHOICES = 3;

/** Mehrere verschiedene freie Fantasienamen zur Auswahl bei der Registrierung. */
export async function proposeNames(count = NAME_CHOICES) {
  const names: string[] = [];
  while (names.length < count) {
    names.push(await generateUniqueName(async (name) => names.includes(name) || isNameTaken(name), randomInt));
  }
  return names;
}

/**
 * Legt ein Admin-Konto mit Fantasienamen und Einmal-Passwort an. Das Passwort wird nur hier
 * zurückgegeben; bei der ersten Anmeldung muss ein eigenes vergeben werden.
 */
export async function createAdminAccount() {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  for (let attempt = 0; attempt < 5; attempt++) {
    const displayName = await proposeName();
    const [created] = await db
      .insert(users)
      .values({
        displayName,
        loginName: normalizeLoginName(displayName),
        passwordHash,
        role: "admin",
        mustChangePassword: true,
        tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
        consentAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    // Zwischen Vorschlag und Anlegen hat jemand anderes den Namen bekommen
    if (created) return { id: created.id, displayName, tempPassword };
  }
  throw new Error("Es konnte kein freier Name gefunden werden");
}
