import type { Metadata } from "next";
import Link from "next/link";
import { ExportLink } from "@/components/admin/export-link";
import { Card } from "@/components/ui";
import { getOverview, type Member } from "@/lib/admin/queries";
import { formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Teams" };

export default async function AdminHome() {
  const overview = await getOverview();
  const hasMembers = overview.teams.some((t) => t.members.length > 0) || overview.withoutTeam.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Teams</h1>
        {overview.totalEntries > 0 && <ExportLink label="Alles exportieren" size="md" />}
      </div>

      {!hasMembers && overview.teams.length === 0 && (
        <p className="text-muted">
          Noch ist niemand registriert. Lege unter{" "}
          <Link href="/admin/teams" className="font-medium text-accent underline underline-offset-4">
            Teams
          </Link>{" "}
          die Teams an, die bei der Registrierung zur Auswahl stehen sollen.
        </p>
      )}

      {overview.teams.map((team) => (
        <TeamCard key={team.id} name={team.name} members={team.members} exportQuery={`?team=${team.id}`} />
      ))}
      {(overview.withoutTeam.length > 0 || overview.teams.length > 0) && (
        <TeamCard name="Ohne Team" members={overview.withoutTeam} exportQuery="?team=none" muted />
      )}
    </div>
  );
}

function TeamCard({
  name,
  members,
  exportQuery,
  muted = false,
}: {
  name: string;
  members: Member[];
  exportQuery: string;
  muted?: boolean;
}) {
  const hasEntries = members.some((m) => m.entryCount > 0);

  return (
    <Card className="p-0">
      <details open className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
            ›
          </span>
          <h2 className={`flex-1 font-semibold ${muted ? "text-muted" : ""}`}>{name}</h2>
          <span className="text-sm text-muted">
            {members.length === 1 ? "1 Person" : `${members.length} Personen`}
          </span>
        </summary>

        <div className="border-t border-border">
          {members.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Niemand zugeordnet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/admin/nutzer/${member.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-accent-soft"
                  >
                    <span className="font-medium">{member.displayName}</span>
                    <span className="text-right text-sm text-muted">
                      {member.entryCount === 0
                        ? "Noch kein Eintrag"
                        : `${member.entryCount} ${member.entryCount === 1 ? "Eintrag" : "Einträge"} · zuletzt ${formatShortDate(member.lastEntryAt!)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hasEntries && (
            <div className="border-t border-border px-4 py-3">
              <ExportLink query={exportQuery} label="Team exportieren" />
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
