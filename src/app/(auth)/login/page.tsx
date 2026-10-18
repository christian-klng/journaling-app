import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  return (
    <div className="space-y-6">
      {params.geloescht && (
        <Notice>Deine Teilnahme ist beendet. Dein Konto und alle Einträge sind gelöscht.</Notice>
      )}
      <h1 className="text-xl font-semibold">Anmelden</h1>
      <LoginForm />
      <p className="text-sm text-muted">
        Dein Benutzername ist dein Fantasiename. Passwort oder Namen vergessen? Wende dich an deine
        Begleitperson. Sie kann dir ein Einmal-Passwort geben.
      </p>
      <p className="text-sm">
        Noch kein Konto?{" "}
        <Link href="/registrieren" className="font-medium text-accent underline underline-offset-4">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}
