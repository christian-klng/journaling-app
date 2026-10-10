import "server-only";
import { createReadStream } from "node:fs";
import OpenAI from "openai";

// Für lokale Entwicklung und automatische Tests ohne API-Key
const isMock = () => process.env.CORTECS_MOCK === "true";

function client() {
  if (!process.env.CORTECS_API_KEY) throw new Error("CORTECS_API_KEY ist nicht gesetzt");
  return new OpenAI({
    apiKey: process.env.CORTECS_API_KEY,
    baseURL: process.env.CORTECS_BASE_URL ?? "https://api.cortecs.ai/v1",
    maxRetries: 2,
    timeout: 5 * 60 * 1000,
  });
}

// Cortecs-eigene Routing-Parameter: nur Anbieter in der EU, Ausweichmodell bei Ausfall
const routing = () => ({
  eu_native: process.env.CORTECS_EU_NATIVE !== "false",
  enable_model_fallback: true,
});

/**
 * @param prompt Optionaler Hinweistext im Stil des erwarteten Transkripts (Namen, Fachbegriffe).
 *   Whisper übernimmt daraus Schreibweisen und Stil.
 */
export async function transcribe(mp3Path: string, prompt?: string | null): Promise<string> {
  if (isMock()) {
    return "Das ist ein Beispieltranskript. Diese Woche haben wir den Prototyp fertiggestellt und erste Rückmeldungen gesammelt.";
  }

  const language = process.env.CORTECS_TRANSCRIPTION_LANGUAGE ?? "de";
  const result = await client().audio.transcriptions.create({
    file: createReadStream(mp3Path),
    model: process.env.CORTECS_TRANSCRIPTION_MODEL ?? "whisper-large-v3",
    ...(language ? { language } : {}),
    ...(prompt ? { prompt } : {}),
    ...routing(),
  } as OpenAI.Audio.TranscriptionCreateParamsNonStreaming);

  const text = result.text?.trim();
  if (!text) throw new Error("Die Transkription war leer");
  return text;
}
