import * as z from "zod";

// Persönlicher Code aus dem Fragebogen der Studie, z. B. KA-03-BE-A:
// (1) erste zwei Buchstaben des Vornamens der Mutter, (2) Geburtsmonat zweistellig,
// (3) erste zwei Buchstaben des Geburtsortes, (4) Buchstabe der Gruppe.
// Gespeichert wird nur der Teil ohne Gruppe ("KA-03-BE"), die Gruppe steht am Konto.

const twoLetters = (message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.normalize("NFC").toUpperCase())
    .pipe(z.string().regex(/^\p{Lu}{2}$/u, message));

export const CodePartsSchema = z.object({
  mother: twoLetters("Bitte gib die ersten beiden Buchstaben des Vornamens deiner Mutter ein."),
  month: z.string().regex(/^(0[1-9]|1[0-2])$/, "Bitte wähle deinen Geburtsmonat."),
  birthplace: twoLetters("Bitte gib die ersten beiden Buchstaben deines Geburtsortes ein."),
});

export function codeStemFromParts(parts: z.infer<typeof CodePartsSchema>) {
  return `${parts.mother}-${parts.month}-${parts.birthplace}`;
}

const STEM = /^(\p{Lu}{2})-(0[1-9]|1[0-2])-(\p{Lu}{2})$/u;

/** Prüft einen vollständigen Code-Anfang wie "KA-03-BE", etwa wenn ein Admin ihn korrigiert. */
export function parseCodeStem(value: string) {
  const stem = value.trim().normalize("NFC").toUpperCase().replace(/\s+/g, "");
  return STEM.test(stem) ? stem : null;
}

/** Vollständiger Code; ohne Gruppe steht ein Fragezeichen an ihrer Stelle. */
export function formatCode(stem: string | null, groupLetter: string | null) {
  if (!stem) return null;
  return `${stem}-${groupLetter ?? "?"}`;
}

export const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
].map((name, index) => ({ value: String(index + 1).padStart(2, "0"), name }));

export type CodedPerson = { id: string; displayName: string; codeStem: string | null; groupLetter: string | null };

/**
 * Personen, deren Codes sich nicht sicher unterscheiden lassen: gleicher Code-Anfang und
 * dieselbe Gruppe, oder bei mindestens einer von beiden fehlt die Gruppe noch.
 */
export function findDuplicateCodes(people: CodedPerson[]) {
  const byStem = new Map<string, CodedPerson[]>();
  for (const person of people) {
    if (!person.codeStem) continue;
    byStem.set(person.codeStem, [...(byStem.get(person.codeStem) ?? []), person]);
  }

  const duplicates: { stem: string; people: CodedPerson[] }[] = [];
  for (const [stem, group] of byStem) {
    const clashing = group.filter((a) =>
      group.some((b) => b !== a && (a.groupLetter === null || b.groupLetter === null || a.groupLetter === b.groupLetter)),
    );
    if (clashing.length > 0) duplicates.push({ stem, people: clashing });
  }
  return duplicates;
}

/**
 * Liest Zeilen wie "KA-03-BE A", "KA-03-BE-A" oder "KA-03-BE;A" für die Sammelzuweisung.
 * Leere Zeilen werden übersprungen, unlesbare gemeldet.
 */
export function parseGroupAssignments(text: string) {
  const assignments: { line: number; stem: string; letter: string }[] = [];
  const invalid: { line: number; text: string }[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const match = /^(.+?)[\s;,\t-]+(\p{L})$/u.exec(line.normalize("NFC").toUpperCase());
    const stem = match ? parseCodeStem(match[1]) : null;
    if (!match || !stem) {
      invalid.push({ line: index + 1, text: line });
      return;
    }
    assignments.push({ line: index + 1, stem, letter: match[2] });
  });

  return { assignments, invalid };
}
