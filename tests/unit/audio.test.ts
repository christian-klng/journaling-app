import { describe, expect, it } from "vitest";
import { parseDurationSeconds } from "@/lib/audio";

describe("parseDurationSeconds", () => {
  it("nimmt die letzte Fortschrittszeile", () => {
    const output = "size= 10kB time=00:00:03.20 bitrate=64k\nsize= 60kB time=00:01:23.45 bitrate=64k";
    expect(parseDurationSeconds(output)).toBe(83);
  });

  it("liefert null ohne Zeitangabe", () => {
    expect(parseDurationSeconds("Conversion failed")).toBeNull();
  });
});
