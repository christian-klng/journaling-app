"use server";

import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
import { generateUniqueName } from "@/lib/names";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { clearAttempts, recordFailedAttempt, tooManyAttempts } from "./rate-limit";
import { createSession, destroyAllSessions, destroySession, getSessionUser } from "./session";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const email = z.email("Bitte gib eine gültige E-Mail-Adresse ein.").trim().toLowerCase().max(254);
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`)
  .max(200, "Das Passwort ist zu lang.");

function isAdminEmail(address: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(address);
}

async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unbekannt";
}

const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Ungültige Eingabe.";

const RegisterSchema = z.object({
  email,
  password,
  teamId: z.union([z.literal(""), z.uuid()]),
  consent: z.literal("on", "Bitte stimme der Verarbeitung deiner Aufnahmen zu."),
});

export async function register(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = {
    email: String(formData.get("email") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
  };
  const parsed = RegisterSchema.safeParse({
    ...fields,
    password: formData.get("password"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), fields };

  const ipKey = `register:${await clientIp()}`;
  if (await tooManyAttempts(ipKey, 10)) {
    return { error: "Zu viele Registrierungen. Bitte versuche es später noch einmal.", fields };
  }
  await recordFailedAttempt([ipKey]);

  const data = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (existing) return { error: "Für diese E-Mail-Adresse gibt es bereits ein Konto.", fields };

  let teamId: string | null = null;
  if (data.teamId) {
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, data.teamId));
    if (!team) return { error: "Dieses Team gibt es nicht mehr. Bitte wähle ein anderes.", fields };
    teamId = team.id;
  }

  const displayName = await generateUniqueName(
    async (name) =>
      (await db.select({ id: users.id }).from(users).where(eq(users.displayName, name))).length > 0,
    randomInt,
  );

  const admin = isAdminEmail(data.email);
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: await hashPassword(data.password),
      displayName,
      role: admin ? "admin" : "user",
      teamId: admin ? null : teamId,
      consentAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!user) return { error: "Das hat nicht geklappt. Bitte versuche es noch einmal.", fields };

  await createSession(user.id);
  redirect(admin ? "/admin" : "/?willkommen=1");
}

const LoginSchema = z.object({ email, password: z.string().min(1).max(200) });

// Gleicht die Antwortzeit an, wenn es das Konto nicht gibt
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$VcA0lPgF1TdbADI20knYjg$QwRf5tWUuVv2Z0DNC9IwB6X0vYPr7qOgAkliJtKQRGA";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = { email: String(formData.get("email") ?? "") };
  const parsed = LoginSchema.safeParse({ ...fields, password: formData.get("password") });
  const invalid = { error: "E-Mail-Adresse oder Passwort stimmen nicht.", fields };
  if (!parsed.success) return invalid;

  const emailKey = `login:${parsed.data.email}`;
  const ipKey = `login-ip:${await clientIp()}`;
  if ((await tooManyAttempts(emailKey, 8)) || (await tooManyAttempts(ipKey, 40))) {
    return { error: "Zu viele Versuche. Bitte warte 15 Minuten.", fields };
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, parsed.data.password);
  if (!user || !ok) {
    await recordFailedAttempt([emailKey, ipKey]);
    return invalid;
  }

  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
    return {
      error: "Das Einmal-Passwort ist abgelaufen. Bitte lass dir ein neues geben.",
      fields,
    };
  }

  await clearAttempts(emailKey);
  let role = user.role;
  if (role !== "admin" && isAdminEmail(user.email)) {
    role = "admin";
    await db.update(users).set({ role }).where(eq(users.id, user.id));
  }

  await createSession(user.id);
  if (user.mustChangePassword) redirect("/passwort-aendern");
  redirect(role === "admin" ? "/admin" : "/");
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
