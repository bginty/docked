import { sameOrigin } from "@/server/auth";
import {
  ownerMarketplace,
  changeOwnerMarketplace,
} from "@/server/owner-marketplace";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await ownerMarketplace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Owner marketplace report unavailable" },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403 });
  let applied = false;
  try {
    const text = new TextDecoder().decode(
      await boundedCommunityBody(request, 4096),
    );
    await changeOwnerMarketplace(JSON.parse(text));
    applied = true;
    return Response.json(await ownerMarketplace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        applied,
        error: applied
          ? "Change recorded. The ledger report is unavailable; refresh before resuming trading."
          : "Change not confirmed. Refresh the report before retrying.",
      },
      { status: applied ? 202 : 400 },
    );
  }
}
