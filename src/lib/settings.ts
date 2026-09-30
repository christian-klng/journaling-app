import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const TRANSCRIPTION_PROMPT_KEY = "transcription_prompt";
/** Whisper wertet nur die letzten rund 224 Token des Hinweises aus, mehr bringt nichts. */
export const TRANSCRIPTION_PROMPT_MAX_LENGTH = 600;

export async function getSetting(key: string) {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getTranscriptionPrompt() {
  const value = await getSetting(TRANSCRIPTION_PROMPT_KEY);
  return value?.trim() || null;
}
