import { describe, expect, it } from "vitest";
import { buildSummaryInput, parseSummary } from "@/lib/summary";

describe("parseSummary", () => {
  it("liest sauberes JSON", () => {
    expect(parseSummary('{"stichpunkte": ["a", "b", "c"]}')).toEqual(["a", "b", "c"]);
  });

  it("findet JSON in Markdown und zwischen Text", () => {
    const raw = 'Gerne!\n```json\n{"stichpunkte": [" a ", "b", "c"]}\n```\nViel Erfolg.';
    expect(parseSummary(raw)).toEqual(["a", "b", "c"]);
  });

  it.each([
    ['{"stichpunkte": ["a", "b"]}', "zu wenige"],
    ['{"stichpunkte": ["a", "b", "c", "d"]}', "zu viele"],
    ['{"stichpunkte": ["a", "", "c"]}', "leerer Punkt"],
    ['{"punkte": ["a", "b", "c"]}', "falscher Schlüssel"],
    ["Hier sind drei Punkte: a, b, c", "kein JSON"],
    ['{"stichpunkte": ["a", "b", "c"', "abgeschnitten"],
  ])("lehnt ab: %s (%s)", (raw) => {
    expect(parseSummary(raw)).toBeNull();
  });
});

describe("buildSummaryInput", () => {
  it("gibt eine einzelne Aufnahme unverändert weiter", () => {
    expect(buildSummaryInput(["Hallo"])).toBe("Hallo");
  });

  it("nummeriert mehrere Aufnahmen in ihrer Reihenfolge", () => {
    expect(buildSummaryInput(["eins", "zwei"])).toBe("Aufnahme 1:\neins\n\nAufnahme 2:\nzwei");
  });
});
