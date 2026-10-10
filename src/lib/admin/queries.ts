import "server-only";
import { asc, count, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, recordings, teams, users } from "@/lib/db/schema";

const memberColumns = {
  id: users.id,
  displayName: users.displayName,
  role: users.role,
  teamId: users.teamId,
  createdAt: users.createdAt,
};

export type Member = {
  id: string;
  displayName: string;
  teamId: string | null;
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
      entryCount: count(entries.id),
      lastEntryAt: max(entries.createdAt),
    })
    .from(users)
    .leftJoin(entries, eq(entries.userId, users.id))
    .where(eq(users.role, "user"))
    .groupBy(users.id)
    .orderBy(asc(users.displayName));

  return {
    teams: allTeams.map((team) => ({
      ...team,
      members: members.filter((m) => m.teamId === team.id),
    })),
    withoutTeam: members.filter((m) => m.teamId === null),
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
    .select(memberColumns)
    .from(users)
    .where(eq(users.id, userId));
  return member ?? null;
}

export type ExportScope = { userId?: string; teamId?: string | "none" };

/** Alle Einträge im gewählten Umfang, sortiert nach Team, Name und Datum. */
export async function getExportData(scope: ExportScope) {
  const where = scope.userId
    ? eq(users.id, scope.userId)
    : scope.teamId === "none"
      ? sql`${users.teamId} is null and ${users.role} = 'user'`
      : scope.teamId
        ? eq(users.teamId, scope.teamId)
        : eq(users.role, "user");

  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      teamName: teams.name,
      entry: entries,
    })
    .from(entries)
    .innerJoin(users, eq(users.id, entries.userId))
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(where)
    .orderBy(asc(teams.name), asc(users.displayName), asc(entries.createdAt));

  const allRecordings = rows.length
    ? await db
        .select()
        .from(recordings)
        .where(
          sql`${recordings.entryId} in (${sql.join(
            rows.map((r) => sql`${r.entry.id}`),
            sql`, `,
          )})`,
        )
        .orderBy(asc(recordings.position))
    : [];

  return rows.map((row) => ({
    ...row,
    recordings: allRecordings.filter((r) => r.entryId === row.entry.id),
  }));
}

export type ExportRow = Awaited<ReturnType<typeof getExportData>>[number];

export async function listEntriesForAdmin(userId: string) {
  return db.query.entries.findMany({
    where: eq(entries.userId, userId),
    orderBy: desc(entries.createdAt),
    with: { recordings: { orderBy: asc(recordings.position) } },
  });
}
