import "server-only";
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questionnaireItems, questionnaires, studyGroups } from "@/lib/db/schema";
import { getStudyPeriod } from "@/lib/settings";
import { STUDY_FILE_FORMAT, type StudyFile } from "./config";

/** Alle Gruppen mit ihren Abfragen und der Zahl der aktiven Elemente, für die Übersicht. */
export async function getStudyOverview() {
  const groups = await db.query.studyGroups.findMany({
    orderBy: asc(studyGroups.letter),
    with: {
      questionnaires: {
        orderBy: asc(questionnaires.position),
        with: { items: { columns: { id: true }, where: isNull(questionnaireItems.archivedAt) } },
      },
    },
  });
  return groups.map(({ questionnaires: list, ...group }) => ({
    ...group,
    questionnaires: list.map(({ items, ...q }) => ({ ...q, itemCount: items.length })),
  }));
}

export function listStudyGroups() {
  return db.select().from(studyGroups).orderBy(asc(studyGroups.letter));
}

export async function getQuestionnaire(id: string) {
  const questionnaire = await db.query.questionnaires.findFirst({
    where: eq(questionnaires.id, id),
    with: { group: true, items: { orderBy: asc(questionnaireItems.position) } },
  });
  return questionnaire ?? null;
}

/** Die aktuelle Konfiguration im Austauschformat, ohne Archiviertes. */
export async function buildStudyFile(): Promise<StudyFile> {
  const [groups, period] = await Promise.all([
    db.query.studyGroups.findMany({
      orderBy: asc(studyGroups.letter),
      with: {
        questionnaires: {
          where: isNull(questionnaires.archivedAt),
          orderBy: asc(questionnaires.position),
          with: {
            items: {
              where: isNull(questionnaireItems.archivedAt),
              orderBy: asc(questionnaireItems.position),
            },
          },
        },
      },
    }),
    getStudyPeriod(),
  ]);

  return {
    format: STUDY_FILE_FORMAT,
    version: 1,
    studyStart: period.start,
    studyEnd: period.end,
    groups: groups.map((group) => ({
      letter: group.letter,
      label: group.label,
      questionnaires: group.questionnaires.map((q) => ({
        name: q.name,
        intro: q.intro,
        opensOn: q.opensOn,
        closesOn: q.closesOn,
        items: q.items.map((item) => ({
          type: item.type,
          text: item.text,
          required: item.required,
          minLabel: item.minLabel,
          maxLabel: item.maxLabel,
        })),
      })),
    })),
  };
}
