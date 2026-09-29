import { describe, expect, it } from "vitest";
import { generateName, generateUniqueName, NAME_COMBINATIONS } from "@/lib/names";

const sequence = (values: number[]) => {
  let i = 0;
  return (max: number) => values[i++ % values.length] % max;
};

describe("Fantasienamen", () => {
  it("passt die Endung des Adjektivs an das Geschlecht des Tiers an", () => {
    const names = new Set<string>();
    for (let a = 0; a < 40; a++) for (let n = 0; n < 40; n++) names.add(generateName(sequence([a, n])));

    expect(names.size).toBe(NAME_COMBINATIONS);
    for (const name of names) {
      const [adjective, animal] = name.split(" ");
      if (["Otter", "Fuchs", "Storch"].includes(animal)) expect(adjective).toMatch(/er$/);
      if (["Eule", "Robbe", "Meise"].includes(animal)) expect(adjective).toMatch(/e$/);
      if (["Reh", "Lama", "Wiesel"].includes(animal)) expect(adjective).toMatch(/es$/);
    }
    expect(names).toContain("Mutiger Otter");
    expect(names).toContain("Mutige Eule");
    expect(names).toContain("Mutiges Reh");
  });

  it("überspringt vergebene Namen", async () => {
    const taken = new Set(["Mutiger Otter"]);
    const name = await generateUniqueName(async (n) => taken.has(n), sequence([0, 0, 1, 1]));
    expect(name).toBe("Flinker Fuchs");
  });

  it("hängt eine Zahl an, wenn alle Versuche belegt sind", async () => {
    const name = await generateUniqueName(async (n) => !/\d/.test(n), sequence([0]));
    expect(name).toMatch(/^Mutiger Otter \d+$/);
  });
});
