"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/lib/db";
import { studyGroups, users } from "@/lib/db/schema";
import { CONSENT_VERSION } from "@/lib/legal";
import { isGeneratedName, normalizeLoginName } from "@/lib/names";
import { CodePartsSchema, codeStemFromParts } from "@/lib/study/code";
import { isNameTaken, proposeName } from "./accounts";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { clearAttempts, recordFailedAttempt, tooManyAttempts } from "./rate-limit";
import { createSession, destroyAllSessions, destroySession, getSessionUser } from "./session";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`)
  .max(200, "Das Passwort ist zu lang.");

async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unbekannt";
}

const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Ungültige Eingabe.";

const RegisterSchema = z.object({
  username: z.string(),
  password,
  passwordRepeat: z.string(),
  groupId: z.union([z.literal(""), z.uuid()]),
  consent: z.literal("on", "Bitte stimme der Verarbeitung deiner Aufnahmen zu."),
  adult: z.literal("on", "Teilnehmen kannst du nur, wenn du mindestens 18 Jahre alt bist."),
});

export async function register(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = {
    username: String(formData.get("username") ?? ""),
    groupId: String(formData.get("groupId") ?? ""),
    mother: String(formData.get("mother") ?? ""),
    month: String(formData.get("month") ?? ""),
    birthplace: String(formData.get("birthplace") ?? ""),
  };
  const code = CodePartsSchema.safeParse(fields);
  if (!code.success) return { error: firstError(code.error), fields };
  const parsed = RegisterSchema.safeParse({
    ...fields,
    password: formData.get("password"),
    passwordRepeat: formData.get("passwordRepeat"),
    consent: formData.get("consent"),
    adult: formData.get("adult"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), fields };
  const data = parsed.data;
  if (data.password !== data.passwordRepeat) {
    return { error: "Die beiden Passwörter stimmen nicht überein.", fields };
  }

  const ipKey = `register:${await clientIp()}`;
  if (await tooManyAttempts(ipKey, 10)) {
    return { error: "Zu viele Registrierungen. Bitte versuche es später noch einmal.", fields };
  }
  await recordFailedAttempt([ipKey]);

  // Nur vorgeschlagene Fantasienamen, damit niemand seinen echten Namen einträgt
  if (!isGeneratedName(data.username)) {
    return { error: "Bitte nimm den vorgeschlagenen Namen.", fields: { ...fields, username: await proposeName() } };
  }
  const taken = {
    error: "Dieser Name wurde gerade an jemand anderen vergeben. Hier ist ein neuer Vorschlag.",
    fields: { ...fields, username: await proposeName() },
  };
  if (await isNameTaken(data.username)) return taken;

  // Die Gruppe ist bei der Registrierung oft noch nicht bekannt und wird dann später nachgetragen
  let studyGroupId: string | null = null;
  if (data.groupId) {
    const [group] = await db.select({ id: studyGroups.id }).from(studyGroups).where(eq(studyGroups.id, data.groupId));
    if (!group) return { error: "Diese Gruppe gibt es nicht. Bitte wähle eine andere.", fields };
    studyGroupId = group.id;
  }

  const [user] = await db
    .insert(users)
    .values({
      displayName: data.username,
      loginName: normalizeLoginName(data.username),
      passwordHash: await hashPassword(data.password),
      role: "user",
      codeStem: codeStemFromParts(code.data),
      studyGroupId,
      consentAt: new Date(),
      consentVersion: CONSENT_VERSION,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!user) return taken;

  await createSession(user.id);
  redirect("/?willkommen=1");
}

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

// Gleicht die Antwortzeit an, wenn es das Konto nicht gibt
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$VcA0lPgF1TdbADI20knYjg$QwRf5tWUuVv2Z0DNC9IwB6X0vYPr7qOgAkliJtKQRGA";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = { username: String(formData.get("username") ?? "") };
  const parsed = LoginSchema.safeParse({ ...fields, password: formData.get("password") });
  const invalid = { error: "Benutzername oder Passwort stimmen nicht.", fields };
  if (!parsed.success) return invalid;

  const loginName = normalizeLoginName(parsed.data.username);
  const nameKey = `login:${loginName}`;
  const ipKey = `login-ip:${await clientIp()}`;
  if ((await tooManyAttempts(nameKey, 8)) || (await tooManyAttempts(ipKey, 40))) {
    return { error: "Zu viele Versuche. Bitte warte 15 Minuten.", fields };
  }

  const [user] = await db.select().from(users).where(eq(users.loginName, loginName));
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, parsed.data.password);
  if (!user || !ok) {
    await recordFailedAttempt([nameKey, ipKey]);
    return invalid;
  }

  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
    return {
      error: "Das Einmal-Passwort ist abgelaufen. Bitte lass dir ein neues geben.",
      fields,
    };
  }

  await clearAttempts(nameKey);
  await createSession(user.id);
  if (user.mustChangePassword) redirect("/passwort-aendern");
  redirect(user.role === "admin" ? "/admin" : "/");
}

/** Neuer Vorschlag für die Registrierung, wenn der Name nicht gefällt. */
export async function suggestName() {
  return proposeName();
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = password.safeParse(formData.get("newPassword"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data !== formData.get("confirmPassword")) {
    return { error: "Die beiden Passwörter stimmen nicht überein." };
  }

  // Wer gerade mit dem Einmal-Passwort hereingekommen ist, muss es nicht noch einmal eingeben
  if (!user.mustChangePassword) {
    const current = String(formData.get("currentPassword") ?? "");
    if (!(await verifyPassword(user.passwordHash, current))) {
      return { error: "Das aktuelle Passwort stimmt nicht." };
    }
  }
  if (await verifyPassword(user.passwordHash, parsed.data)) {
    return { error: "Bitte wähle ein anderes Passwort als das bisherige." };
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data),
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  // Alle anderen Geräte abmelden, das aktuelle bleibt angemeldet
  await destroyAllSessions(user.id);
  await createSession(user.id);

  redirect(user.role === "admin" ? "/admin" : "/?passwort=geaendert");
}
