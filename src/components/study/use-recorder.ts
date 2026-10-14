"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_SECONDS = 30 * 60;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];

export type RecorderPhase =
  | { name: "idle" }
  | { name: "requesting" }
  | { name: "recording" }
  | { name: "error"; message: string };

/**
 * Nimmt über das Mikrofon auf. Zeigt den Pegel über levelRef an, hält den Bildschirm wach und
 * beendet die Aufnahme nach 30 Minuten. Die fertige Aufnahme geht an onRecorded.
 */
export function useRecorder(onRecorded: (blob: Blob, durationMs: number) => void) {
  const [phase, setPhase] = useState<RecorderPhase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const levelRef = useRef<HTMLSpanElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const cleanupRef = useRef<(() => void)[]>([]);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const releaseDevices = useCallback(() => {
    for (const cleanup of cleanupRef.current.splice(0)) cleanup();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => releaseDevices, [releaseDevices]);

  const finalize = useCallback(() => {
    const durationMs = Date.now() - startedAtRef.current;
    const type = recorderRef.current?.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    releaseDevices();

    if (discardRef.current) {
      setPhase({ name: "idle" });
      return;
    }
    if (blob.size === 0 || durationMs < 1000) {
      setPhase({ name: "error", message: "Die Aufnahme war leer. Bitte versuche es noch einmal." });
      return;
    }
    setPhase({ name: "idle" });
    onRecordedRef.current(blob, durationMs);
  }, [releaseDevices]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const discard = useCallback(() => {
    discardRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else {
      releaseDevices();
      setPhase({ name: "idle" });
    }
  }, [releaseDevices]);

  function watchLevel(stream: MediaStream) {
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      let frame = 0;
      const draw = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        if (levelRef.current) levelRef.current.style.transform = `scale(${1 + level * 0.6})`;
        frame = requestAnimationFrame(draw);
      };
      draw();
      cleanupRef.current.push(() => {
        cancelAnimationFrame(frame);
        void context.close();
      });
    } catch {
      // Die Pegelanzeige ist nur Beiwerk
    }
  }

  async function keepScreenAwake() {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    // Der Browser gibt die Sperre frei, sobald die Seite in den Hintergrund geht
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    cleanupRef.current.push(() => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    });
    await acquire();
  }

  async function start() {
    discardRef.current = false;
    chunksRef.current = [];
    setElapsed(0);
    setPhase({ name: "requesting" });

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase({
        name: "error",
        message: "Dieser Browser kann keine Aufnahmen machen. Bitte nutze eine aktuelle Version von Safari oder Chrome.",
      });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setPhase({
        name: "error",
        message: denied
          ? "Der Zugriff auf das Mikrofon wurde nicht erlaubt. Bitte gib ihn in den Einstellungen deines Browsers frei."
          : "Es wurde kein Mikrofon gefunden.",
      });
      return;
    }
    // Abgebrochen, während die Freigabe abgefragt wurde
    if (discardRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 });
    } catch {
      releaseDevices();
      setPhase({ name: "error", message: "Die Aufnahme konnte nicht gestartet werden." });
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = finalize;
    recorder.onerror = stop;

    // Nimmt das System das Mikrofon weg (Anruf, App-Wechsel auf iOS), sichern wir das Bisherige
    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      if (recorderRef.current?.state === "recording") stop();
    });

    recorder.start(1000);
    startedAtRef.current = Date.now();
    setPhase({ name: "recording" });

    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_SECONDS) stop();
    }, 250);
    cleanupRef.current.push(() => clearInterval(timer));

    watchLevel(stream);
    void keepScreenAwake();
  }

  return { phase, elapsed, levelRef, start, stop, discard, reset: () => setPhase({ name: "idle" }) };
}
