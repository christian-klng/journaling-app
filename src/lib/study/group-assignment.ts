import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { studyGroups, users } from "@/lib/db/schema";
import { isRandomGroupAssignmentEnabled } from "@/lib/settings";
import { pickBalancedGroup } from "./code";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Die zufällige Zuordnung greift nur, wenn sie eingeschaltet ist und es mindestens zwei Gruppen gibt. */
export async function isRandomGroupAssignmentActive() {
  const [enabled, [groups]] = await Promise.all([
    isRandomGroupAssignmentEnabled(),
    db.select({ n: count() }).from(studyGroups),
  ]);
  return enabled && groups.n >= 2;
}

/** Lost einer neuen Person eine der kleinsten Gruppen zu. Läuft in der Transaktion, die das Konto anlegt. */
export async function drawGroup(tx: Transaction) {
  // Hintereinander, damit zwei gleichzeitige Registrierungen nicht beide dieselbe kleinste Gruppe sehen
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('random_group_assignment'))`);
  const groups = await tx
    .select({ id: studyGroups.id, members: count(users.id) })
    .from(studyGroups)
    .leftJoin(users, and(eq(users.studyGroupId, studyGroups.id), eq(users.role, "user")))
    .groupBy(studyGroups.id);
  return pickBalancedGroup(groups)?.id ?? null;
}
