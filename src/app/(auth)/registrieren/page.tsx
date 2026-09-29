import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  const allTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Konto anlegen</h1>
        <p className="text-sm text-muted">
          Du bekommst einen zufälligen Fantasienamen. Deine E-Mail-Adresse dient nur der Anmeldung
          und ist für niemanden sichtbar.
        </p>
      </div>
      <RegisterForm teams={allTeams} />
      <p className="text-sm">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
