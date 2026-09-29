import { formatIsoDate } from "./format";

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

export function entryFolder(input: {
  teamName: string | null;
  displayName: string;
  entryNumber: number;
  createdAt: Date;
}) {
  return [
    safeName(input.teamName ?? "Ohne Team"),
    safeName(input.displayName),
    `${formatIsoDate(input.createdAt)}_eintrag-${pad(input.entryNumber)}`,
  ].join("/");
}

export const recordingBaseName = (position: number) => `aufnahme-${pad(position)}`;

export function summaryText(summary: string[] | null) {
  if (!summary?.length) return "Noch keine Zusammenfassung vorhanden.\n";
  return summary.map((point) => `- ${point}`).join("\n") + "\n";
}

// Tabellenprogramme führen Zellen aus, die mit diesen Zeichen beginnen, als Formel aus
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Semikolon als Trenner und BOM, damit Excel die Datei auf Deutsch richtig öffnet. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
