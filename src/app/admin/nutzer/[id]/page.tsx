import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { CodeStemForm } from "@/components/admin/participant-forms";
import { ExportLink } from "@/components/admin/export-link";
import { ResetPassword } from "@/components/admin/reset-password";
import { EntryView } from "@/components/entry-view";
import { Button, Card } from "@/components/ui";
import { assignStudyGroup, assignTeam, deleteParticipant, retryEntry } from "@/lib/admin/actions";
import { getMember, listTeams } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { entryTitle } from "@/lib/entry-title";
import { isUuid, listEntries, toEntryDto } from "@/lib/entries";
import { getStudyPeriod } from "@/lib/settings";
import { formatDate, formatShortDate } from "@/lib/format";
import { formatCode } from "@/lib/study/code";
import { listStudyGroups } from "@/lib/study/queries";

export const metadata: Metadata = { title: "Person" };

export default async function MemberPage({ params }: PageProps<"/admin/nutzer/[id]">) {
  const me = await requireAdmin();
  const { id } = await params;
  const member = isUuid(id) ? await getMember(id) : null;
  if (!member) notFound();

  const [teams, groups, entries, period] = await Promise.all([
    listTeams(),
    listStudyGroups(),
    listEntries(member.id),
    getStudyPeriod(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin" className="text-sm text-muted hover:text-foreground">
          ← Übersicht
        </Link>
        <h1 className="text-xl font-semibold">{member.displayName}</h1>
        <p className="text-sm text-muted">
          {member.role === "user" && (
            <>
              <span className="font-mono">{formatCode(member.codeStem, member.groupLetter) ?? "kein Code"}</span>
              {" · "}
            </>
          )}
          Dabei seit {formatShortDate(member.createdAt)}
          {member.role === "admin" && " · Admin"}
        </p>
      </div>

      <Card className="space-y-4">
        {member.role === "user" && (
          <form action={assignTeam.bind(null, member.id)} className="space-y-1.5">
            <span className="text-sm font-medium">Team</span>
            <AutoSubmitSelect
              name="teamId"
              label="Team"
              defaultValue={member.teamId ?? ""}
              options={[
                { value: "", label: "Ohne Team" },
                ...teams.map((team) => ({ value: team.id, label: team.name })),
              ]}
            />
          </form>
        )}
        {member.role === "user" && (
          <form action={assignStudyGroup.bind(null, member.id)} className="space-y-1.5">
            <span className="text-sm font-medium">Gruppe</span>
            <AutoSubmitSelect
              name="groupId"
              label="Gruppe"
              defaultValue={member.studyGroupId ?? ""}
              options={[
                { value: "", label: "Keine Gruppe" },
                ...groups.map((group) => ({
                  value: group.id,
                  label: `Gruppe ${group.letter}${group.label ? ` – ${group.label}` : ""}`,
                })),
              ]}
            />
          </form>
        )}
        {member.role === "user" && <CodeStemForm userId={member.id} codeStem={member.codeStem} />}
        {member.id !== me.id && (
          <div className="flex flex-wrap gap-2">
            <ResetPassword userId={member.id} displayName={member.displayName} />
            {member.role === "user" && (
              <ConfirmForm
                action={deleteParticipant.bind(null, member.id)}
                message={`Konto ${member.displayName} mit ${entries.length === 1 ? "1 Eintrag" : `${entries.length} Einträgen`} und allen Aufnahmen endgültig löschen? Das lässt sich nicht rückgängig machen.`}
              >
                <Button type="submit" variant="danger" size="sm">
                  Konto löschen
                </Button>
              </ConfirmForm>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">
          {entries.length === 1 ? "1 Eintrag" : `${entries.length} Einträge`}
        </h2>
        {entries.length > 0 && <ExportLink query={`?user=${member.id}`} label="Einträge exportieren" />}
      </div>

      {entries.length === 0 && <p className="text-muted">Diese Person hat noch nichts aufgenommen.</p>}

      {entries.map((entry, index) => {
        const dto = toEntryDto(entry, period.start);
        const stuck = !dto.pending && entry.recordings.some((r) => r.status === "failed");
        return (
          <details key={entry.id} open={index === 0} className="group space-y-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 border-b border-border [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
                ›
              </span>
              <span className="min-w-0 flex-1 py-1">
                <h3 className="font-semibold">{entryTitle(dto)}</h3>
                <span className="block text-sm text-muted">
                  {formatDate(entry.createdAt)}
                  {dto.groupLetter && ` · Gruppe ${dto.groupLetter}`}
                  {dto.late && " · nachgeholt"}
                </span>
              </span>
              <span className="shrink-0 text-sm text-muted">
                {entry.questionnaireId && !entry.completedAt ? "begonnen" : ""}
              </span>
            </summary>
            <div className="space-y-4 pt-4">
              <EntryView key={`${dto.recordings.length}-${dto.pending}`} initial={dto} />
              {stuck && (
                <form action={retryEntry.bind(null, entry.id)}>
                  <Button type="submit" variant="secondary" size="sm">
                    Verarbeitung erneut starten
                  </Button>
                </form>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
