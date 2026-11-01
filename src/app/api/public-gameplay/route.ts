import { publicGameplay } from "@/server/public-gameplay";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { sportStandingRounds } from "@/core/sport-standings";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const url = new URL(req.url),
      result = await publicGameplay(url.searchParams.get("sport"));
    return Response.json(
      url.searchParams.get("view") === "standings" &&
        "state" in result &&
        result.state
        ? { rounds: sportStandingRounds(result.state) }
        : result,
      { headers },
    );
  } catch (error) {
    const auth =
      error instanceof Error && error.message === "Authentication required";
    return Response.json(
      {
        error: auth
          ? "Please sign in again."
          : "This sport is unavailable. Check your account eligibility and retry.",
      },
      { status: auth ? 401 : 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const sport = new URL(req.url).searchParams.get("sport");
    if (!sport) throw Error("Sport required");
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 16384)),
    );
    return Response.json(await publicGameplay(sport, input), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Unable to save. Refresh and check account eligibility, positions, salary, duplicate players and lock time.",
      },
      { status: 409, headers },
    );
  }
}
