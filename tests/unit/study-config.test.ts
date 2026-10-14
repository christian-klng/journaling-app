import { describe, expect, it } from "vitest";
import {
  formatWindow,
  LetterSchema,
  parseStudyFile,
  QuestionnaireSchema,
  STUDY_FILE_FORMAT,
  StudyPeriodSchema,
} from "@/lib/study/config";

const file = (groups: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: STUDY_FILE_FORMAT, version: 1, groups, ...extra });

describe("Zeitfenster", () => {
  it("kürzt Wochentage ab", () => {
    expect(formatWindow(1, 3)).toBe("Mo–Mi");
    expect(formatWindow(5, 5)).toBe("Fr");
    expect(formatWindow(1, 7)).toBe("jeden Tag");
  });

  it("muss am selben oder einem späteren Tag enden", () => {
    const base = { name: "Check-Out", intro: "" };
    expect(QuestionnaireSchema.safeParse({ ...base, opensOn: "5", closesOn: "7" }).success).toBe(true);
    expect(QuestionnaireSchema.safeParse({ ...base, opensOn: "5", closesOn: "1" }).success).toBe(false);
    expect(QuestionnaireSchema.safeParse({ ...base, opensOn: "0", closesOn: "1" }).success).toBe(false);
  });
});

describe("Gruppen und Studienzeitraum", () => {
  it("erlaubt genau einen Buchstaben und macht ihn groß", () => {
    expect(LetterSchema.parse(" a ")).toBe("A");
    expect(LetterSchema.safeParse("AB").success).toBe(false);
    expect(LetterSchema.safeParse("1").success).toBe(false);
  });

  it("verlangt ein Ende nach dem Start", () => {
    expect(StudyPeriodSchema.safeParse({ start: "2026-10-19", end: "2027-01-31" }).success).toBe(true);
    expect(StudyPeriodSchema.safeParse({ start: "2026-10-19", end: "2026-10-01" }).success).toBe(false);
  });
});

describe("Importdatei", () => {
  it("liest eine gültige Datei und ergänzt Standardwerte", () => {
    const result = parseStudyFile(
      file([
        {
          letter: "a",
          questionnaires: [
            {
              name: "Check-In",
              opensOn: 1,
              closesOn: 3,
              items: [{ type: "smiley", text: "Wie startest du in die Woche?" }],
            },
          ],
        },
      ]),
    );
    expect("data" in result && result.data.groups[0]).toMatchObject({
      letter: "A",
      label: "",
      questionnaires: [{ intro: "", items: [{ required: true, minLabel: "", maxLabel: "" }] }],
    });
  });

  it("meldet kaputtes JSON und falsche Formate verständlich", () => {
    expect(parseStudyFile("{")).toEqual({ error: "Die Datei ist kein gültiges JSON." });
    expect(parseStudyFile(JSON.stringify({ format: "anders", version: 1, groups: [] }))).toHaveProperty("error");
    const unknownType = parseStudyFile(
      file([{ letter: "A", questionnaires: [{ name: "X", opensOn: 1, closesOn: 1, items: [{ type: "video", text: "?" }] }] }]),
    );
    expect("error" in unknownType && unknownType.error).toContain("groups.0.questionnaires.0.items.0.type");
  });

  it("lehnt doppelte Buchstaben ab", () => {
    const result = parseStudyFile(file([{ letter: "A", questionnaires: [] }, { letter: "a", questionnaires: [] }]));
    expect(result).toHaveProperty("error");
  });
});
