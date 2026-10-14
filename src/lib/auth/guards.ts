import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";

/** Für Seiten: leitet nicht angemeldete Nutzer zum Login um. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/passwort-aendern");
  return user;
}

/** Für die Seiten der Teilnehmenden: ohne persönlichen Code geht es zuerst zur Profilseite. */
export async function requireParticipant() {
  const user = await requireUser();
  if (user.role === "user" && !user.codeStem) redirect("/profil");
  return user;
}

/** Für Admin-Seiten: normale Nutzer landen auf ihrer Startseite. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Für Route Handler und Server Actions: wirft statt umzuleiten. */
export async function assertUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Nicht angemeldet");
  if (user.mustChangePassword) throw new HttpError(403, "Passwort muss zuerst geändert werden");
  return user;
}

export async function assertAdmin() {
  const user = await assertUser();
  if (user.role !== "admin") throw new HttpError(403, "Keine Berechtigung");
  return user;
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Interner Fehler" }, { status: 500 });
}
