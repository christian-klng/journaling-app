import "server-only";
import { and, asc, count, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, questionnaires, recordings, studyGroups, teams, users } from "@/lib/db/schema";

const memberColumns = {
  id: users.id,
  displayName: users.displayName,
  role: users.role,
  teamId: users.teamId,
  codeStem: users.codeStem,
  studyGroupId: users.studyGroupId,
  createdAt: users.createdAt,
};

export type Member = {
  id: string;
  displayName: string;
  teamId: string | null;
  codeStem: string | null;
  groupLetter: string | null;
  entryCount: number;
  lastEntryAt: Date | null;
};

export async function getOverview() {
  const allTeams = await db.select().from(teams).orderBy(asc(teams.name));

  const members: Member[] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      teamId: users.teamId,
      codeStem: users.codeStem,
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
    teams: allTeams.map((team) => ({
      ...team,
      members: members.filter((m) => m.teamId === team.id),
    })),
    withoutTeam: members.filter((m) => m.teamId === null),
    members,
    totalEntries: members.reduce((sum, m) => sum + m.entryCount, 0),
  };
}

export function listTeams() {
  return db
    .select({ id: teams.id, name: teams.name, memberCount: count(users.id) })
    .from(teams)
    .leftJoin(users, eq(users.teamId, teams.id))
    .groupBy(teams.id)
    .orderBy(asc(teams.name));
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

export type ExportScope = { userId?: string; teamId?: string | "none" };

/**
 * Personen im gewählten Umfang mit allen Einträgen, Antworten und Aufnahmen, dazu alles für die
 * Teilnahme: aktive Abfragen und der Stand der Einträge.
 */
export async function getExportData(scope: ExportScope) {
  const where = scope.userId
    ? and(eq(users.id, scope.userId), eq(users.role, "user"))
    : scope.teamId === "none"
      ? and(isNull(users.teamId), eq(users.role, "user"))
      : scope.teamId
        ? and(eq(users.teamId, scope.teamId), eq(users.role, "user"))
        : eq(users.role, "user");

  const people = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      codeStem: users.codeStem,
      studyGroupId: users.studyGroupId,
      groupLetter: studyGroups.letter,
      teamName: teams.name,
    })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
    .where(where)
    .orderBy(asc(teams.name), asc(users.displayName));

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
        teamName: teams.name,
      })
      .from(users)
      .leftJoin(studyGroups, eq(studyGroups.id, users.studyGroupId))
      .leftJoin(teams, eq(teams.id, users.teamId))
      .where(eq(users.role, "user"))
      .orderBy(asc(teams.name), asc(users.displayName)),
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
