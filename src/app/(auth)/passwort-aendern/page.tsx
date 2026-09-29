import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Passwort ändern" };

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Passwort ändern</h1>
      {user.mustChangePassword && (
        <Notice>
          Du hast dich mit einem Einmal-Passwort angemeldet. Bitte vergib jetzt ein eigenes Passwort.
        </Notice>
      )}
      <ChangePasswordForm forced={user.mustChangePassword} />
      {!user.mustChangePassword && (
        <p className="text-sm">
          <Link
            href={user.role === "admin" ? "/admin" : "/"}
            className="font-medium text-accent underline underline-offset-4"
          >
            Zurück
          </Link>
        </p>
      )}
    </div>
  );
}
