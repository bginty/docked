import { ownerOperations } from "@/server/owner-operations";
import { csv } from "@/core/owner-operations";
export async function GET(request: Request) {
  try {
    const q = Object.fromEntries(new URL(request.url).searchParams),
      { filters, data } = await ownerOperations(q);
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (q.format === "csv")
      return new Response(
        csv([
          [
            "scope",
            "edition",
            "player",
            "sport",
            "tier",
            "cap",
            "issued",
            "unissued",
          ],
          ...(data?.inventory ?? []).map((e) => [
            filters.scope,
            e.id,
            e.name,
            e.sport,
            e.tier,
            e.max_supply,
            e.issued,
            e.available_lifetime_supply,
          ]),
        ]),
        {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="docked-inventory.csv"',
          },
        },
      );
    return Response.json({ filters, data }, { headers });
  } catch {
    return Response.json(
      { error: "Owner access or report unavailable" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
