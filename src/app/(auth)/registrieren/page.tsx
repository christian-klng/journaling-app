import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { proposeNames } from "@/lib/auth/accounts";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  // Eine Gruppe wählt hier niemand; die Zuordnung übernehmen App oder Studienleitung im Hintergrund
  const proposedNames = await proposeNames();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Konto anlegen</h1>
        <p className="text-sm text-muted">
          Du wählst einen zufälligen Fantasienamen. Er ist dein Benutzername und der einzige Name,
          unter dem die wissenschaftliche Begleitung deine Einträge sieht. Wir speichern weder
          deinen echten Namen noch deine E-Mail-Adresse.
        </p>
      </div>
      <RegisterForm proposedNames={proposedNames} />
      <p className="text-sm">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-accent-ink underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
