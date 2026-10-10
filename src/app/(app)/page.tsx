import Link from "next/link";
import { PendingUploads } from "@/components/pending-uploads";
import { RecordingModal } from "@/components/recording-modal";
import { Card, Notice, Spinner } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { listEntries, toEntryDto, type EntryDto } from "@/lib/entries";
import { formatDate, formatDuration } from "@/lib/format";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const params = await searchParams;
  const entries = (await listEntries(user.id)).map(toEntryDto);

  return (
    <div className="space-y-6">
      {params.willkommen && (
        <Notice>
          Willkommen! Dein Benutzername ist <strong>{user.displayName}</strong>. Mit ihm meldest du
          dich an, notiere ihn dir. Unter diesem Namen sieht die wissenschaftliche Begleitung deine
          Einträge.
        </Notice>
      )}
      {params.passwort && <Notice>Dein Passwort wurde geändert.</Notice>}

      <RecordingModal label="Neuer Eintrag" />
      <PendingUploads />

      <section className="space-y-3">
        <h1 className="text-sm font-medium text-muted">Deine Einträge</h1>
        {entries.length === 0 && (
          <p className="text-muted">
            Noch keine Einträge. Sprich deinen ersten Rückblick ein: Was ist seit dem letzten Mal
            passiert, was lief gut, was hat dich beschäftigt?
          </p>
        )}
        {entries.map((entry) => {
          const seconds = entry.recordings.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
          return (
            <Link key={entry.id} href={`/eintraege/${entry.id}`} className="block">
              <Card className="space-y-3 transition-colors hover:border-accent">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{formatDate(entry.createdAt)}</h2>
                  <p className="shrink-0 text-sm text-muted">
                    {entry.recordings.length > 1 && `${entry.recordings.length} Aufnahmen · `}
                    {formatDuration(seconds)}
                  </p>
                </div>
                <EntryPreview entry={entry} />
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function EntryPreview({ entry }: { entry: EntryDto }) {
  const transcript = entry.recordings.find((r) => r.status === "done")?.transcript;
  if (transcript) return <p className="line-clamp-3 text-muted">{transcript}</p>;
  if (entry.pending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Spinner /> Aufnahme wird transkribiert …
      </p>
    );
  }
  return (
    <p className="text-sm text-muted">
      Die Aufnahme ist gespeichert, die Transkription hat noch nicht geklappt. Wir versuchen es
      automatisch erneut.
    </p>
  );
}
