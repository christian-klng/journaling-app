import Link from "next/link";
import { eq } from "drizzle-orm";
import { PendingUploads } from "@/components/pending-uploads";
import { AttentionDot, Button, Card, Notice } from "@/components/ui";
import { requireParticipant } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { studyGroups } from "@/lib/db/schema";
import { entryTitle } from "@/lib/entry-title";
import { listEntries, toEntryDto } from "@/lib/entries";
import { formatDate, formatShortDate } from "@/lib/format";
import { formatCode } from "@/lib/study/code";
import { isRandomGroupAssignmentActive } from "@/lib/study/group-assignment";
import { getParticipantSchedule, type ParticipantSlot } from "@/lib/study/participant";
import { formatDay, formatRange } from "@/lib/study/schedule";

const slotHref = (slot: ParticipantSlot) => `/abfrage/${slot.questionnaire.id}/${slot.weekStart}`;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireParticipant();
  const [params, schedule, all, [group], randomGroup] = await Promise.all([
    searchParams,
    getParticipantSchedule(user),
    listEntries(user.id),
    user.studyGroupId
      ? db.select({ letter: studyGroups.letter }).from(studyGroups).where(eq(studyGroups.id, user.studyGroupId))
      : [],
    user.studyGroupId ? false : isRandomGroupAssignmentActive(),
  ]);
  const studyStart = schedule.period.start;
  const done = all
    .filter((entry) => entry.completedAt || !entry.questionnaireId)
    .map((entry) => toEntryDto(entry, studyStart));
  const beforeStart = studyStart !== null && schedule.today < studyStart;

  return (
    <div className="space-y-6">
      {params.willkommen && (
        <Notice>
          Willkommen! Dein Benutzername ist <strong>{user.displayName}</strong>. Mit ihm meldest du
          dich an, notiere ihn dir. Unter diesem Namen sieht die wissenschaftliche Begleitung deine
          Einträge.
          {group && (
            <>
              {" "}
              Du bist in Gruppe {group.letter}, dein persönlicher Code ist{" "}
              <strong className="font-mono">{formatCode(user.codeStem, group.letter)}</strong>.
            </>
          )}
        </Notice>
      )}
      {params.passwort && <Notice>Dein Passwort wurde geändert.</Notice>}
      {params.erledigt && <Notice>Danke! Deine Antworten sind gespeichert.</Notice>}

      {!user.studyGroupId && (
        <Link
          href="/profil"
          className="flex items-center gap-3 rounded-xl border border-record/40 px-3 py-2 text-sm hover:bg-accent-soft"
        >
          <AttentionDot />
          <span>
            <strong>Deine Gruppe fehlt noch.</strong>{" "}
            {randomGroup
              ? "Die Studienleitung trägt sie für dich ein."
              : "Trag sie ein, sobald du sie von der Studienleitung erfahren hast."}{" "}
            Danach erscheinen hier deine Fragen.
          </span>
        </Link>
      )}

      <PendingUploads />

      {schedule.open.map((slot) => (
        <Link
          key={`${slot.questionnaire.id}-${slot.weekStart}`}
          href={slotHref(slot)}
          className="flex w-full flex-col items-center gap-2 rounded-3xl bg-accent px-6 py-7 text-center text-on-accent transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="text-xl font-semibold">
            {slot.entry ? `${slot.questionnaire.name} fortsetzen` : `${slot.questionnaire.name} starten`}
          </span>
          <span className="text-sm opacity-85">
            Woche {slot.weekNumber} · möglich bis {formatDay(slot.to)}
          </span>
        </Link>
      ))}

      {user.studyGroupId && schedule.open.length === 0 && (
        <Card className="space-y-1 text-center">
          <p className="font-semibold">
            {beforeStart
              ? `Die Studie beginnt am ${formatShortDate(studyStart!)}.`
              : schedule.slots.length > 0
                ? "Gerade ist nichts offen."
                : "Noch keine Fragen für dich."}
          </p>
          {schedule.next && (
            <p className="text-sm text-muted">
              Als Nächstes: {schedule.next.questionnaire.name} ab {formatDay(schedule.next.from)}
            </p>
          )}
        </Card>
      )}
      {schedule.open.length > 0 && schedule.next && (
        <p className="text-center text-sm text-muted">
          Danach: {schedule.next.questionnaire.name} ab {formatDay(schedule.next.from)}
        </p>
      )}

      {schedule.missed.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-muted">Verpasst</h2>
            <p className="text-sm text-muted">Abfragen lassen sich nur in ihrem Zeitfenster ausfüllen.</p>
          </div>
          <ul className="space-y-2">
            {schedule.missed.map((slot) => (
              <li key={`${slot.questionnaire.id}-${slot.weekStart}`}>
                <Card className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-medium">
                      Woche {slot.weekNumber} · {slot.questionnaire.name}
                    </span>
                    <span className="block text-sm text-muted">{formatRange(slot.from, slot.to)}</span>
                  </span>
                  <Button variant="secondary" size="sm" className="shrink-0 disabled:hover:bg-surface" disabled>
                    {slot.entry ? "Fortsetzen" : "Nachholen"}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Erledigt</h2>
          {done.map((entry) => (
            <Link key={entry.id} href={`/eintraege/${entry.id}`} className="block">
              <Card className="space-y-1 transition-colors hover:border-accent">
                <p className="font-semibold">{entryTitle(entry)}</p>
                <p className="text-sm text-muted">
                  {formatDate(entry.completedAt ?? entry.createdAt)}
                  {entry.late && " · nachgeholt"}
                </p>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
