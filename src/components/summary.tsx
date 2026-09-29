import type { EntryDto } from "@/lib/entries";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent ${className}`}
    />
  );
}

export function Summary({ entry }: { entry: Pick<EntryDto, "summary" | "summaryReady" | "summaryFailed" | "pending" | "recordings"> }) {
  const hasTranscript = entry.recordings.some((r) => r.status === "done");

  if (entry.summary && (entry.summaryReady || !entry.pending)) {
    return (
      <ul className="space-y-2">
        {entry.summary.map((point, index) => (
          <li key={index} className="flex gap-3">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (entry.pending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Spinner />
        {hasTranscript ? "Zusammenfassung wird erstellt …" : "Aufnahme wird transkribiert …"}
      </p>
    );
  }

  return (
    <p className="text-sm text-muted">
      {hasTranscript
        ? "Die Zusammenfassung konnte noch nicht erstellt werden. Wir versuchen es automatisch erneut."
        : "Die Aufnahme konnte noch nicht verarbeitet werden. Sie ist gespeichert, wir versuchen es automatisch erneut."}
    </p>
  );
}
