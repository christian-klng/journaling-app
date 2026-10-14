import { assertAdmin, errorResponse } from "@/lib/auth/guards";
import { formatIsoDate } from "@/lib/format";
import { buildStudyFile } from "@/lib/study/queries";

/** Lädt die Studienkonfiguration als JSON herunter, im selben Format wie der Import. */
export async function GET() {
  try {
    await assertAdmin();
    const file = await buildStudyFile();
    return new Response(JSON.stringify(file, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="studie_${formatIsoDate(new Date())}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
