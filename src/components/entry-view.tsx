"use client";

import type { EntryDto, RecordingDto } from "@/lib/entries";
import { formatDuration, formatTime } from "@/lib/format";
import { SCALE_MAX, SMILEYS } from "@/lib/study/config";
import { Card, Spinner } from "./ui";
import { useLiveEntry } from "./use-live-entry";

/** Antworten, Aufnahmen und Transkripte eines Eintrags; aktualisiert sich während der Transkription. */
export function EntryView({ initial }: { initial: EntryDto }) {
  const entry = useLiveEntry(initial.id, initial) ?? initial;

  return (
    <div className="space-y-4">
      {entry.parts.map((part) => (
        <Card key={part.itemId} className="space-y-3">
          <p className="font-medium">{part.text}</p>
          {part.type === "smiley" && part.value !== null && <SmileyValue value={part.value} />}
          {part.type === "scale" && part.value !== null && (
            <p>
              <span className="text-2xl font-semibold tabular-nums">{part.value}</span>
              <span className="text-muted"> von {SCALE_MAX}</span>
            </p>
          )}
          {part.recordings.map((recording) => (
            <RecordingView key={recording.id} recording={recording} label={part.recordings.length > 1} />
          ))}
        </Card>
      ))}

      {entry.recordings.map((recording) => (
        <Card key={recording.id} className="space-y-3">
          <RecordingView recording={recording} label />
        </Card>
      ))}
    </div>
  );
}

function SmileyValue({ value }: { value: number }) {
  const smiley = SMILEYS.find((s) => s.value === value);
  if (!smiley) return null;
  return (
    <p className="flex items-center gap-2">
      <span aria-hidden className="text-3xl leading-none">
        {smiley.emoji}
      </span>
      <span>{smiley.label}</span>
    </p>
  );
}

function RecordingView({ recording, label }: { recording: RecordingDto; label: boolean }) {
  return (
    <div className="space-y-3">
      {label && (
        <p className="text-sm text-muted">
          Aufnahme {recording.position} · {formatTime(recording.createdAt)}
          {recording.durationSeconds != null && ` · ${formatDuration(recording.durationSeconds)}`}
        </p>
      )}
      {recording.audioDeleted ? (
        <p className="text-sm text-muted">Die Audiodatei wurde nach dem Ende der Studie gelöscht.</p>
      ) : (
        <audio controls preload="none" src={`/api/recordings/${recording.id}/audio`} className="w-full" />
      )}
      {recording.status === "done" && recording.transcript && (
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
    </div>
  );
}
