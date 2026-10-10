import { describe, expect, it } from "vitest";
import { toEntryDto, type EntryWithRecordings } from "@/lib/entries";

type RecordingStatus = EntryWithRecordings["recordings"][number]["status"];

function entry(statuses: RecordingStatus[]): EntryWithRecordings {
  const now = new Date("2026-09-22T10:00:00Z");
  return {
    id: "e1",
    userId: "u1",
    createdAt: now,
    updatedAt: now,
    recordings: statuses.map((status, index) => ({
      id: `r${index}`,
      entryId: "e1",
      position: index + 1,
      storageKeyOriginal: "k",
      storageKeyMp3: null,
      mimeType: "audio/webm",
      durationSeconds: 5,
      sizeBytes: 1,
      status,
      transcript: status === "done" ? "Text" : null,
      error: null,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

describe("toEntryDto", () => {
  it("wartet, solange eine Aufnahme hochgeladen oder transkribiert wird", () => {
    expect(toEntryDto(entry(["uploaded"])).pending).toBe(true);
    expect(toEntryDto(entry(["done", "transcribing"])).pending).toBe(true);
  });

  it("ist fertig, wenn alle Transkripte da sind", () => {
    expect(toEntryDto(entry(["done", "done"])).pending).toBe(false);
  });

  it("hört auf zu warten, wenn die Transkription fehlgeschlagen ist", () => {
    expect(toEntryDto(entry(["done", "failed"])).pending).toBe(false);
  });

  it("gibt keine Speicherpfade oder Fehlertexte heraus", () => {
    const dto = toEntryDto(entry(["done"]));
    expect(Object.keys(dto.recordings[0]).sort()).toEqual(
      ["createdAt", "durationSeconds", "id", "position", "status", "transcript"].sort(),
    );
  });
});
