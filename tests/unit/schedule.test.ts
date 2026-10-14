import { describe, expect, it } from "vitest";
import {
  addDays,
  berlinDate,
  buildSlots,
  formatRange,
  isoWeekday,
  mondayOf,
  weekNumber,
} from "@/lib/study/schedule";

const checkIn = { id: "in", opensOn: 1, closesOn: 3 };
const checkOut = { id: "out", opensOn: 5, closesOn: 7 };

describe("Kalendertage", () => {
  it("nimmt das Datum in deutscher Zeit", () => {
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(berlinDate(new Date("2026-10-18T23:30:00Z"))).toBe("2026-10-19");
    expect(berlinDate(new Date("2026-10-18T21:30:00Z"))).toBe("2026-10-18");
  });

  it("rechnet über die Zeitumstellung hinweg ohne Versatz", () => {
    // In der Nacht zum 25.10.2026 endet die Sommerzeit
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-19", 7)).toBe("2026-10-26");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });

  it("kennt Wochentage und Wochennummern", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    expect(weekNumber("2026-10-19", "2026-10-21")).toBe(1);
    expect(weekNumber("2026-11-02", "2026-10-21")).toBe(3);
  });

  it("formatiert Zeitfenster", () => {
    expect(formatRange("2026-10-19", "2026-10-21")).toBe("Mo 19.10.–Mi 21.10.");
    expect(formatRange("2026-10-23", "2026-10-23")).toBe("Fr 23.10.");
  });
});

describe("Termine", () => {
  const base = { studyStart: "2026-10-19", studyEnd: "2026-12-20", questionnaires: [checkIn, checkOut] };

  it("gibt vor dem Start nichts aus", () => {
    expect(buildSlots({ ...base, today: "2026-10-12" })).toEqual([]);
  });

  it("unterscheidet offen, kommend und vorbei", () => {
    // Dienstag der zweiten Woche
    const slots = buildSlots({ ...base, today: "2026-10-27" });
    expect(slots.map((s) => `${s.weekNumber}:${s.questionnaire.id}:${s.state}`)).toEqual([
      "1:in:past",
      "1:out:past",
      "2:in:open",
      "2:out:upcoming",
    ]);
    expect(slots[2]).toMatchObject({ from: "2026-10-26", to: "2026-10-28" });
  });

  it("zählt den letzten Tag des Zeitfensters noch mit", () => {
    const [slot] = buildSlots({ ...base, today: "2026-10-21", questionnaires: [checkIn] });
    expect(slot.state).toBe("open");
  });

  it("lässt Zeitfenster vor dem Start und nach dem Ende weg", () => {
    // Start an einem Donnerstag: der Check-In der ersten Woche ist schon vorbei
    const slots = buildSlots({ ...base, studyStart: "2026-10-22", today: "2026-10-23" });
    expect(slots.map((s) => s.questionnaire.id)).toEqual(["out"]);

    // Ende an einem Mittwoch: der letzte Check-Out fällt weg
    const end = buildSlots({ ...base, studyEnd: "2026-10-28", today: "2026-11-30" });
    expect(end.map((s) => `${s.weekNumber}:${s.questionnaire.id}`)).toEqual(["1:in", "1:out", "2:in"]);
    expect(end.every((s) => s.state === "past")).toBe(true);
  });
});
