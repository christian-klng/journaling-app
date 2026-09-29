// Aufnahmen bleiben im Browser gespeichert, bis der Server sie bestätigt hat.
// So geht bei einem Funkloch oder geschlossenem Tab nichts verloren.

export type PendingUpload = {
  id: string;
  entryId: string | null;
  blob: Blob;
  durationMs: number;
  createdAt: number;
};

const DB_NAME = "rueckblick";
const STORE = "pending-uploads";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

// Speichern ist nur ein Sicherheitsnetz. Schlägt es fehl (z. B. privater Modus), läuft der Upload trotzdem.
export async function savePending(upload: PendingUpload) {
  try {
    await run("readwrite", (store) => store.put(upload));
  } catch {}
}

export async function removePending(id: string) {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {}
}

export async function listPending(): Promise<PendingUpload[]> {
  try {
    return await run<PendingUpload[]>("readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

export async function uploadRecording(upload: PendingUpload) {
  const body = new FormData();
  body.set("file", upload.blob);
  body.set("recordingId", upload.id);
  body.set("durationMs", String(upload.durationMs));
  if (upload.entryId) body.set("entryId", upload.entryId);

  const response = await fetch("/api/recordings", { method: "POST", body });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.error ?? "Upload fehlgeschlagen") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  await removePending(upload.id);
  return (await response.json()) as { entryId: string; recordingId: string };
}
