import { formatIsoDate, formatShortDate, formatTime } from "./format";
import { SMILEYS } from "./study/config";

/** Macht aus einem Namen einen Ordnernamen, der auf allen Systemen funktioniert. */
export function safeName(name: string) {
  return (
    name
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/[\s-]+/g, "-")
      .slice(0, 80) || "unbenannt"
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Ordner einer Person: aktuelle Gruppe, dann Code und Fantasiename, damit auch doppelte Codes
 * getrennt bleiben.
 */
export function personFolder(input: { groupLetter: string | null; code: string | null; displayName: string }) {
  const person = input.code ? `${input.code.replace("?", "X")}_${input.displayName}` : input.displayName;
  const group = input.groupLetter ? `Gruppe ${input.groupLetter}` : "Ohne Gruppe";
  return [safeName(group), safeName(person)].join("/");
}

/** "W03_Check-In"; Einträge aus der Zeit vor den Abfragen nach Datum. */
export function entryFolderName(input: {
  questionnaireName: string | null;
  weekNumber: number | null;
  createdAt: Date;
  freeNumber: number;
}) {
  if (!input.questionnaireName) return `${formatIsoDate(input.createdAt)}_frei-${pad(input.freeNumber)}`;
  const week = input.weekNumber === null ? "W--" : `W${pad(input.weekNumber)}`;
  return `${week}_${safeName(input.questionnaireName)}`;
}

/** "frage-03_aufnahme-01"; ohne Frage nur "aufnahme-01". */
export const recordingBaseName = (questionNumber: number | null, position: number) =>
  `${questionNumber === null ? "" : `frage-${pad(questionNumber)}_`}aufnahme-${pad(position)}`;

export const ANSWER_COLUMNS = [
  "Code",
  "Fantasiename",
  "Gruppe",
  "Woche",
  "Wochenbeginn",
  "Abfrage",
  "Nachgeholt",
  "Begonnen",
  "Abgeschlossen",
  "Frage-Nr",
  "Frage-ID",
  "Fragetyp",
  "Fragetext",
  "Wert",
  "Wert (Text)",
  "Transkript",
  "Aufnahmen",
  "Dauer (Sekunden)",
  "Dateien",
] as const;

const TYPE_LABELS = { smiley: "Smiley 1–5", scale: "Skala 0–10", audio: "Audio" } as const;

type ItemType = keyof typeof TYPE_LABELS;

export type ExportEntry = {
  code: string | null;
  displayName: string;
  /** Gruppe beim Ausfüllen */
  groupLetter: string | null;
  questionnaireName: string | null;
  weekNumber: number | null;
  weekStart: string | null;
  late: boolean;
  createdAt: Date;
  completedAt: Date | null;
  /** Alle Fragen der Abfrage, auch archivierte, für eine feste Nummerierung */
  items: { id: string; position: number }[];
  answers: { itemId: string; itemType: ItemType; itemText: string; value: number }[];
  recordings: {
    itemId: string | null;
    itemText: string | null;
    position: number;
    durationSeconds: number | null;
    transcript: string | null;
    file: string;
  }[];
};

const dateTime = (date: Date | null) => (date ? `${formatShortDate(date)} ${formatTime(date)}` : "");

/** Nummer einer Frage innerhalb ihrer Abfrage, 1-basiert, archivierte mitgezählt. */
export function questionNumber(items: { id: string; position: number }[], itemId: string) {
  const index = [...items].sort((a, b) => a.position - b.position).findIndex((item) => item.id === itemId);
  return index === -1 ? null : index + 1;
}

/** Eine Zeile pro beantworteter Frage: Skalenwert oder alle Aufnahmen mit ihren Transkripten. */
export function answerRows(entry: ExportEntry): (string | number | null)[][] {
  const base = [
    entry.code,
    entry.displayName,
    entry.groupLetter,
    entry.weekNumber,
    entry.weekStart,
    entry.questionnaireName ?? "Freier Eintrag",
    entry.late ? "ja" : "nein",
    dateTime(entry.createdAt),
    dateTime(entry.completedAt),
  ];

  type Row = { number: number | null; itemId: string | null; type: ItemType; text: string; cells: (string | number | null)[] };
  const rows: Row[] = entry.answers.map((answer) => {
    const smiley = answer.itemType === "smiley" ? SMILEYS.find((s) => s.value === answer.value)?.label : null;
    return {
      number: questionNumber(entry.items, answer.itemId),
      itemId: answer.itemId,
      type: answer.itemType,
      text: answer.itemText,
      cells: [answer.value, smiley ?? "", "", 0, 0, ""],
    };
  });

  const byItem = new Map<string | null, ExportEntry["recordings"]>();
  for (const recording of [...entry.recordings].sort((a, b) => a.position - b.position)) {
    byItem.set(recording.itemId, [...(byItem.get(recording.itemId) ?? []), recording]);
  }
  for (const [itemId, list] of byItem) {
    rows.push({
      number: itemId ? questionNumber(entry.items, itemId) : null,
      itemId,
      type: "audio",
      text: list[0].itemText ?? "",
      cells: [
        "",
        "",
        list.map((r) => r.transcript ?? "").filter(Boolean).join("\n\n"),
        list.length,
        list.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0),
        list.map((r) => r.file).filter(Boolean).join("; "),
      ],
    });
  }

  return rows
    .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER))
    .map((row) => [...base, row.number, row.itemId, TYPE_LABELS[row.type], row.text, ...row.cells]);
}

export const PARTICIPATION_COLUMNS = ["Code", "Fantasiename", "Gruppe", "Woche", "Wochenbeginn", "Abfrage", "Status"] as const;

export const PARTICIPATION_LABELS = {
  done: "erledigt",
  late: "nachgeholt",
  started: "begonnen",
  missed: "verpasst",
  open: "läuft",
  upcoming: "kommt noch",
  none: "",
} as const;

export const README_TEXT = `Export der LimeJournal-App
=========================

antworten.csv
  Eine Zeile pro beantworteter Frage. Fragetext und Fragetyp so, wie die Person sie beim
  Antworten gesehen hat. "Frage-ID" bleibt gleich, auch wenn der Text später korrigiert wurde.
  Wert:       Smiley 1 (sehr schlecht) bis 5 (sehr gut), Skala 0 bis 10
  Transkript: bei Audio-Fragen; mehrere Aufnahmen durch eine Leerzeile getrennt
  Gruppe:     Gruppe beim Ausfüllen
  Nachgeholt: "ja", wenn die Abfrage nach dem Ende ihres Zeitfensters begonnen wurde
  Abgeschlossen leer: begonnen, aber nicht abgeschlossen

teilnahme.csv
  Eine Zeile pro Person, Woche und Abfrage bis heute.
  Status: erledigt, nachgeholt, begonnen, verpasst, läuft, kommt noch

Ordner
  Gruppe / Code_Fantasiename / Woche_Abfrage / frage-NN_aufnahme-NN.mp3 und .txt (Transkript)
  Der erste Ordner ist die aktuelle Gruppe der Person. Ein X im Code steht für eine noch
  fehlende Gruppe. Wurden die Audiodateien gelöscht, gibt es nur noch die .txt-Dateien.

Woche 1 ist die Woche, in die der Studienstart fällt. Alle Zeiten in deutscher Zeit.
`;

// Tabellenprogramme führen Zellen aus, die mit diesen Zeichen beginnen, als Formel aus
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Semikolon als Trenner und BOM, damit Excel die Datei auf Deutsch richtig öffnet. */
export function toCsv(header: readonly string[], rows: (string | number | null | undefined)[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
