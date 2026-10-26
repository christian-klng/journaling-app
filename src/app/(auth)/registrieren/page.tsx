import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { proposeName } from "@/lib/auth/accounts";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { studyGroups } from "@/lib/db/schema";
import { isRandomGroupAssignmentActive } from "@/lib/study/group-assignment";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  const [groups, proposedName, randomGroup] = await Promise.all([
    // Nur die Buchstaben; die interne Bezeichnung der Gruppen bleibt den Admins vorbehalten
    db.select({ id: studyGroups.id, letter: studyGroups.letter }).from(studyGroups).orderBy(asc(studyGroups.letter)),
    proposeName(),
    isRandomGroupAssignmentActive(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Konto anlegen</h1>
        <p className="text-sm text-muted">
          Du bekommst einen zufälligen Fantasienamen. Er ist dein Benutzername und der einzige Name,
          unter dem die wissenschaftliche Begleitung deine Einträge sieht. Wir speichern weder
          deinen echten Namen noch deine E-Mail-Adresse.
        </p>
      </div>
      <RegisterForm proposedName={proposedName} groups={randomGroup ? [] : groups} randomGroup={randomGroup} />
      <p className="text-sm">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-accent-ink underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
