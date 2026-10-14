/** "Woche 3 · Check-In"; Einträge aus der Zeit vor den Abfragen heißen "Freier Eintrag". */
export function entryTitle(entry: { questionnaireName: string | null; weekNumber: number | null }) {
  if (!entry.questionnaireName) return "Freier Eintrag";
  return entry.weekNumber ? `Woche ${entry.weekNumber} · ${entry.questionnaireName}` : entry.questionnaireName;
}
