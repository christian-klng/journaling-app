// Prüft mit dem echten API-Key, ob die Transkription über Cortecs funktioniert.
// Aufruf: npm run cortecs:check -- pfad/zur/aufnahme.mp3
import { createReadStream, existsSync } from "node:fs";
import OpenAI from "openai";

const file = process.argv[2];
if (!process.env.CORTECS_API_KEY) {
  console.error("CORTECS_API_KEY fehlt (in .env eintragen).");
  process.exit(1);
}
if (!file || !existsSync(file)) {
  console.error("Bitte eine Audiodatei angeben: npm run cortecs:check -- aufnahme.mp3");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.CORTECS_API_KEY,
  baseURL: process.env.CORTECS_BASE_URL ?? "https://api.cortecs.ai/v1",
});
const routing = { eu_native: process.env.CORTECS_EU_NATIVE !== "false", enable_model_fallback: true };
const transcriptionModel = process.env.CORTECS_TRANSCRIPTION_MODEL ?? "whisper-large-v3";

console.log(`Transkription mit ${transcriptionModel} …`);
const started = Date.now();
const transcription = await client.audio.transcriptions.create({
  file: createReadStream(file),
  model: transcriptionModel,
  language: process.env.CORTECS_TRANSCRIPTION_LANGUAGE ?? "de",
  ...routing,
});
console.log(`  fertig nach ${((Date.now() - started) / 1000).toFixed(1)} s`);
console.log(`  Anbieter: ${transcription.provider ?? "unbekannt"}`);
console.log(`  Text: ${transcription.text}`);
