import { sportsBetaCapabilities } from "@/server/sports-private-beta";
import { sportSandbox } from "@/server/sport-sandbox";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { isBetaSport } from "@/core/sports-private-beta";
import { sportStandingRounds } from "@/core/sport-standings";
import { memberPrizes } from "@/server/member-release";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  let stage = "access";
  try {
    const allowed = await sportsBetaCapabilities();
    const url = new URL(req.url),
      sport = url.searchParams.get("sport");
    if (
      !["state", "standings", "prizes"].includes(
        url.searchParams.get("view") ?? "",
      )
    )
      return Response.json({ allowed }, { headers });
    if (!sport || !isBetaSport(sport) || !allowed.includes(sport))
      throw Error("Denied");
    stage = "state";
    const result = await sportSandbox(sport);
    if (url.searchParams.get("view") === "standings")
      return Response.json(
        { rounds: sportStandingRounds(result.state) },
        { headers },
      );
    if (url.searchParams.get("view") === "prizes")
      return Response.json(
        {
          ...result,
          prizes: (await memberPrizes()).filter((s) => s.sport === sport),
        },
        { headers },
      );
    return Response.json(result, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "Authentication required"
        ? 401
        : message === "Privileged MFA required" || message === "Denied"
          ? 403
          : 503;
    if (status === 503) {
      const code = (error as { code?: unknown } | null)?.code;
      console.error("sport_beta_read_failed", {
        stage,
        code:
          typeof code === "string" && /^[A-Z0-9_]{1,30}$/.test(code)
            ? code
            : "UNAVAILABLE",
      });
    }
    return Response.json(
      {
        allowed: [],
        error:
          status === 401
            ? "Please sign in again."
            : status === 403
              ? "Verified private beta access required."
              : "Unable to load this sport right now. Please retry.",
      },
      { status, headers },
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
