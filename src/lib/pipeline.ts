import "server-only";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline as streamPipeline } from "node:stream/promises";
import { and, asc, eq, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, recordings } from "@/lib/db/schema";
import { convertToMp3 } from "./audio";
import { summarize, transcribe } from "./cortecs";
import { getTranscriptionPrompt } from "./settings";
import { getObjectStream, putFile } from "./storage";

const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60 * 1000;

const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

/** Wandelt um, transkribiert und stößt danach die Zusammenfassung des Eintrags an. */
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
    .where(and(eq(recordings.id, recordingId), ne(recordings.status, "done")))
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

    const transcript = await transcribe(mp3Path, await getTranscriptionPrompt());
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
    return;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  await summarizeEntry(recording.entryId);
}

/** Fasst alle fertig transkribierten Aufnahmen eines Eintrags in drei Stichpunkten zusammen. */
export async function summarizeEntry(entryId: string) {
  const done = await db
    .select({ transcript: recordings.transcript })
    .from(recordings)
    .where(and(eq(recordings.entryId, entryId), eq(recordings.status, "done")))
    .orderBy(asc(recordings.position));
  if (done.length === 0) return;

  await db
    .update(entries)
    .set({
      summaryStatus: "pending",
      summaryAttempts: sql`${entries.summaryAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(entries.id, entryId));

  try {
    const summary = await summarize(done.map((r) => r.transcript!));
    // Läuft parallel schon eine Zusammenfassung über mehr Aufnahmen, gewinnt diese
    await db
      .update(entries)
      .set({
        summary,
        summaryStatus: "done",
        summaryRecordingCount: done.length,
        summaryAttempts: 0,
        summaryError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(entries.id, entryId), lte(entries.summaryRecordingCount, done.length)));
  } catch (error) {
    console.error(`Zusammenfassung für Eintrag ${entryId} fehlgeschlagen`, error);
    await db
      .update(entries)
      .set({ summaryStatus: "failed", summaryError: message(error), updatedAt: new Date() })
      .where(eq(entries.id, entryId));
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
      ),
    );
  for (const { id } of stuckRecordings) await processRecording(id);

  const stuckEntries = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        or(
          ne(entries.summaryStatus, "done"),
          // Zusammenfassung deckt noch nicht alle fertigen Aufnahmen ab
          sql`${entries.summaryRecordingCount} < (select count(*) from ${recordings} where ${recordings.entryId} = ${entries.id} and ${recordings.status} = 'done')`,
        ),
        lt(entries.updatedAt, stuckBefore),
        lt(entries.summaryAttempts, MAX_ATTEMPTS),
      ),
    );
  for (const { id } of stuckEntries) await summarizeEntry(id);
}
