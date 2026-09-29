import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { eq, max } from "drizzle-orm";
import { assertUser, errorResponse, HttpError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { entries, recordings } from "@/lib/db/schema";
import { getAccessibleRecording, isUuid } from "@/lib/entries";
import { processRecording } from "@/lib/pipeline";
import { putObject } from "@/lib/storage";

const MAX_BYTES = 60 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
};

export async function POST(request: Request) {
  try {
    const user = await assertUser();
    const form = await request.formData();

    const file = form.get("file");
    const recordingId = form.get("recordingId");
    const entryIdField = form.get("entryId");
    const durationMs = Number(form.get("durationMs"));

    if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "Die Aufnahme ist leer");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Die Aufnahme ist zu groß");
    if (!isUuid(recordingId)) throw new HttpError(400, "Ungültige Aufnahme-ID");
    if (entryIdField && !isUuid(entryIdField)) throw new HttpError(400, "Ungültige Eintrags-ID");

    const mimeType = file.type.split(";")[0].trim().toLowerCase();
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new HttpError(415, "Dieses Audioformat wird nicht unterstützt");

    // Wiederholter Upload derselben Aufnahme, etwa nach einem Verbindungsabbruch
    const existing = await db.query.recordings.findFirst({ where: eq(recordings.id, recordingId) });
    if (existing) {
      const own = await getAccessibleRecording(recordingId, user);
      if (!own || own.entry.userId !== user.id) throw new HttpError(409, "Aufnahme-ID ist vergeben");
      return Response.json({ entryId: existing.entryId, recordingId });
    }

    let entryId: string;
    if (entryIdField) {
      const [entry] = await db.select().from(entries).where(eq(entries.id, entryIdField as string));
      if (!entry || entry.userId !== user.id) throw new HttpError(404, "Eintrag nicht gefunden");
      entryId = entry.id;
    } else {
      entryId = randomUUID();
    }

    // Erst die Datei sichern, dann die Zeilen anlegen. So gibt es keine Aufnahme ohne Audio.
    const storageKey = `users/${user.id}/entries/${entryId}/${recordingId}/original.${extension}`;
    await putObject(storageKey, Buffer.from(await file.arrayBuffer()), mimeType);

    await db.transaction(async (tx) => {
      if (!entryIdField) await tx.insert(entries).values({ id: entryId, userId: user.id });
      // Sperrt den Eintrag, damit zwei gleichzeitige Uploads nicht dieselbe Position bekommen
      await tx.select({ id: entries.id }).from(entries).where(eq(entries.id, entryId)).for("update");
      const [{ last }] = await tx
        .select({ last: max(recordings.position) })
        .from(recordings)
        .where(eq(recordings.entryId, entryId));

      await tx.insert(recordings).values({
        id: recordingId,
        entryId,
        position: (last ?? 0) + 1,
        storageKeyOriginal: storageKey,
        mimeType,
        sizeBytes: file.size,
        durationSeconds: Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : null,
      });
      await tx.update(entries).set({ updatedAt: new Date() }).where(eq(entries.id, entryId));
    });

    after(() => processRecording(recordingId));

    return Response.json({ entryId, recordingId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
