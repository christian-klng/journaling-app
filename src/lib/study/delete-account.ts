import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deletionNotices, studyGroups, users } from "@/lib/db/schema";
import { deleteByPrefix } from "@/lib/storage";
import { formatCode } from "./code";

/**
 * Löscht ein Konto der Teilnehmenden endgültig, mit allen Einträgen und Aufnahmen. Erst die
 * Audiodateien, dann die Datenbank: Scheitert der Speicher, bleibt das Konto vollständig erhalten.
 * Fantasiename und Code bleiben als Hinweis, damit die Studienleitung auch Exporte bereinigt.
 */
export async function deleteParticipantAccount(userId: string, bySelf: boolean) {
  const [user] = await db
    .select({ id: users.id, displayName: users.displayName, codeStem: users.codeStem, groupLetter: studyGroups.letter })
    .from(users)
    .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
    .where(and(eq(users.id, userId), eq(users.role, "user")));
  if (!user) return false;

  await deleteByPrefix(`users/${user.id}/`);
  await db.transaction(async (tx) => {
    await tx.insert(deletionNotices).values({
      displayName: user.displayName,
      code: formatCode(user.codeStem, user.groupLetter),
      bySelf,
    });
    await tx.delete(users).where(eq(users.id, user.id));
  });
  return true;
}
