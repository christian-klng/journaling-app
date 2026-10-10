import { describe, expect, it } from "vitest";
import { entryFolder, recordingBaseName, safeName, toCsv } from "@/lib/export";

describe("Export-Pfade", () => {
  it("baut den Ordner aus Team, Name und Datum", () => {
    const folder = entryFolder({
      teamName: "Team Alpha",
      displayName: "Mutiger Otter",
      entryNumber: 3,
      createdAt: new Date("2026-09-22T10:00:00Z"),
    });
    expect(folder).toBe("Team-Alpha/Mutiger-Otter/2026-09-22_eintrag-03");
  });

  it("nutzt das Datum in deutscher Zeit", () => {
    const folder = entryFolder({
      teamName: null,
      displayName: "Kluge Eule",
      entryNumber: 1,
      // 23:30 UTC ist in Berlin schon der nächste Tag
      createdAt: new Date("2026-09-22T23:30:00Z"),
    });
    expect(folder).toBe("Ohne-Team/Kluge-Eule/2026-09-23_eintrag-01");
  });

  it("entfernt Zeichen, die aus dem Ordner ausbrechen könnten", () => {
    expect(safeName("../../etc/passwd")).toBe("etcpasswd");
    expect(safeName("Team: Grün & Blau")).toBe("Team-Grün-Blau");
    expect(safeName("   ")).toBe("unbenannt");
  });

  it("nummeriert Aufnahmen zweistellig", () => {
    expect(recordingBaseName(2)).toBe("aufnahme-02");
  });
});

describe("Export-Inhalte", () => {
  it("maskiert Anführungszeichen und entschärft Formeln", () => {
    const csv = toCsv(["A", "B"], [['Er sagte "Hallo"', "=SUMME(A1)"]]);
    expect(csv).toBe('﻿"A";"B"\r\n"Er sagte ""Hallo""";"\'=SUMME(A1)"\r\n');
  });
});
