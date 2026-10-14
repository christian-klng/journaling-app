import { describe, expect, it } from "vitest";
import {
  ANSWER_COLUMNS,
  answerRows,
  entryFolderName,
  personFolder,
  questionNumber,
  recordingBaseName,
  safeName,
  toCsv,
  type ExportEntry,
} from "@/lib/export";

describe("Export-Pfade", () => {
  it("legt Personen nach Team, Code und Name ab", () => {
    expect(personFolder({ teamName: "Team Alpha", code: "KA-03-BE-A", displayName: "Mutiger Otter" })).toBe(
      "Team-Alpha/KA-03-BE-A_Mutiger-Otter",
    );
    expect(personFolder({ teamName: null, code: "KA-03-BE-?", displayName: "Kluge Eule" })).toBe(
      "Ohne-Team/KA-03-BE-X_Kluge-Eule",
    );
    expect(personFolder({ teamName: null, code: null, displayName: "Kluge Eule" })).toBe("Ohne-Team/Kluge-Eule");
  });

  it("benennt Einträge nach Woche und Abfrage", () => {
    const createdAt = new Date("2026-09-22T23:30:00Z");
    expect(entryFolderName({ questionnaireName: "Check-In", weekNumber: 3, createdAt, freeNumber: 0 })).toBe("W03_Check-In");
    // Freie Einträge nach Datum in deutscher Zeit
    expect(entryFolderName({ questionnaireName: null, weekNumber: null, createdAt, freeNumber: 1 })).toBe("2026-09-23_frei-01");
  });

  it("entfernt Zeichen, die aus dem Ordner ausbrechen könnten", () => {
    expect(safeName("../../etc/passwd")).toBe("etcpasswd");
    expect(safeName("Team: Grün & Blau")).toBe("Team-Grün-Blau");
    expect(safeName("   ")).toBe("unbenannt");
  });

  it("nummeriert Fragen und Aufnahmen zweistellig", () => {
    expect(recordingBaseName(3, 1)).toBe("frage-03_aufnahme-01");
    expect(recordingBaseName(null, 2)).toBe("aufnahme-02");
  });
});

describe("antworten.csv", () => {
  const entry: ExportEntry = {
    code: "KA-03-BE-A",
    displayName: "Mutiger Otter",
    teamName: "Alpha",
    groupLetter: "A",
    questionnaireName: "Check-Out",
    weekNumber: 2,
    weekStart: "2026-10-26",
    late: true,
    createdAt: new Date("2026-11-02T09:00:00Z"),
    completedAt: new Date("2026-11-02T09:10:00Z"),
    // Frage 2 ist archiviert und zählt trotzdem mit
    items: [
      { id: "smiley", position: 1 },
      { id: "alt", position: 2 },
      { id: "audio", position: 5 },
      { id: "scale", position: 3 },
    ],
    answers: [
      { itemId: "scale", itemType: "scale", itemText: "Wie stressig?", value: 7 },
      { itemId: "smiley", itemType: "smiley", itemText: "Wie war die Woche?", value: 4 },
    ],
    recordings: [
      { itemId: "audio", itemText: "Was hast du geschafft?", position: 2, durationSeconds: 20, transcript: "Zweitens", file: "b.mp3" },
      { itemId: "audio", itemText: "Was hast du geschafft?", position: 1, durationSeconds: 30, transcript: "Erstens", file: "a.mp3" },
    ],
  };

  it("nummeriert Fragen nach ihrer Position in der Abfrage", () => {
    expect(questionNumber(entry.items, "scale")).toBe(3);
    expect(questionNumber(entry.items, "audio")).toBe(4);
    expect(questionNumber(entry.items, "fehlt")).toBeNull();
  });

  it("schreibt eine Zeile pro Frage in der Reihenfolge der Abfrage", () => {
    const rows = answerRows(entry);
    const column = (name: (typeof ANSWER_COLUMNS)[number]) => rows.map((row) => row[ANSWER_COLUMNS.indexOf(name)]);
    expect(rows.every((row) => row.length === ANSWER_COLUMNS.length)).toBe(true);
    expect(column("Frage-Nr")).toEqual([1, 3, 4]);
    expect(column("Wert")).toEqual([4, 7, ""]);
    expect(column("Wert (Text)")).toEqual(["eher gut", "", ""]);
    expect(column("Transkript")).toEqual(["", "", "Erstens\n\nZweitens"]);
    expect(column("Aufnahmen")).toEqual([0, 0, 2]);
    expect(column("Dauer (Sekunden)")).toEqual([0, 0, 50]);
    expect(column("Dateien")).toEqual(["", "", "a.mp3; b.mp3"]);
    expect(column("Nachgeholt")).toEqual(["ja", "ja", "ja"]);
    expect(column("Code")).toEqual(["KA-03-BE-A", "KA-03-BE-A", "KA-03-BE-A"]);
  });

  it("lässt den Abschluss bei begonnenen Einträgen leer", () => {
    const [row] = answerRows({ ...entry, completedAt: null, recordings: [] });
    expect(row[ANSWER_COLUMNS.indexOf("Abgeschlossen")]).toBe("");
  });
});

describe("CSV", () => {
  it("maskiert Anführungszeichen und entschärft Formeln", () => {
    const csv = toCsv(["A", "B"], [['Er sagte "Hallo"', "=SUMME(A1)"]]);
    expect(csv).toBe('﻿"A";"B"\r\n"Er sagte ""Hallo""";"\'=SUMME(A1)"\r\n');
  });
});
