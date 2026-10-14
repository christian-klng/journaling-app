import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { AttentionDot, Card, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { studyGroups } from "@/lib/db/schema";
import { formatCode } from "@/lib/study/code";
import { CodeForm, GroupForm } from "./profile-forms";

export const metadata: Metadata = { title: "Code und Gruppe" };

export default async function ProfilePage() {
  const user = await requireUser();

  if (!user.codeStem) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Persönlicher Code</h1>
        <Notice>Bevor es weitergeht, bilde bitte einmal deinen persönlichen Code.</Notice>
        <CodeForm />
      </div>
    );
  }

  const [group] = user.studyGroupId
    ? await db.select({ letter: studyGroups.letter }).from(studyGroups).where(eq(studyGroups.id, user.studyGroupId))
    : [];
  // Nur die Buchstaben; die interne Bezeichnung der Gruppen bleibt den Admins vorbehalten
  const groups = group
    ? []
    : await db.select({ id: studyGroups.id, letter: studyGroups.letter }).from(studyGroups).orderBy(asc(studyGroups.letter));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Startseite
        </Link>
        <h1 className="text-xl font-semibold">Code und Gruppe</h1>
      </div>

      <Card className="space-y-4">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-muted">Benutzername</dt>
            <dd className="font-semibold">{user.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Persönlicher Code</dt>
            <dd className="font-mono text-2xl tracking-wider">{formatCode(user.codeStem, group?.letter ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Gruppe</dt>
            <dd className="flex items-center gap-2 font-semibold">
              {group ? (
                `Gruppe ${group.letter}`
              ) : (
                <>
                  <AttentionDot />
                  Noch nicht eingetragen
                </>
              )}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted">
          Stimmt etwas am Code oder an der Gruppe nicht? Wende dich an die Studienleitung, sie kann es
          korrigieren.
        </p>
      </Card>

      {!group && groups.length > 0 && (
        <Card>
          <GroupForm groups={groups} />
        </Card>
      )}
    </div>
  );
}
