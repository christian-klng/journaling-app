"use client";

import { useEffect, useState } from "react";
import type { EntryDto } from "@/lib/entries";

const POLL_MS = 2000;

/** Fragt den Eintrag so lange nach, bis alle Transkripte fertig sind. */
export function useLiveEntry(entryId: string, initial?: EntryDto) {
  const [entry, setEntry] = useState<EntryDto | null>(initial ?? null);
  const pending = entry?.pending ?? true;
  const hasInitial = initial !== undefined;

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/entries/${entryId}`, { cache: "no-store" });
        if (response.ok && !cancelled) setEntry(await response.json());
      } catch {
        // Kurz offline, beim nächsten Durchlauf erneut versuchen
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, hasInitial ? POLL_MS : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entryId, pending, hasInitial]);

  return entry;
}
