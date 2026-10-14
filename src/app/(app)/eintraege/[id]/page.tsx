import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryView } from "@/components/entry-view";
import { requireParticipant } from "@/lib/auth/guards";
import { entryTitle } from "@/lib/entry-title";
import { getAccessibleEntry, isUuid, toEntryDto } from "@/lib/entries";
import { formatDate } from "@/lib/format";
import { getStudyPeriod } from "@/lib/settings";

export const metadata: Metadata = { title: "Eintrag" };

export default async function EntryPage({ params }: PageProps<"/eintraege/[id]">) {
  const user = await requireParticipant();
  const { id } = await params;
  const entry = isUuid(id) ? await getAccessibleEntry(id, user) : null;
  if (!entry || entry.userId !== user.id) notFound();

  const dto = toEntryDto(entry, (await getStudyPeriod()).start);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Startseite
        </Link>
        <h1 className="text-xl font-semibold">{entryTitle(dto)}</h1>
        <p className="text-sm text-muted">
          {formatDate(dto.completedAt ?? dto.createdAt)}
          {dto.late && " · nachgeholt"}
        </p>
      </div>
      {/* Neuer Schlüssel nach weiteren Aufnahmen, damit die Ansicht den frischen Stand übernimmt */}
      <EntryView key={`${dto.pending}`} initial={dto} />
    </div>
  );
}
