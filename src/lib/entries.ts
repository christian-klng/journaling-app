import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, recordings, type Entry, type Recording, type User } from "@/lib/db/schema";

export type EntryWithRecordings = Entry & { recordings: Recording[] };

export type RecordingDto = {
  id: string;
  position: number;
  status: Recording["status"];
  transcript: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

export type EntryDto = {
  id: string;
  createdAt: string;
  summary: string[] | null;
  /** Die Zusammenfassung deckt alle fertig transkribierten Aufnahmen ab */
  summaryReady: boolean;
  summaryFailed: boolean;
  /** Es läuft noch Verarbeitung, die Ansicht soll weiter nachfragen */
  pending: boolean;
  recordings: RecordingDto[];
};

export function toEntryDto(entry: EntryWithRecordings): EntryDto {
  const doneCount = entry.recordings.filter((r) => r.status === "done").length;
  const working = entry.recordings.some((r) => r.status === "uploaded" || r.status === "transcribing");
  const summaryReady =
    entry.summaryStatus === "done" && doneCount > 0 && entry.summaryRecordingCount >= doneCount;
  const summaryFailed = entry.summaryStatus === "failed" && !working;

  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    summary: entry.summary,
    summaryReady,
    summaryFailed,
    pending: working || (doneCount > 0 && !summaryReady && !summaryFailed),
    recordings: entry.recordings.map((r) => ({
      id: r.id,
      position: r.position,
      status: r.status,
      transcript: r.transcript,
      durationSeconds: r.durationSeconds,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export function listEntries(userId: string): Promise<EntryWithRecordings[]> {
  return db.query.entries.findMany({
    where: eq(entries.userId, userId),
    orderBy: desc(entries.createdAt),
    with: { recordings: { orderBy: asc(recordings.position) } },
  });
}

/** Liefert den Eintrag nur, wenn er dem Nutzer gehört oder der Nutzer Admin ist. */
export async function getAccessibleEntry(entryId: string, user: User) {
  const entry = await db.query.entries.findFirst({
    where: eq(entries.id, entryId),
    with: { recordings: { orderBy: asc(recordings.position) } },
  });
  if (!entry) return null;
  if (entry.userId !== user.id && user.role !== "admin") return null;
  return entry;
}

export async function getAccessibleRecording(recordingId: string, user: User) {
  const recording = await db.query.recordings.findFirst({
    where: eq(recordings.id, recordingId),
    with: { entry: true },
  });
  if (!recording) return null;
  if (recording.entry.userId !== user.id && user.role !== "admin") return null;
  return recording;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
