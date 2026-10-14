import * as z from "zod";

export const ITEM_TYPES = ["smiley", "scale", "audio"] as const;
export type ItemTypeKey = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemTypeKey, string> = {
  smiley: "Smiley-Skala 1–5",
  scale: "Skala 0–10",
  audio: "Audio-Frage",
};

/** Antwortstufen der Smiley-Skala, der Wert ist die Stufe 1–5. */
export const SMILEYS = [
  { value: 1, emoji: "😞", label: "sehr schlecht" },
  { value: 2, emoji: "🙁", label: "eher schlecht" },
  { value: 3, emoji: "😐", label: "mittel" },
  { value: 4, emoji: "🙂", label: "eher gut" },
  { value: 5, emoji: "😄", label: "sehr gut" },
] as const;

export const SCALE_MIN = 0;
export const SCALE_MAX = 10;

export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** "Mo–Mi", "Fr" oder "jeden Tag" für ein Zeitfenster aus ISO-Wochentagen (1 = Montag). */
export function formatWindow(opensOn: number, closesOn: number) {
  if (opensOn === 1 && closesOn === 7) return "jeden Tag";
  if (opensOn === closesOn) return WEEKDAYS_SHORT[opensOn - 1];
  return `${WEEKDAYS_SHORT[opensOn - 1]}–${WEEKDAYS_SHORT[closesOn - 1]}`;
}

const weekday = z.coerce.number().int().min(1).max(7);
const isoDate = z.iso.date("Bitte gib ein gültiges Datum ein.");

export const LetterSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, "Der Buchstabe muss genau ein Buchstabe von A bis Z sein.");

export const GroupLabelSchema = z.string().trim().max(100, "Höchstens 100 Zeichen.");

export const QuestionnaireSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(60, "Der Name darf höchstens 60 Zeichen haben."),
    intro: z.string().trim().max(2000, "Die Einleitung darf höchstens 2000 Zeichen haben.").default(""),
    opensOn: weekday,
    closesOn: weekday,
  })
  .refine((q) => q.closesOn >= q.opensOn, {
    message: "Das Zeitfenster muss am selben oder einem späteren Wochentag enden.",
    path: ["closesOn"],
  });

export const ItemSchema = z.object({
  text: z.string().trim().min(1, "Bitte gib einen Text ein.").max(500, "Höchstens 500 Zeichen."),
  required: z.boolean(),
  minLabel: z.string().trim().max(60, "Höchstens 60 Zeichen.").default(""),
  maxLabel: z.string().trim().max(60, "Höchstens 60 Zeichen.").default(""),
});

export const StudyPeriodSchema = z
  .object({ start: isoDate, end: isoDate })
  .refine((p) => p.end >= p.start, { message: "Das Ende muss nach dem Start liegen.", path: ["end"] });

// Austauschformat für Import und Export. Archivierte Abfragen und Elemente gehören nicht dazu.
export const STUDY_FILE_FORMAT = "journaling-studie";

const FileItemSchema = ItemSchema.extend({
  type: z.enum(ITEM_TYPES),
  required: z.boolean().default(true),
});

const FileQuestionnaireSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    intro: z.string().trim().max(2000).default(""),
    opensOn: z.number().int().min(1).max(7),
    closesOn: z.number().int().min(1).max(7),
    items: z.array(FileItemSchema).max(50),
  })
  .refine((q) => q.closesOn >= q.opensOn, { message: "Zeitfenster endet vor dem Beginn" });

export const StudyFileSchema = z
  .object({
    format: z.literal(STUDY_FILE_FORMAT),
    version: z.literal(1),
    studyStart: isoDate.nullable().default(null),
    studyEnd: isoDate.nullable().default(null),
    groups: z
      .array(
        z.object({
          letter: LetterSchema,
          label: GroupLabelSchema.default(""),
          questionnaires: z.array(FileQuestionnaireSchema).max(20),
        }),
      )
      .max(26),
  })
  .refine((f) => new Set(f.groups.map((g) => g.letter)).size === f.groups.length, {
    message: "Jeder Gruppenbuchstabe darf nur einmal vorkommen",
  })
  .refine((f) => !f.studyStart || !f.studyEnd || f.studyEnd >= f.studyStart, {
    message: "Das Studienende liegt vor dem Start",
  });

export type StudyFile = z.infer<typeof StudyFileSchema>;

/** Liest eine Importdatei. Gibt bei Fehlern eine verständliche Meldung zurück. */
export function parseStudyFile(text: string): { data: StudyFile } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "Die Datei ist kein gültiges JSON." };
  }
  const parsed = StudyFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` (bei ${issue.path.join(".")})` : "";
    return { error: `Die Datei passt nicht zum erwarteten Format: ${issue.message}${where}.` };
  }
  return { data: parsed.data };
}
