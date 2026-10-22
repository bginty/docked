import { sportsBetaCapabilities } from "@/server/sports-private-beta";
import { sportSandbox } from "@/server/sport-sandbox";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { isBetaSport } from "@/core/sports-private-beta";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const allowed = await sportsBetaCapabilities();
    const url = new URL(req.url),
      sport = url.searchParams.get("sport");
    if (url.searchParams.get("view") !== "state")
      return Response.json({ allowed }, { headers });
    if (!sport || !isBetaSport(sport) || !allowed.includes(sport))
      throw Error("Denied");
    return Response.json(await sportSandbox(sport), { headers });
  } catch {
    return Response.json(
      { allowed: [], error: "Verified private beta access required." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const sport = new URL(req.url).searchParams.get("sport");
    if (
      !sport ||
      !isBetaSport(sport) ||
      !(await sportsBetaCapabilities()).includes(sport)
    )
      return Response.json(
        { error: "Verified private beta access required." },
        { status: 403, headers },
      );
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 16384)),
    );
    return Response.json(await sportSandbox(sport, input), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Unable to save. Refresh and check positions, salary, duplicate players and lock time.",
      },
      { status: 409, headers },
    );
  }
}
