import { assertUser, errorResponse, HttpError } from "@/lib/auth/guards";
import { getAccessibleEntry, isUuid, toEntryDto } from "@/lib/entries";

export async function GET(_request: Request, ctx: RouteContext<"/api/entries/[id]">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const entry = isUuid(id) ? await getAccessibleEntry(id, user) : null;
    if (!entry) throw new HttpError(404, "Eintrag nicht gefunden");

    return Response.json(toEntryDto(entry), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
