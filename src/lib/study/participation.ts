import { buildSlots, mondayOf, weekNumber } from "./schedule";

export type ParticipationStatus =
  /** Im Zeitfenster abgeschlossen */
  | "done"
  /** Nach dem Zeitfenster abgeschlossen, als Nachholen noch möglich war */
  | "late"
  /** Begonnen, aber nicht abgeschlossen */
  | "started"
  /** Zeitfenster vorbei, nichts abgegeben */
  | "missed"
  /** Zeitfenster läuft gerade */
  | "open"
  /** Zeitfenster kommt noch */
  | "upcoming"
  /** Abfrage gibt es für diese Person nicht, z. B. ohne Gruppe */
  | "none";

type Questionnaire = { id: string; groupId: string; name: string; opensOn: number; closesOn: number; position: number };
type Person = { id: string; studyGroupId: string | null };
type EntryRow = { userId: string; questionnaireId: string | null; weekStart: string | null; completedAt: Date | null; late: boolean };

/**
 * Stand jeder Person in jeder Woche bis heute. Abfragen werden über ihren Namen zu Spalten
 * zusammengefasst, damit "Check-In" der Gruppen A und B in derselben Spalte steht.
 */
export function buildParticipation(input: {
  studyStart: string;
  studyEnd: string;
  today: string;
  people: Person[];
  questionnaires: Questionnaire[];
  entries: EntryRow[];
}) {
  const { studyStart, studyEnd, today, people, questionnaires, entries } = input;

  const names = [...new Set([...questionnaires].sort((a, b) => a.position - b.position).map((q) => q.name))];
  const weeks: { weekStart: string; weekNumber: number }[] = [];
  const lastWeek = mondayOf(today < studyEnd ? today : studyEnd);
  for (let week = mondayOf(studyStart); week <= lastWeek; week = nextWeek(week)) {
    weeks.push({ weekStart: week, weekNumber: weekNumber(week, studyStart) });
  }

  const rows = people.map((person) => {
    const own = questionnaires.filter((q) => q.groupId === person.studyGroupId);
    const slots = buildSlots({ studyStart, studyEnd, today, questionnaires: own });
    let due = 0;
    let completed = 0;

    const cells = weeks.map((week) =>
      names.map((name): ParticipationStatus => {
        const slot = slots.find((s) => s.weekStart === week.weekStart && s.questionnaire.name === name);
        if (!slot) return "none";
        const entry = entries.find(
          (e) => e.userId === person.id && e.questionnaireId === slot.questionnaire.id && e.weekStart === week.weekStart,
        );
        if (slot.state !== "upcoming") due++;
        if (entry?.completedAt) {
          completed++;
          return entry.late ? "late" : "done";
        }
        if (entry) return "started";
        return slot.state === "past" ? "missed" : slot.state;
      }),
    );
    return { personId: person.id, cells, due, completed };
  });

  return { names, weeks, rows };
}

const nextWeek = (weekStart: string) => {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
};
