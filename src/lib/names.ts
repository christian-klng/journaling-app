// Fantasienamen aus Adjektiv + Tier, grammatisch passend ("Mutiger Otter", "Mutige Eule", "Mutiges Reh")

type Gender = "m" | "f" | "n";

// Stämme, an die -er / -e / -es angehängt wird
const ADJECTIVES = [
  "Mutig", "Flink", "Klug", "Heiter", "Munter", "Sanft", "Wach", "Kühn", "Froh", "Still",
  "Wild", "Bunt", "Hell", "Stark", "Tapfer", "Wacker", "Freundlich", "Fröhlich", "Neugierig",
  "Gelassen", "Geduldig", "Lebhaft", "Findig", "Pfiffig", "Sonnig", "Golden", "Silbern",
  "Schnell", "Ruhig", "Achtsam", "Beherzt", "Emsig",
] as const;

const ANIMALS: ReadonlyArray<readonly [string, Gender]> = [
  ["Otter", "m"], ["Fuchs", "m"], ["Dachs", "m"], ["Luchs", "m"], ["Falke", "m"], ["Rabe", "m"],
  ["Biber", "m"], ["Igel", "m"], ["Kranich", "m"], ["Wolf", "m"], ["Hirsch", "m"], ["Panda", "m"],
  ["Pinguin", "m"], ["Delfin", "m"], ["Specht", "m"], ["Marder", "m"], ["Storch", "m"],
  ["Eule", "f"], ["Libelle", "f"], ["Möwe", "f"], ["Robbe", "f"], ["Amsel", "f"], ["Hummel", "f"],
  ["Schwalbe", "f"], ["Gazelle", "f"], ["Lerche", "f"], ["Forelle", "f"], ["Meise", "f"],
  ["Reh", "n"], ["Eichhörnchen", "n"], ["Murmeltier", "n"], ["Chamäleon", "n"], ["Lama", "n"],
  ["Känguru", "n"], ["Seepferdchen", "n"], ["Rotkehlchen", "n"], ["Wiesel", "n"], ["Alpaka", "n"],
];

const ENDINGS: Record<Gender, string> = { m: "er", f: "e", n: "es" };

export type Random = (maxExclusive: number) => number;

export function generateName(random: Random): string {
  const adjective = ADJECTIVES[random(ADJECTIVES.length)];
  const [animal, gender] = ANIMALS[random(ANIMALS.length)];
  return `${adjective}${ENDINGS[gender]} ${animal}`;
}

/**
 * Liefert einen noch nicht vergebenen Namen. Nach mehreren Kollisionen wird eine Zahl
 * angehängt, damit die Suche auch bei vielen Nutzern sicher endet.
 */
export async function generateUniqueName(
  isTaken: (name: string) => Promise<boolean>,
  random: Random,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = generateName(random);
    if (!(await isTaken(name))) return name;
  }
  for (;;) {
    const name = `${generateName(random)} ${10 + random(990)}`;
    if (!(await isTaken(name))) return name;
  }
}

export const NAME_COMBINATIONS = ADJECTIVES.length * ANIMALS.length;

const BASE_NAMES = new Set(
  ADJECTIVES.flatMap((adjective) =>
    ANIMALS.map(([animal, gender]) => `${adjective}${ENDINGS[gender]} ${animal}`),
  ),
);

/**
 * Prüft, ob ein Name aus dem Generator stammen kann. Die Registrierung schlägt den Namen
 * vorab vor; so kann niemand stattdessen seinen echten Namen einschmuggeln.
 */
export function isGeneratedName(name: string) {
  const match = /^(\S+ \S+)(?: (\d+))?$/.exec(name);
  if (!match || !BASE_NAMES.has(match[1])) return false;
  if (match[2] === undefined) return true;
  const number = Number(match[2]);
  return String(number) === match[2] && number >= 10 && number < 1000;
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** Schlüssel für die Anmeldung: "fröhliche  Möwe" und "Froehliche Moewe" ergeben dasselbe. */
export function normalizeLoginName(name: string) {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char])
    .replace(/[\s-]+/g, " ")
    .trim();
}
