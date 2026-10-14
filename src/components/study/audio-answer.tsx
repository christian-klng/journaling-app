"use client";

import { useState } from "react";
import { removePending, savePending, uploadRecording, type PendingUpload } from "@/lib/client/pending-uploads";
import { formatClock } from "@/lib/format";
import { Button, ErrorMessage, Spinner } from "../ui";
import { MicIcon } from "./mic-icon";
import { MAX_SECONDS, useRecorder } from "./use-recorder";

type UploadState =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "failed"; message: string; pending: PendingUpload };

/**
 * Aufnahme als Antwort auf eine Audio-Frage, direkt im Ablauf. Bricht der Upload ab, bleibt die
 * Aufnahme auf dem Gerät und lässt sich erneut senden.
 */
export function AudioAnswer({
  entryId,
  itemId,
  count,
  onUploaded,
  onBusyChange,
}: {
  entryId: string;
  itemId: string;
  count: number;
  onUploaded: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [upload, setUpload] = useState<UploadState>({ name: "idle" });

  async function send(pending: PendingUpload) {
    setUpload({ name: "uploading" });
    onBusyChange(true);
    try {
      await uploadRecording(pending);
      setUpload({ name: "idle" });
      onUploaded();
    } catch (error) {
      const status = (error as { status?: number }).status;
      // Bei 4xx hilft Wiederholen nicht
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 408) await removePending(pending.id);
      setUpload({
        name: "failed",
        pending,
        message:
          "Die Aufnahme konnte nicht hochgeladen werden. Sie ist auf diesem Gerät gesichert. Prüfe deine Verbindung und versuche es erneut.",
      });
    } finally {
      onBusyChange(false);
    }
  }

  const recorder = useRecorder((blob, durationMs) => {
    const pending: PendingUpload = { id: crypto.randomUUID(), entryId, itemId, blob, durationMs, createdAt: Date.now() };
    void savePending(pending).then(() => send(pending));
  });
  const { phase, elapsed, levelRef } = recorder;

  function start() {
    onBusyChange(true);
    void recorder.start();
  }

  function stop() {
    recorder.stop();
  }

  function discard() {
    if (elapsed >= 5 && !window.confirm("Aufnahme wirklich verwerfen?")) return;
    recorder.discard();
    onBusyChange(false);
  }

  if (phase.name === "requesting") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Spinner className="size-6" />
        <p role="status">Mikrofon wird freigegeben …</p>
        <p className="text-sm text-muted">Falls dein Browser nachfragt, erlaube bitte den Zugriff auf das Mikrofon.</p>
        <Button variant="ghost" onClick={discard}>
          Abbrechen
        </Button>
      </div>
    );
  }

  if (phase.name === "recording") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="relative flex size-24 items-center justify-center">
          <span
            ref={levelRef}
            aria-hidden
            className="absolute inset-0 rounded-full bg-record/25 transition-transform duration-75"
          />
          <span className="relative flex size-16 items-center justify-center rounded-full bg-record text-white">
            <MicIcon className="size-8" />
          </span>
        </span>
        <p className="font-mono text-3xl tabular-nums" role="timer" aria-label="Aufnahmedauer">
          {formatClock(elapsed)}
        </p>
        <p className="text-sm text-muted" role="status">
          {elapsed >= MAX_SECONDS - 120
            ? "Die Aufnahme endet gleich automatisch. Du kannst danach eine weitere anhängen."
            : "Aufnahme läuft. Lass den Bildschirm an und die App geöffnet."}
        </p>
        <div className="w-full space-y-2">
          <Button onClick={stop} className="w-full">
            <span aria-hidden className="size-3.5 rounded-sm bg-current" />
            Aufnahme beenden
          </Button>
          <Button variant="ghost" onClick={discard} className="w-full">
            Verwerfen
          </Button>
        </div>
      </div>
    );
  }

  if (upload.name === "uploading") {
    return (
      <p className="flex items-center justify-center gap-2 py-6" role="status">
        <Spinner /> Aufnahme wird hochgeladen …
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {count > 0 && (
        <p className="flex items-center gap-2 font-medium text-accent" role="status">
          <span aria-hidden>✓</span>
          {count === 1 ? "Aufnahme gespeichert" : `${count} Aufnahmen gespeichert`}
        </p>
      )}
      {phase.name === "error" && <ErrorMessage>{phase.message}</ErrorMessage>}
      {upload.name === "failed" ? (
        <>
          <ErrorMessage>{upload.message}</ErrorMessage>
          <Button onClick={() => send(upload.pending)} className="w-full">
            Erneut versuchen
          </Button>
        </>
      ) : (
        <Button variant={count > 0 ? "secondary" : "primary"} onClick={start} className="w-full">
          <MicIcon className="size-5" />
          {count > 0 ? "Weitere Aufnahme anhängen" : "Antwort aufnehmen"}
        </Button>
      )}
    </div>
  );
}
