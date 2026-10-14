import { once } from "node:events";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getExportData, type ExportScope } from "@/lib/admin/queries";
import { assertAdmin, errorResponse, HttpError } from "@/lib/auth/guards";
import { isUuid } from "@/lib/entries";
import {
  ANSWER_COLUMNS,
  answerRows,
  entryFolderName,
  PARTICIPATION_COLUMNS,
  PARTICIPATION_LABELS,
  personFolder,
  questionNumber,
  README_TEXT,
  recordingBaseName,
  toCsv,
  type ExportEntry,
} from "@/lib/export";
import { formatIsoDate } from "@/lib/format";
import { getStudyPeriod } from "@/lib/settings";
import { getObjectStream } from "@/lib/storage";
import { formatCode } from "@/lib/study/code";
import { buildParticipation } from "@/lib/study/participation";
import { berlinDate, weekNumber } from "@/lib/study/schedule";

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
};

export async function GET(request: Request) {
  try {
    await assertAdmin();

    const params = new URL(request.url).searchParams;
    const userId = params.get("user");
    const groupId = params.get("group");
    if (userId && !isUuid(userId)) throw new HttpError(400, "Ungültige Nutzer-ID");
    if (groupId && groupId !== "none" && !isUuid(groupId)) throw new HttpError(400, "Ungültige Gruppen-ID");

    const scope: ExportScope = userId ? { userId } : groupId ? { groupId } : {};
    const [data, period] = await Promise.all([getExportData(scope), getStudyPeriod()]);
    const root = `export_${formatIsoDate(new Date())}`;

    const archive = new ZipArchive({ zlib: { level: 6 } });
    // Audio ist schon komprimiert, deshalb unverändert ablegen
    const add = async (content: string | Readable, name: string, store = false) => {
      archive.append(content, { name: `${root}/${name}`, store });
      await once(archive, "entry");
    };

    // Der Inhalt wird nach und nach geschrieben, während der Browser schon herunterlädt
    void (async () => {
      await add(README_TEXT, "liesmich.txt");
      const rows: (string | number | null)[][] = [];

      for (const person of data.people) {
        const code = formatCode(person.codeStem, person.groupLetter);
        const base = personFolder({ groupLetter: person.groupLetter, code, displayName: person.displayName });
        let freeNumber = 0;

        for (const entry of data.entries.filter((e) => e.userId === person.id)) {
          if (!entry.questionnaireId) freeNumber++;
          const weekNo = entry.weekStart && period.start ? weekNumber(entry.weekStart, period.start) : null;
          const folder = `${base}/${entryFolderName({
            questionnaireName: entry.questionnaire?.name ?? null,
            weekNumber: weekNo,
            createdAt: entry.createdAt,
            freeNumber,
          })}`;
          const items = entry.questionnaire?.items ?? [];

          const files: ExportEntry["recordings"] = [];
          for (const recording of entry.recordings) {
            const number = recording.itemId ? questionNumber(items, recording.itemId) : null;
            // Position innerhalb der Frage, nicht im ganzen Eintrag
            const nth = entry.recordings.filter((r) => r.itemId === recording.itemId && r.position <= recording.position).length;
            const name = `${folder}/${recordingBaseName(number, nth)}`;
            const key = recording.storageKeyMp3 ?? recording.storageKeyOriginal;
            const extension = recording.storageKeyMp3 ? "mp3" : (EXTENSIONS[recording.mimeType] ?? "bin");
            let file = `${name}.${extension}`;
            try {
              await add(await getObjectStream(key), file, true);
            } catch (error) {
              console.error(`Export: Audio ${key} fehlt`, error);
              file = `${name}.FEHLT.txt`;
              await add("Die Audiodatei konnte nicht gelesen werden.\n", file);
            }
            await add(recording.transcript ? `${recording.transcript}\n` : "Noch kein Transkript vorhanden.\n", `${name}.txt`);
            files.push({
              itemId: recording.itemId,
              itemText: recording.itemText,
              position: recording.position,
              durationSeconds: recording.durationSeconds,
              transcript: recording.transcript,
              file,
            });
          }

          rows.push(
            ...answerRows({
              code,
              displayName: person.displayName,
              groupLetter: entry.studyGroup?.letter ?? null,
              questionnaireName: entry.questionnaire?.name ?? null,
              weekNumber: weekNo,
              weekStart: entry.weekStart,
              late: entry.late,
              createdAt: entry.createdAt,
              completedAt: entry.completedAt,
              items,
              answers: entry.answers,
              recordings: files,
            }),
          );
        }
      }
      await add(toCsv(ANSWER_COLUMNS, rows), "antworten.csv");

      if (period.start && period.end) {
        const participation = buildParticipation({
          studyStart: period.start,
          studyEnd: period.end,
          today: berlinDate(),
          people: data.people,
          questionnaires: data.questionnaires,
          entries: data.entries,
        });
        const participationRows = participation.rows.flatMap((row, index) => {
          const person = data.people[index];
          return row.cells.flatMap((week, w) =>
            week.flatMap((status, q) =>
              status === "none"
                ? []
                : [[
                    formatCode(person.codeStem, person.groupLetter),
                    person.displayName,
                    person.groupLetter,
                    participation.weeks[w].weekNumber,
                    participation.weeks[w].weekStart,
                    participation.names[q],
                    PARTICIPATION_LABELS[status],
                  ]],
            ),
          );
        });
        await add(toCsv(PARTICIPATION_COLUMNS, participationRows), "teilnahme.csv");
      }

      await archive.finalize();
    })().catch((error) => {
      console.error("Export fehlgeschlagen", error);
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    });

    return new Response(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${root}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
