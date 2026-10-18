import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { deletionNotices, entries, questionnaires, recordings, studyGroups, users } from "@/lib/db/schema";

const memberColumns = {
  id: users.id,
  displayName: users.displayName,
  role: users.role,
  codeStem: users.codeStem,
  studyGroupId: users.studyGroupId,
  createdAt: users.createdAt,
};

export type Member = {
  id: string;
  displayName: string;
  codeStem: string | null;
  studyGroupId: string | null;
  groupLetter: string | null;
  entryCount: number;
  lastEntryAt: Date | null;
};

export async function getOverview() {
  const groups = await db.select().from(studyGroups).orderBy(asc(studyGroups.letter));

  const members: Member[] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      codeStem: users.codeStem,
      studyGroupId: users.studyGroupId,
      groupLetter: studyGroups.letter,
      entryCount: count(entries.id),
      lastEntryAt: max(entries.createdAt),
    })
    .from(users)
    .leftJoin(entries, eq(entries.userId, users.id))
    .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
    .where(eq(users.role, "user"))
    .groupBy(users.id, studyGroups.letter)
    .orderBy(asc(users.displayName));

  return {
    groups: groups.map((group) => ({
      ...group,
      members: members.filter((m) => m.studyGroupId === group.id),
    })),
    withoutGroup: members.filter((m) => m.studyGroupId === null),
    members,
    totalEntries: members.reduce((sum, m) => sum + m.entryCount, 0),
  };
}

export function listAdmins() {
  return db.select(memberColumns).from(users).where(eq(users.role, "admin")).orderBy(asc(users.displayName));
}

export async function getMember(userId: string) {
  const [member] = await db
    .select({ ...memberColumns, groupLetter: studyGroups.letter })
    .from(users)
    .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
    .where(eq(users.id, userId));
  return member ?? null;
}

export type ExportScope = { userId?: string; groupId?: string | "none" };

/**
 * Personen im gewählten Umfang mit allen Einträgen, Antworten und Aufnahmen, dazu alles für die
 * Teilnahme: aktive Abfragen und der Stand der Einträge.
 */
export async function getExportData(scope: ExportScope) {
  const where = scope.userId
    ? and(eq(users.id, scope.userId), eq(users.role, "user"))
    : scope.groupId === "none"
      ? and(isNull(users.studyGroupId), eq(users.role, "user"))
      : scope.groupId
        ? and(eq(users.studyGroupId, scope.groupId), eq(users.role, "user"))
        : eq(users.role, "user");

  const people = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      codeStem: users.codeStem,
      studyGroupId: users.studyGroupId,
      groupLetter: studyGroups.letter,
    })
    .from(users)
    .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
    .where(where)
    .orderBy(asc(studyGroups.letter), asc(users.displayName));

  const ids = people.map((p) => p.id);
  const [personEntries, activeQuestionnaires] = await Promise.all([
    ids.length
      ? db.query.entries.findMany({
          where: inArray(entries.userId, ids),
          orderBy: asc(entries.createdAt),
          with: {
            recordings: { orderBy: asc(recordings.position) },
            answers: true,
            questionnaire: { columns: { name: true }, with: { items: { columns: { id: true, position: true } } } },
            studyGroup: { columns: { letter: true } },
          },
        })
      : [],
    db
      .select({
        id: questionnaires.id,
        groupId: questionnaires.groupId,
        name: questionnaires.name,
        opensOn: questionnaires.opensOn,
        closesOn: questionnaires.closesOn,
        position: questionnaires.position,
      })
      .from(questionnaires)
      .where(isNull(questionnaires.archivedAt)),
  ]);

  return { people, entries: personEntries, questionnaires: activeQuestionnaires };
}


/** Alles für die Teilnahme-Tabelle: Personen, aktive Abfragen und abgegebene Einträge. */
export async function getParticipationData() {
  const [people, activeQuestionnaires, rows] = await Promise.all([
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        codeStem: users.codeStem,
        studyGroupId: users.studyGroupId,
        groupLetter: studyGroups.letter,
      })
      .from(users)
      .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
      .where(eq(users.role, "user"))
      .orderBy(asc(studyGroups.letter), asc(users.displayName)),
    db
      .select({
        id: questionnaires.id,
        groupId: questionnaires.groupId,
        name: questionnaires.name,
        opensOn: questionnaires.opensOn,
        closesOn: questionnaires.closesOn,
        position: questionnaires.position,
      })
      .from(questionnaires)
      .where(isNull(questionnaires.archivedAt)),
    db
      .select({
        userId: entries.userId,
        questionnaireId: entries.questionnaireId,
        weekStart: entries.weekStart,
        completedAt: entries.completedAt,
        late: entries.late,
      })
      .from(entries)
      .where(isNotNull(entries.questionnaireId)),
  ]);
  return { people, questionnaires: activeQuestionnaires, entries: rows };
}

/** Gelöschte Konten, die die Studienleitung noch aus ihren Exporten entfernen muss. */
export function getDeletionNotices() {
  return db.select().from(deletionNotices).orderBy(desc(deletionNotices.deletedAt));
}
