import { describe, expect, it } from "vitest";
import { toEntryDto, type EntryWithRecordings } from "@/lib/entries";

type RecordingStatus = EntryWithRecordings["recordings"][number]["status"];

function entry(
  statuses: RecordingStatus[],
  summary: Partial<Pick<EntryWithRecordings, "summaryStatus" | "summaryRecordingCount" | "summary">> = {},
): EntryWithRecordings {
  const now = new Date("2026-09-22T10:00:00Z");
  return {
    id: "e1",
    userId: "u1",
    summary: null,
    summaryStatus: "pending",
    summaryRecordingCount: 0,
    summaryAttempts: 0,
    summaryError: null,
    createdAt: now,
    updatedAt: now,
    ...summary,
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
  it("wartet, solange transkribiert wird", () => {
    const dto = toEntryDto(entry(["transcribing"]));
    expect(dto).toMatchObject({ pending: true, summaryReady: false });
  });

  it("wartet nach dem Transkript auf die Zusammenfassung", () => {
    const dto = toEntryDto(entry(["done"]));
    expect(dto).toMatchObject({ pending: true, summaryReady: false });
  });

  it("ist fertig, wenn die Zusammenfassung alle Aufnahmen abdeckt", () => {
    const dto = toEntryDto(
      entry(["done", "done"], { summaryStatus: "done", summaryRecordingCount: 2, summary: ["a", "b", "c"] }),
    );
    expect(dto).toMatchObject({ pending: false, summaryReady: true });
  });

  it("gilt als veraltet, wenn eine weitere Aufnahme dazugekommen ist", () => {
    const dto = toEntryDto(
      entry(["done", "done"], { summaryStatus: "done", summaryRecordingCount: 1, summary: ["a", "b", "c"] }),
    );
    expect(dto).toMatchObject({ pending: true, summaryReady: false });
  });

  it("hört auf zu warten, wenn alles fehlgeschlagen ist", () => {
    expect(toEntryDto(entry(["failed"])).pending).toBe(false);
    expect(toEntryDto(entry(["done"], { summaryStatus: "failed" }))).toMatchObject({
      pending: false,
      summaryFailed: true,
    });
  });

  it("gibt keine Speicherpfade oder Fehlertexte heraus", () => {
    const dto = toEntryDto(entry(["done"]));
    expect(Object.keys(dto.recordings[0]).sort()).toEqual(
      ["createdAt", "durationSeconds", "id", "position", "status", "transcript"].sort(),
    );
  });
});
