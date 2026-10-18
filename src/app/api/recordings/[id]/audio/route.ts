import { assertUser, errorResponse, HttpError } from "@/lib/auth/guards";
import { getAccessibleRecording, isUuid } from "@/lib/entries";
import { presignDownload } from "@/lib/storage";

/** Prüft die Rechte und leitet auf eine kurzlebige Adresse im Speicher weiter. */
export async function GET(_request: Request, ctx: RouteContext<"/api/recordings/[id]/audio">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const recording = isUuid(id) ? await getAccessibleRecording(id, user) : null;
    if (!recording) throw new HttpError(404, "Aufnahme nicht gefunden");
    if (recording.audioDeletedAt) throw new HttpError(410, "Die Audiodatei wurde gelöscht");

    const url = recording.storageKeyMp3
      ? await presignDownload(recording.storageKeyMp3, "audio/mpeg")
      : await presignDownload(recording.storageKeyOriginal, recording.mimeType);

    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
