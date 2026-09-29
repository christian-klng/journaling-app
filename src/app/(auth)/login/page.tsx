import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Anmelden</h1>
      <LoginForm />
      <p className="text-sm text-muted">
        Passwort vergessen? Wende dich an deine Begleitperson. Sie kann dir ein Einmal-Passwort geben.
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
