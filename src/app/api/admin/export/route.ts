import { once } from "node:events";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { assertAdmin, errorResponse, HttpError } from "@/lib/auth/guards";
import { getExportData, type ExportScope } from "@/lib/admin/queries";
import { isUuid } from "@/lib/entries";
import { entryFolder, recordingBaseName, toCsv } from "@/lib/export";
import { formatIsoDate, formatShortDate, formatTime } from "@/lib/format";
import { getObjectStream } from "@/lib/storage";

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
    const teamId = params.get("team");
    if (userId && !isUuid(userId)) throw new HttpError(400, "Ungültige Nutzer-ID");
    if (teamId && teamId !== "none" && !isUuid(teamId)) throw new HttpError(400, "Ungültige Team-ID");

    const scope: ExportScope = userId ? { userId } : teamId ? { teamId } : {};
    const rows = await getExportData(scope);
    const root = `export_${formatIsoDate(new Date())}`;

    const archive = new ZipArchive({ zlib: { level: 6 } });
    // Audio ist schon komprimiert, deshalb unverändert ablegen
    const add = async (content: string | Readable, name: string, store = false) => {
      archive.append(content, { name: `${root}/${name}`, store });
      await once(archive, "entry");
    };

    // Der Inhalt wird nach und nach geschrieben, während der Browser schon herunterlädt
    void (async () => {
      const entryNumbers = new Map<string, number>();
      const csvRows: (string | number | null)[][] = [];

      for (const row of rows) {
        const entryNumber = (entryNumbers.get(row.userId) ?? 0) + 1;
        entryNumbers.set(row.userId, entryNumber);
        const folder = entryFolder({ ...row, entryNumber, createdAt: row.entry.createdAt });

        for (const recording of row.recordings) {
          const base = `${folder}/${recordingBaseName(recording.position)}`;
          const key = recording.storageKeyMp3 ?? recording.storageKeyOriginal;
          const extension = recording.storageKeyMp3 ? "mp3" : (EXTENSIONS[recording.mimeType] ?? "bin");
          try {
            await add(await getObjectStream(key), `${base}.${extension}`, true);
          } catch (error) {
            console.error(`Export: Audio ${key} fehlt`, error);
            await add("Die Audiodatei konnte nicht gelesen werden.\n", `${base}.FEHLT.txt`);
          }
          await add(
            recording.transcript ? `${recording.transcript}\n` : "Noch kein Transkript vorhanden.\n",
            `${base}.txt`,
          );
        }

        csvRows.push([
          row.teamName ?? "Ohne Team",
          row.displayName,
          entryNumber,
          formatShortDate(row.entry.createdAt),
          formatTime(row.entry.createdAt),
          row.recordings.length,
          row.recordings.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0),
          folder,
        ]);
      }

      await add(
        toCsv(
          [
            "Team", "Fantasiename", "Eintrag", "Datum", "Uhrzeit", "Aufnahmen",
            "Dauer (Sekunden)", "Ordner",
          ],
          csvRows,
        ),
        "uebersicht.csv",
      );
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
