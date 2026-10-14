import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryView } from "@/components/entry-view";
import { RecordingModal } from "@/components/recording-modal";
import { requireParticipant } from "@/lib/auth/guards";
import { getAccessibleEntry, isUuid, toEntryDto } from "@/lib/entries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Eintrag" };

export default async function EntryPage({ params }: PageProps<"/eintraege/[id]">) {
  const user = await requireParticipant();
  const { id } = await params;
  const entry = isUuid(id) ? await getAccessibleEntry(id, user) : null;
  if (!entry || entry.userId !== user.id) notFound();

  const dto = toEntryDto(entry);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Alle Einträge
        </Link>
        <h1 className="text-xl font-semibold">{formatDate(entry.createdAt)}</h1>
      </div>
      {/* Neuer Schlüssel nach einer weiteren Aufnahme, damit die Ansicht den frischen Stand übernimmt */}
      <EntryView key={`${dto.recordings.length}-${dto.pending}`} initial={dto} />
      <RecordingModal entryId={entry.id} label="Aufnahme fortsetzen" variant="button" />
    </div>
  );
}
