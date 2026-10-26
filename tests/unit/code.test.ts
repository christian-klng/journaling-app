import { describe, expect, it } from "vitest";
import {
  CodePartsSchema,
  codeStemFromParts,
  findDuplicateCodes,
  formatCode,
  parseCodeStem,
  parseGroupAssignments,
  pickBalancedGroup,
} from "@/lib/study/code";

describe("Persönlicher Code", () => {
  it("setzt den Code aus den drei Angaben zusammen", () => {
    const parts = CodePartsSchema.parse({ mother: " ka", month: "03", birthplace: "Be" });
    expect(codeStemFromParts(parts)).toBe("KA-03-BE");
  });

  it("erlaubt Umlaute", () => {
    const parts = CodePartsSchema.parse({ mother: "öz", month: "11", birthplace: "Mü" });
    expect(codeStemFromParts(parts)).toBe("ÖZ-11-MÜ");
  });

  it("lehnt falsche Angaben ab", () => {
    expect(CodePartsSchema.safeParse({ mother: "K", month: "03", birthplace: "BE" }).success).toBe(false);
    expect(CodePartsSchema.safeParse({ mother: "K1", month: "03", birthplace: "BE" }).success).toBe(false);
    expect(CodePartsSchema.safeParse({ mother: "KA", month: "13", birthplace: "BE" }).success).toBe(false);
    expect(CodePartsSchema.safeParse({ mother: "KA", month: "3", birthplace: "BE" }).success).toBe(false);
  });

  it("zeigt eine fehlende Gruppe als Fragezeichen", () => {
    expect(formatCode("KA-03-BE", "A")).toBe("KA-03-BE-A");
    expect(formatCode("KA-03-BE", null)).toBe("KA-03-BE-?");
    expect(formatCode(null, "A")).toBeNull();
  });

  it("prüft einen korrigierten Code-Anfang", () => {
    expect(parseCodeStem(" ka-03-be ")).toBe("KA-03-BE");
    expect(parseCodeStem("KA-3-BE")).toBeNull();
    expect(parseCodeStem("KA-03-BE-A")).toBeNull();
  });
});

describe("Doppelte Codes", () => {
  const person = (id: string, codeStem: string | null, groupLetter: string | null) => ({
    id,
    displayName: id,
    codeStem,
    groupLetter,
  });

  it("findet gleiche Codes in derselben Gruppe", () => {
    const result = findDuplicateCodes([person("a", "KA-03-BE", "A"), person("b", "KA-03-BE", "A")]);
    expect(result).toHaveLength(1);
    expect(result[0].people.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("warnt auch, solange eine Gruppe fehlt", () => {
    expect(findDuplicateCodes([person("a", "KA-03-BE", null), person("b", "KA-03-BE", "B")])).toHaveLength(1);
  });

  it("unterscheidet Codes in verschiedenen Gruppen", () => {
    expect(findDuplicateCodes([person("a", "KA-03-BE", "A"), person("b", "KA-03-BE", "B")])).toEqual([]);
    expect(findDuplicateCodes([person("a", null, null), person("b", null, null)])).toEqual([]);
  });
});

describe("Sammelzuweisung", () => {
  it("liest verschiedene Schreibweisen", () => {
    const { assignments, invalid } = parseGroupAssignments("KA-03-BE A\nmi-11-hh-b\n\nAN-01-MÜ;A\nXY-07-KÖ, B");
    expect(invalid).toEqual([]);
    expect(assignments.map((a) => `${a.stem}:${a.letter}`)).toEqual([
      "KA-03-BE:A",
      "MI-11-HH:B",
      "AN-01-MÜ:A",
      "XY-07-KÖ:B",
    ]);
  });

  it("meldet unlesbare Zeilen mit Zeilennummer", () => {
    const { invalid } = parseGroupAssignments("KA-03-BE A\nMax Mustermann\nKA-3-BE A");
    expect(invalid.map((i) => i.line)).toEqual([2, 3]);
  });
});

describe("Zufällige Zuordnung", () => {
  const groups = [
    { id: "A", members: 3 },
    { id: "B", members: 2 },
    { id: "C", members: 2 },
  ];

  it("lost nur unter den kleinsten Gruppen", () => {
    expect(pickBalancedGroup(groups, () => 0)?.id).toBe("B");
    expect(pickBalancedGroup(groups, () => 0.99)?.id).toBe("C");
  });

  it("hält die Gruppen bei jeder Zahl von Gruppen gleich groß", () => {
    const five = ["A", "B", "C", "D", "E"].map((id) => ({ id, members: 0 }));
    for (let i = 0; i < 23; i++) pickBalancedGroup(five)!.members++;
    expect(five.map((g) => g.members).sort()).toEqual([4, 4, 5, 5, 5]);
  });

  it("gibt ohne Gruppen nichts zurück", () => {
    expect(pickBalancedGroup([])).toBeNull();
  });
});
