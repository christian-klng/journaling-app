import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  entries,
  questionnaireItems,
  recordings,
  type Answer,
  type Entry,
  type ItemType,
  type QuestionnaireItem,
  type Recording,
  type StudyGroup,
  type User,
} from "@/lib/db/schema";
import { weekNumber } from "@/lib/study/schedule";

export type EntryWithRecordings = Entry & {
  recordings: Recording[];
  answers: Answer[];
  questionnaire: { name: string; items: QuestionnaireItem[] } | null;
  studyGroup: StudyGroup | null;
};

export type RecordingDto = {
  id: string;
  position: number;
  status: Recording["status"];
  transcript: string | null;
  /** Audiodatei nach dem Ende der Studie gelöscht */
  audioDeleted: boolean;
  durationSeconds: number | null;
  createdAt: string;
};

/** Eine Frage der Abfrage mit der Antwort darauf: ein Skalenwert oder Aufnahmen. */
export type EntryPartDto = {
  itemId: string;
  type: ItemType;
  /** Text, wie die Person ihn beim Antworten gesehen hat */
  text: string;
  value: number | null;
  recordings: RecordingDto[];
};

export type EntryDto = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  late: boolean;
  /** Leer bei freien Einträgen aus der Zeit vor den Abfragen */
  questionnaireName: string | null;
  weekStart: string | null;
  weekNumber: number | null;
  groupLetter: string | null;
  /** Es wird noch transkribiert, die Ansicht soll weiter nachfragen */
  pending: boolean;
  parts: EntryPartDto[];
  /** Aufnahmen ohne Frage, nur bei freien Einträgen */
  recordings: RecordingDto[];
};

const toRecordingDto = (r: Recording): RecordingDto => ({
  id: r.id,
  position: r.position,
  status: r.status,
  transcript: r.transcript,
  audioDeleted: r.audioDeletedAt !== null,
  durationSeconds: r.durationSeconds,
  createdAt: r.createdAt.toISOString(),
});

export function toEntryDto(entry: EntryWithRecordings, studyStart: string | null = null): EntryDto {
  const items = entry.questionnaire?.items ?? [];
  const position = (itemId: string) => items.find((i) => i.id === itemId)?.position ?? Number.MAX_SAFE_INTEGER;

  // Antworten bestimmen Text und Typ; die Reihenfolge folgt der aktuellen Abfrage
  const parts = new Map<string, EntryPartDto>();
  for (const answer of entry.answers) {
    parts.set(answer.itemId, {
      itemId: answer.itemId,
      type: answer.itemType,
      text: answer.itemText,
      value: answer.value,
      recordings: [],
    });
  }
  for (const recording of entry.recordings) {
    if (!recording.itemId) continue;
    const part = parts.get(recording.itemId) ?? {
      itemId: recording.itemId,
      type: "audio" as const,
      text: recording.itemText ?? "",
      value: null,
      recordings: [],
    };
    part.recordings.push(toRecordingDto(recording));
    parts.set(recording.itemId, part);
  }

  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    completedAt: entry.completedAt?.toISOString() ?? null,
    late: entry.late,
    questionnaireName: entry.questionnaire?.name ?? null,
    weekStart: entry.weekStart,
    weekNumber: entry.weekStart && studyStart ? weekNumber(entry.weekStart, studyStart) : null,
    groupLetter: entry.studyGroup?.letter ?? null,
    pending: entry.recordings.some((r) => r.status === "uploaded" || r.status === "transcribing"),
    parts: [...parts.values()].sort((a, b) => position(a.itemId) - position(b.itemId)),
    recordings: entry.recordings.filter((r) => !r.itemId).map(toRecordingDto),
  };
}

const entryRelations = {
  recordings: { orderBy: asc(recordings.position) },
  answers: true,
  questionnaire: { columns: { name: true }, with: { items: { orderBy: asc(questionnaireItems.position) } } },
  studyGroup: true,
} as const;

export function listEntries(userId: string): Promise<EntryWithRecordings[]> {
  return db.query.entries.findMany({
    where: eq(entries.userId, userId),
    orderBy: desc(entries.createdAt),
    with: entryRelations,
  });
}

/** Liefert den Eintrag nur, wenn er dem Nutzer gehört oder der Nutzer Admin ist. */
export async function getAccessibleEntry(entryId: string, user: User) {
  const entry = await db.query.entries.findFirst({
    where: eq(entries.id, entryId),
    with: entryRelations,
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
