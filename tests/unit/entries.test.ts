import { describe, expect, it } from "vitest";
import { toEntryDto, type EntryWithRecordings } from "@/lib/entries";

type RecordingStatus = EntryWithRecordings["recordings"][number]["status"];
const now = new Date("2026-10-27T10:00:00Z");

const item = (id: string, type: "smiley" | "scale" | "audio", position: number) => ({
  id,
  questionnaireId: "q",
  type,
  text: `Aktueller Text ${id}`,
  required: true,
  minLabel: "",
  maxLabel: "",
  position,
  archivedAt: null,
  createdAt: now,
});

const recording = (index: number, status: RecordingStatus, itemId: string | null = null) => ({
  id: `r${index}`,
  entryId: "e1",
  position: index + 1,
  itemId,
  itemText: itemId ? `Gesehener Text ${itemId}` : null,
  storageKeyOriginal: "k",
  storageKeyMp3: null,
  mimeType: "audio/webm",
  durationSeconds: 5,
  sizeBytes: 1,
  status,
  transcript: status === "done" ? "Text" : null,
  error: null,
  attempts: 1,
  audioDeletedAt: null,
  createdAt: now,
  updatedAt: now,
});

function entry(overrides: Partial<EntryWithRecordings> = {}): EntryWithRecordings {
  return {
    id: "e1",
    userId: "u1",
    questionnaireId: "q",
    weekStart: "2026-10-26",
    studyGroupId: "g",
    late: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    recordings: [],
    answers: [],
    questionnaire: { name: "Check-In", items: [item("smiley", "smiley", 1), item("audio", "audio", 2), item("scale", "scale", 3)] },
    studyGroup: { id: "g", letter: "A", label: "intern", createdAt: now },
    ...overrides,
  };
}

const answer = (itemId: string, itemType: "smiley" | "scale", value: number) => ({
  id: `a-${itemId}`,
  entryId: "e1",
  itemId,
  itemType,
  itemText: `Gesehener Text ${itemId}`,
  value,
  createdAt: now,
  updatedAt: now,
});

describe("toEntryDto", () => {
  it("ordnet Antworten und Aufnahmen ihren Fragen in der Reihenfolge der Abfrage zu", () => {
    const dto = toEntryDto(
      entry({
        answers: [answer("scale", "scale", 7), answer("smiley", "smiley", 4)],
        recordings: [recording(0, "done", "audio"), recording(1, "done", "audio")],
      }),
      "2026-10-19",
    );
    expect(dto.parts.map((p) => [p.itemId, p.value, p.recordings.length])).toEqual([
      ["smiley", 4, 0],
      ["audio", null, 2],
      ["scale", 7, 0],
    ]);
    expect(dto).toMatchObject({ questionnaireName: "Check-In", weekNumber: 2, groupLetter: "A" });
  });

  it("zeigt den Text, den die Person beim Antworten gesehen hat", () => {
    const dto = toEntryDto(entry({ answers: [answer("smiley", "smiley", 3)], recordings: [recording(0, "done", "audio")] }));
    expect(dto.parts.map((p) => p.text)).toEqual(["Gesehener Text smiley", "Gesehener Text audio"]);
  });

  it("wartet, solange eine Aufnahme hochgeladen oder transkribiert wird", () => {
    expect(toEntryDto(entry({ recordings: [recording(0, "uploaded", "audio")] })).pending).toBe(true);
    expect(toEntryDto(entry({ recordings: [recording(0, "done", "audio"), recording(1, "transcribing", "audio")] })).pending).toBe(true);
    expect(toEntryDto(entry({ recordings: [recording(0, "done", "audio"), recording(1, "failed", "audio")] })).pending).toBe(false);
  });

  it("zeigt freie Einträge aus der Zeit vor den Abfragen weiter an", () => {
    const dto = toEntryDto(entry({ questionnaireId: null, weekStart: null, questionnaire: null, recordings: [recording(0, "done")] }));
    expect(dto).toMatchObject({ questionnaireName: null, weekNumber: null, parts: [] });
    expect(dto.recordings).toHaveLength(1);
  });

  it("gibt keine Speicherpfade oder Fehlertexte heraus", () => {
    const dto = toEntryDto(entry({ recordings: [recording(0, "done", "audio")] }));
    expect(Object.keys(dto.parts[0].recordings[0]).sort()).toEqual(
      ["audioDeleted", "createdAt", "durationSeconds", "id", "position", "status", "transcript"].sort(),
    );
  });
});
