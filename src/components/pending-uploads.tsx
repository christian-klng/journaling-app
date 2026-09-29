"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listPending, removePending, uploadRecording, type PendingUpload } from "@/lib/client/pending-uploads";
import { formatDuration, formatShortDate, formatTime } from "@/lib/format";
import { Button, Card, ErrorMessage } from "./ui";

/** Zeigt Aufnahmen, die beim letzten Mal nicht hochgeladen werden konnten. */
export function PendingUploads() {
  const router = useRouter();
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPending().then((list) => {
      if (!cancelled) setUploads(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (uploads.length === 0) return null;

  const forget = (id: string) => setUploads((list) => list.filter((u) => u.id !== id));

  async function send(upload: PendingUpload) {
    setBusyId(upload.id);
    setError(null);
    try {
      await uploadRecording(upload);
      forget(upload.id);
      router.refresh();
    } catch {
      setError("Der Upload hat nicht geklappt. Bitte prüfe deine Verbindung.");
    } finally {
      setBusyId(null);
    }
  }

  async function discard(upload: PendingUpload) {
    if (!window.confirm("Diese Aufnahme endgültig verwerfen?")) return;
    await removePending(upload.id);
    forget(upload.id);
  }

  return (
    <Card className="space-y-3 border-accent/40">
      <h2 className="font-semibold">Noch nicht hochgeladen</h2>
      <ul className="space-y-3">
        {uploads.map((upload) => (
          <li key={upload.id} className="space-y-2">
            <p className="text-sm text-muted">
              Aufnahme vom {formatShortDate(new Date(upload.createdAt))},{" "}
              {formatTime(new Date(upload.createdAt))} · {formatDuration(upload.durationMs / 1000)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => send(upload)} disabled={busyId !== null}>
                {busyId === upload.id ? "Wird gesendet …" : "Jetzt senden"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => discard(upload)} disabled={busyId !== null}>
                Verwerfen
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorMessage>{error}</ErrorMessage>
    </Card>
  );
}
