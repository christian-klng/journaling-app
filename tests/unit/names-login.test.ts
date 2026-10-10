import { describe, expect, it } from "vitest";
import { isGeneratedName, normalizeLoginName } from "@/lib/names";

describe("Anmeldung mit dem Fantasienamen", () => {
  it("verzeiht Groß- und Kleinschreibung, Umlaute und Leerzeichen", () => {
    const key = normalizeLoginName("Fröhliche Möwe");
    expect(key).toBe("froehliche moewe");
    expect(normalizeLoginName("  froehliche   MOEWE ")).toBe(key);
    expect(normalizeLoginName("Fröhliche-Möwe")).toBe(key);
  });

  it("erkennt Namen aus dem Generator", () => {
    expect(isGeneratedName("Mutiger Otter")).toBe(true);
    expect(isGeneratedName("Fröhliche Möwe 42")).toBe(true);
  });

  it("lehnt andere Namen ab", () => {
    expect(isGeneratedName("Max Mustermann")).toBe(false);
    // Falsche Endung für das Geschlecht des Tiers
    expect(isGeneratedName("Mutige Otter")).toBe(false);
    expect(isGeneratedName("Mutiger Otter 7")).toBe(false);
    expect(isGeneratedName("Mutiger Otter 042")).toBe(false);
    expect(isGeneratedName("Mutiger Otter 1000")).toBe(false);
    expect(isGeneratedName("mutiger otter")).toBe(false);
  });
});
