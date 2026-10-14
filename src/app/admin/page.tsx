import type { Metadata } from "next";
import Link from "next/link";
import { ExportLink } from "@/components/admin/export-link";
import { BulkGroupForm } from "@/components/admin/participant-forms";
import { AttentionDot, Card, Notice } from "@/components/ui";
import { getOverview, type Member } from "@/lib/admin/queries";
import { formatShortDate } from "@/lib/format";
import { findDuplicateCodes, formatCode } from "@/lib/study/code";

export const metadata: Metadata = { title: "Übersicht" };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const [overview, params] = await Promise.all([getOverview(), searchParams]);
  const duplicates = findDuplicateCodes(overview.members);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Übersicht</h1>
        {overview.totalEntries > 0 && <ExportLink label="Alles exportieren" size="md" />}
      </div>

      {params.geloescht && <Notice>Das Konto wurde mit allen Einträgen und Aufnahmen gelöscht.</Notice>}
      {duplicates.length > 0 && (
        <div role="alert" className="space-y-1 rounded-xl border border-record/40 px-3 py-2 text-sm">
          <p className="font-medium">Doppelte Codes</p>
          <p className="text-muted">
            Diese Personen lassen sich über ihren Code nicht unterscheiden. Bitte frag nach und
            korrigiere den Code oder die Gruppe auf ihrer Seite.
          </p>
          <ul className="list-inside list-disc">
            {duplicates.map((d) => (
              <li key={d.stem}>
                <span className="font-mono">{d.stem}</span>: {d.people.map((p) => p.displayName).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {overview.members.length === 0 && (
        <p className="text-muted">
          Noch ist niemand registriert. Unter{" "}
          <Link href="/admin/studie" className="font-medium text-accent underline underline-offset-4">
            Studie
          </Link>{" "}
          legst du die Gruppen an, die bei der Registrierung zur Auswahl stehen.
        </p>
      )}

      {overview.groups.map((group) => (
        <GroupCard
          key={group.id}
          name={`Gruppe ${group.letter}${group.label ? ` – ${group.label}` : ""}`}
          members={group.members}
          exportQuery={`?group=${group.id}`}
        />
      ))}
      {overview.withoutGroup.length > 0 && (
        <GroupCard name="Ohne Gruppe" members={overview.withoutGroup} exportQuery="?group=none" muted />
      )}

      {overview.members.length > 0 && (
        <Card className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-semibold">Gruppen zuweisen</h2>
            <p className="text-sm text-muted">
              Eine Zeile pro Person: persönlicher Code und Gruppe, z. B. „KA-03-BE A“. Bereits
              eingetragene Gruppen werden überschrieben. Codes, die es mehrfach gibt, bitte einzeln
              auf der Seite der Person zuweisen.
            </p>
          </div>
          <BulkGroupForm />
        </Card>
      )}
    </div>
  );
}

function GroupCard({
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
                    <span className="min-w-0">
                      <span className="block font-medium">{member.displayName}</span>
                      <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                        {formatCode(member.codeStem, member.groupLetter) ?? "kein Code"}
                        {member.codeStem && !member.groupLetter && <AttentionDot className="scale-75" />}
                      </span>
                    </span>
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
              <ExportLink query={exportQuery} label="Gruppe exportieren" />
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
