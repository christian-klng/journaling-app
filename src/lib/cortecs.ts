import "server-only";
import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { buildSummaryInput, parseSummary, SUMMARY_SYSTEM_PROMPT } from "./summary";

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

export async function transcribe(mp3Path: string): Promise<string> {
  if (isMock()) {
    return "Das ist ein Beispieltranskript. Diese Woche haben wir den Prototyp fertiggestellt und erste Rückmeldungen gesammelt.";
  }

  const language = process.env.CORTECS_TRANSCRIPTION_LANGUAGE ?? "de";
  const result = await client().audio.transcriptions.create({
    file: createReadStream(mp3Path),
    model: process.env.CORTECS_TRANSCRIPTION_MODEL ?? "whisper-large-v3",
    ...(language ? { language } : {}),
    ...routing(),
  } as OpenAI.Audio.TranscriptionCreateParamsNonStreaming);

  const text = result.text?.trim();
  if (!text) throw new Error("Die Transkription war leer");
  return text;
}

export async function summarize(transcripts: string[]): Promise<string[]> {
  if (isMock()) {
    return [
      `Ich habe ${transcripts.length === 1 ? "eine Aufnahme" : `${transcripts.length} Aufnahmen`} eingesprochen.`,
      "Wir haben den Prototyp fertiggestellt.",
      "Wir haben erste Rückmeldungen gesammelt.",
    ];
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: buildSummaryInput(transcripts) },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client().chat.completions.create({
      model: process.env.CORTECS_LLM_MODEL ?? "mistral-small-2603",
      messages,
      temperature: 0.2,
      max_tokens: 400,
      ...routing(),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    const summary = parseSummary(completion.choices[0]?.message?.content ?? "");
    if (summary) return summary;
  }
  throw new Error("Das Sprachmodell hat keine gültige Zusammenfassung geliefert");
}
