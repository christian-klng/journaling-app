import "server-only";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

// ffmpeg-static liefert den Pfad aus FFMPEG_BIN, falls gesetzt, sonst die mitgelieferte Binärdatei
const ffmpegPath = () => ffmpegStatic || "ffmpeg";

/** Liest die Dauer aus der letzten Fortschrittszeile von ffmpeg ("time=00:01:23.45"). */
export function parseDurationSeconds(ffmpegOutput: string): number | null {
  const matches = [...ffmpegOutput.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const last = matches.at(-1);
  if (!last) return null;
  return Math.round(Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]));
}

/**
 * Wandelt eine Browser-Aufnahme (webm/opus oder mp4/aac) in MP3 mono um. Einheitliches Format
 * für Transkription, Wiedergabe und Export. 64 kbit/s hält 30 Minuten bei rund 14 MB.
 */
export function convertToMp3(inputPath: string, outputPath: string) {
  return new Promise<{ durationSeconds: number | null }>((resolve, reject) => {
    const proc = spawn(ffmpegPath(), [
      "-hide_banner", "-y",
      "-i", inputPath,
      "-vn", "-ac", "1", "-ar", "24000", "-b:a", "64k",
      "-f", "mp3", outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ durationSeconds: parseDurationSeconds(stderr) });
      else reject(new Error(`ffmpeg beendet mit Code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
