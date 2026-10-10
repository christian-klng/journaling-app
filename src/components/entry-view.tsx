"use client";

import type { EntryDto } from "@/lib/entries";
import { formatDuration, formatTime } from "@/lib/format";
import { Card, Spinner } from "./ui";
import { useLiveEntry } from "./use-live-entry";

/** Aufnahmen und Transkripte eines Eintrags, aktualisiert sich während der Transkription. */
export function EntryView({ initial }: { initial: EntryDto }) {
  const entry = useLiveEntry(initial.id, initial) ?? initial;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">
          {entry.recordings.length === 1 ? "Aufnahme" : `${entry.recordings.length} Aufnahmen`}
        </h2>
        {entry.recordings.map((recording) => (
          <Card key={recording.id} className="space-y-3">
            <p className="text-sm text-muted">
              Aufnahme {recording.position} · {formatTime(recording.createdAt)}
              {recording.durationSeconds != null && ` · ${formatDuration(recording.durationSeconds)}`}
            </p>
            <audio
              controls
              preload="none"
              src={`/api/recordings/${recording.id}/audio`}
              className="w-full"
            />
            {recording.status === "done" && (
              <p className="whitespace-pre-wrap leading-relaxed">{recording.transcript}</p>
            )}
            {(recording.status === "uploaded" || recording.status === "transcribing") && (
              <p className="flex items-center gap-2 text-sm text-muted" role="status">
                <Spinner /> Wird transkribiert …
              </p>
            )}
            {recording.status === "failed" && (
              <p className="text-sm text-muted">
                Die Transkription hat noch nicht geklappt. Wir versuchen es automatisch erneut.
              </p>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
