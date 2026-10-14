import { describe, expect, it } from "vitest";
import { buildParticipation } from "@/lib/study/participation";

const questionnaires = [
  { id: "a-in", groupId: "A", name: "Check-In", opensOn: 1, closesOn: 3, position: 1 },
  { id: "a-out", groupId: "A", name: "Check-Out", opensOn: 5, closesOn: 7, position: 2 },
  { id: "b-in", groupId: "B", name: "Check-In", opensOn: 1, closesOn: 3, position: 1 },
  { id: "b-out", groupId: "B", name: "Check-Out", opensOn: 5, closesOn: 7, position: 2 },
];

const entry = (userId: string, questionnaireId: string, weekStart: string, completed: boolean, late = false) => ({
  userId,
  questionnaireId,
  weekStart,
  completedAt: completed ? new Date() : null,
  late,
});

describe("Teilnahme", () => {
  // Dienstag der zweiten Woche
  const result = buildParticipation({
    studyStart: "2026-10-19",
    studyEnd: "2026-12-20",
    today: "2026-10-27",
    questionnaires,
    people: [
      { id: "anna", studyGroupId: "A" },
      { id: "ben", studyGroupId: "B" },
      { id: "cem", studyGroupId: null },
    ],
    entries: [
      entry("anna", "a-in", "2026-10-19", true),
      entry("anna", "a-out", "2026-10-19", true, true),
      entry("anna", "a-in", "2026-10-26", false),
      entry("ben", "b-in", "2026-10-19", true),
    ],
  });

  it("fasst Abfragen beider Gruppen über den Namen zusammen", () => {
    expect(result.names).toEqual(["Check-In", "Check-Out"]);
    expect(result.weeks.map((w) => w.weekNumber)).toEqual([1, 2]);
  });

  it("unterscheidet pünktlich, nachgeholt, begonnen, verpasst, offen und kommend", () => {
    expect(result.rows[0].cells).toEqual([
      ["done", "late"],
      ["started", "upcoming"],
    ]);
    expect(result.rows[1].cells).toEqual([
      ["done", "missed"],
      ["open", "upcoming"],
    ]);
  });

  it("zeigt ohne Gruppe nichts an", () => {
    expect(result.rows[2].cells.flat().every((c) => c === "none")).toBe(true);
    expect(result.rows[2]).toMatchObject({ due: 0, completed: 0 });
  });

  it("zählt fällige und abgeschlossene Abfragen", () => {
    expect(result.rows[0]).toMatchObject({ due: 3, completed: 2 });
    expect(result.rows[1]).toMatchObject({ due: 3, completed: 1 });
  });
});
