// Zeitplan der Abfragen. Alle Daten sind Kalendertage in deutscher Zeit als "YYYY-MM-DD".
// Gerechnet wird in UTC, damit Sommer- und Winterzeit keine Tage verschieben.

const TIME_ZONE = "Europe/Berlin";

const toUtc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;

/** Heutiges Datum in deutscher Zeit. */
export function berlinDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const addDays = (date: string, days: number) => fromUtc(toUtc(date) + days * DAY);

/** ISO-Wochentag, 1 = Montag … 7 = Sonntag. */
export const isoWeekday = (date: string) => ((new Date(toUtc(date)).getUTCDay() + 6) % 7) + 1;

export const mondayOf = (date: string) => addDays(date, 1 - isoWeekday(date));

/** Woche 1 ist die Woche, in die der Studienstart fällt. */
export const weekNumber = (weekStart: string, studyStart: string) =>
  Math.round((toUtc(weekStart) - toUtc(mondayOf(studyStart))) / (7 * DAY)) + 1;

export type SlotState = "upcoming" | "open" | "past";

export type Slot<Q> = {
  questionnaire: Q;
  weekStart: string;
  weekNumber: number;
  /** Erster und letzter Tag des Zeitfensters */
  from: string;
  to: string;
  state: SlotState;
};

type Schedulable = { opensOn: number; closesOn: number };

/**
 * Alle Termine einer Gruppe im Studienzeitraum bis einschließlich der aktuellen Woche, dazu die
 * Termine der aktuellen Woche, die erst noch kommen. Zeitfenster, die ganz vor dem Start oder
 * nach dem Ende liegen, zählen nicht.
 */
export function buildSlots<Q extends Schedulable>(input: {
  studyStart: string;
  studyEnd: string;
  today: string;
  questionnaires: Q[];
}): Slot<Q>[] {
  const { studyStart, studyEnd, today, questionnaires } = input;
  const slots: Slot<Q>[] = [];
  const lastWeek = mondayOf(today < studyEnd ? today : studyEnd);

  for (let week = mondayOf(studyStart); week <= lastWeek; week = addDays(week, 7)) {
    for (const questionnaire of questionnaires) {
      const from = addDays(week, questionnaire.opensOn - 1);
      const to = addDays(week, questionnaire.closesOn - 1);
      if (to < studyStart || from > studyEnd) continue;
      slots.push({
        questionnaire,
        weekStart: week,
        weekNumber: weekNumber(week, studyStart),
        from,
        to,
        state: today < from ? "upcoming" : today > to ? "past" : "open",
      });
    }
  }
  return slots;
}

/** Findet den Termin zu einer Abfrage und Woche, z. B. beim Start aus einem Link. */
export function findSlot<S extends Slot<Schedulable & { id: string }>>(
  slots: S[],
  questionnaireId: string,
  weekStart: string,
): S | null {
  return slots.find((s) => s.questionnaire.id === questionnaireId && s.weekStart === weekStart) ?? null;
}

const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** "Mo 19.10." */
export function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${WEEKDAYS_SHORT[isoWeekday(date) - 1]} ${day}.${month}.`;
}

/** "Mo 19.10.–Mi 21.10." oder ein einzelner Tag. */
export const formatRange = (from: string, to: string) =>
  from === to ? formatDay(from) : `${formatDay(from)}–${formatDay(to)}`;
