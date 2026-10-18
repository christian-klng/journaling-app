import "server-only";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline as streamPipeline } from "node:stream/promises";
import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordings } from "@/lib/db/schema";
import { convertToMp3 } from "./audio";
import { transcribe } from "./cortecs";
import { getTranscriptionPrompt, isTranscriptionEnabled } from "./settings";
import { getObjectStream, putFile } from "./storage";

const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60 * 1000;

const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

/** Wandelt die Aufnahme in MP3 um und transkribiert sie. */
export async function processRecording(recordingId: string) {
  // Nur ein Durchlauf darf die Aufnahme übernehmen
  const [recording] = await db
    .update(recordings)
    .set({
      status: "transcribing",
      attempts: sql`${recordings.attempts} + 1`,
      error: null,
      updatedAt: new Date(),
    })
    .where(and(eq(recordings.id, recordingId), ne(recordings.status, "done"), isNull(recordings.audioDeletedAt)))
    .returning();
  if (!recording) return;

  const dir = await mkdtemp(join(tmpdir(), "rec-"));
  try {
    const inputPath = join(dir, "input");
    const mp3Path = join(dir, "audio.mp3");
    await streamPipeline(
      await getObjectStream(recording.storageKeyOriginal),
      createWriteStream(inputPath),
    );

    const { durationSeconds } = await convertToMp3(inputPath, mp3Path);
    const storageKeyMp3 = recording.storageKeyOriginal.replace(/\/original\.[^/]+$/, "/audio.mp3");
    await putFile(storageKeyMp3, mp3Path, "audio/mpeg");
    await db
      .update(recordings)
      .set({ storageKeyMp3, durationSeconds: durationSeconds ?? recording.durationSeconds })
      .where(eq(recordings.id, recordingId));

    // Ausgeschaltet verlässt die Aufnahme den Server nicht; sie bleibt ohne Transkript
    const transcript = (await isTranscriptionEnabled()) ? await transcribe(mp3Path, await getTranscriptionPrompt()) : null;
    await db
      .update(recordings)
      .set({ transcript, status: "done", updatedAt: new Date() })
      .where(eq(recordings.id, recordingId));
  } catch (error) {
    console.error(`Aufnahme ${recordingId} fehlgeschlagen`, error);
    await db
      .update(recordings)
      .set({ status: "failed", error: message(error), updatedAt: new Date() })
      .where(eq(recordings.id, recordingId));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Nimmt liegen gebliebene Arbeit wieder auf, etwa nach einem Neustart mitten in der
 * Verarbeitung oder nach einem vorübergehenden Ausfall des KI-Anbieters.
 */
export async function recoverStuckWork() {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);

  const stuckRecordings = await db
    .select({ id: recordings.id })
    .from(recordings)
    .where(
      and(
        inArray(recordings.status, ["uploaded", "transcribing", "failed"]),
        lt(recordings.updatedAt, stuckBefore),
        lt(recordings.attempts, MAX_ATTEMPTS),
        isNull(recordings.audioDeletedAt),
      ),
    );
  for (const { id } of stuckRecordings) await processRecording(id);
}
