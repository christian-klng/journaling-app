"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { removePending, savePending, uploadRecording, type PendingUpload } from "@/lib/client/pending-uploads";
import { formatClock } from "@/lib/format";
import { Spinner, Summary } from "./summary";
import { Button, buttonClass, ErrorMessage } from "./ui";
import { useLiveEntry } from "./use-live-entry";

const MAX_SECONDS = 30 * 60;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];

type Phase =
  | { name: "idle" }
  | { name: "requesting" }
  | { name: "recording"; note?: string }
  | { name: "uploading" }
  | { name: "upload-failed"; message: string }
  | { name: "processing"; entryId: string; recordingId: string }
  | { name: "error"; message: string };

export function RecordingModal({
  entryId,
  label,
  variant = "hero",
}: {
  /** Vorhandener Eintrag, der fortgesetzt wird. Ohne Angabe entsteht ein neuer Eintrag. */
  entryId?: string;
  label: string;
  variant?: "hero" | "button";
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const levelRef = useRef<HTMLSpanElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const pendingRef = useRef<PendingUpload | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  const releaseDevices = useCallback(() => {
    for (const cleanup of cleanupRef.current.splice(0)) cleanup();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => releaseDevices, [releaseDevices]);

  const upload = useCallback(async (pending: PendingUpload) => {
    setPhase({ name: "uploading" });
    try {
      const result = await uploadRecording(pending);
      pendingRef.current = null;
      setPhase({ name: "processing", ...result });
    } catch (error) {
      const status = (error as { status?: number }).status;
      // Bei 4xx hilft Wiederholen nicht, die Aufnahme wird verworfen
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 408) {
        await removePending(pending.id);
        pendingRef.current = null;
        setPhase({ name: "error", message: (error as Error).message });
      } else {
        setPhase({
          name: "upload-failed",
          message:
            "Die Aufnahme konnte nicht hochgeladen werden. Sie ist auf diesem Gerät gesichert. Prüfe deine Verbindung und versuche es erneut.",
        });
      }
    }
  }, []);

  const finalize = useCallback(async () => {
    const durationMs = Date.now() - startedAtRef.current;
    const type = recorderRef.current?.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    releaseDevices();

    if (discardRef.current) return;
    if (blob.size === 0 || durationMs < 1000) {
      setPhase({ name: "error", message: "Die Aufnahme war leer. Bitte versuche es noch einmal." });
      return;
    }

    const pending: PendingUpload = {
      id: crypto.randomUUID(),
      entryId: entryId ?? null,
      blob,
      durationMs,
      createdAt: Date.now(),
    };
    pendingRef.current = pending;
    await savePending(pending);
    await upload(pending);
  }, [entryId, releaseDevices, upload]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  async function start() {
    discardRef.current = false;
    chunksRef.current = [];
    setElapsed(0);
    setPhase({ name: "requesting" });
    dialogRef.current?.showModal();

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
    // Das Modal wurde geschlossen, während die Freigabe abgefragt wurde
    if (!dialogRef.current?.open) {
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
    recorder.onstop = () => void finalize();
    recorder.onerror = () => stop();

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

  function discard() {
    if (elapsed >= 5 && !window.confirm("Aufnahme wirklich verwerfen?")) return;
    discardRef.current = true;
    stop();
    releaseDevices();
    close();
  }

  function close() {
    dialogRef.current?.close();
    const finished = phase.name === "processing";
    setPhase({ name: "idle" });
    if (finished || phase.name === "upload-failed") router.refresh();
  }

  const busy = phase.name === "recording" || phase.name === "uploading";

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={start}
          className="flex w-full flex-col items-center gap-3 rounded-3xl bg-accent px-6 py-8 text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:text-background"
        >
          <MicIcon className="size-10" />
          <span className="text-xl font-semibold">{label}</span>
          <span className="text-sm opacity-85">Die Aufnahme startet sofort</span>
        </button>
      ) : (
        <button type="button" onClick={start} className={`${buttonClass("primary")} w-full`}>
          <MicIcon className="size-5" />
          {label}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="recording-title"
        onCancel={(event) => {
          // Escape soll keine laufende Aufnahme abbrechen
          event.preventDefault();
          if (!busy) close();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex h-full min-h-[28rem] flex-col gap-6 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <h2 id="recording-title" className="text-lg font-semibold">
            {entryId ? "Aufnahme fortsetzen" : "Neuer Eintrag"}
          </h2>

          {phase.name === "requesting" && (
            <>
              <Centered>
                <Spinner className="size-6" />
                <p role="status">Mikrofon wird freigegeben …</p>
                <p className="text-sm text-muted">
                  Falls dein Browser nachfragt, erlaube bitte den Zugriff auf das Mikrofon.
                </p>
              </Centered>
              <Button variant="ghost" onClick={close} className="w-full">
                Abbrechen
              </Button>
            </>
          )}

          {phase.name === "recording" && (
            <>
              <Centered>
                <span className="relative mb-6 flex size-28 items-center justify-center">
                  <span
                    ref={levelRef}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-record/25 transition-transform duration-75"
                  />
                  <span className="relative flex size-20 items-center justify-center rounded-full bg-record text-white">
                    <MicIcon className="size-9" />
                  </span>
                </span>
                <p className="font-mono text-4xl tabular-nums" role="timer" aria-label="Aufnahmedauer">
                  {formatClock(elapsed)}
                </p>
                <p className="text-sm text-muted" role="status">
                  {elapsed >= MAX_SECONDS - 120
                    ? "Die Aufnahme endet gleich automatisch. Du kannst danach eine weitere starten."
                    : "Aufnahme läuft. Lass den Bildschirm an und die App geöffnet."}
                </p>
              </Centered>
              <div className="space-y-3">
                <Button onClick={stop} className="w-full">
                  <span aria-hidden className="size-3.5 rounded-sm bg-current" />
                  Aufnahme beenden
                </Button>
                <Button variant="ghost" onClick={discard} className="w-full">
                  Verwerfen
                </Button>
              </div>
            </>
          )}

          {phase.name === "uploading" && (
            <Centered>
              <Spinner className="size-6" />
              <p role="status">Aufnahme wird hochgeladen …</p>
            </Centered>
          )}

          {phase.name === "upload-failed" && (
            <>
              <Centered>
                <ErrorMessage>{phase.message}</ErrorMessage>
              </Centered>
              <div className="space-y-3">
                <Button onClick={() => pendingRef.current && upload(pendingRef.current)} className="w-full">
                  Erneut versuchen
                </Button>
                <Button variant="ghost" onClick={close} className="w-full">
                  Später senden
                </Button>
              </div>
            </>
          )}

          {phase.name === "error" && (
            <>
              <Centered>
                <ErrorMessage>{phase.message}</ErrorMessage>
              </Centered>
              <Button variant="secondary" onClick={close} className="w-full">
                Schließen
              </Button>
            </>
          )}

          {phase.name === "processing" && (
            <Processing entryId={phase.entryId} recordingId={phase.recordingId} onClose={close} />
          )}
        </div>
      </dialog>
    </>
  );
}

function Processing({
  entryId,
  recordingId,
  onClose,
}: {
  entryId: string;
  recordingId: string;
  onClose: () => void;
}) {
  const entry = useLiveEntry(entryId);
  const recording = entry?.recordings.find((r) => r.id === recordingId);

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto">
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted">Das Wichtigste in Kürze</h3>
          {entry ? (
            <Summary entry={{ ...entry, summary: entry.summaryReady ? entry.summary : null }} />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner /> Aufnahme wird transkribiert …
            </p>
          )}
        </section>

        {recording?.transcript && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted">Dein Text</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{recording.transcript}</p>
          </section>
        )}
      </div>
      <Button variant={entry?.pending === false ? "primary" : "secondary"} onClick={onClose} className="w-full">
        {entry?.pending === false ? "Fertig" : "Schließen"}
      </Button>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">{children}</div>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
