import { nbaBetaCapability } from "@/server/nba-private-beta";
import { sportSandbox } from "@/server/sport-sandbox";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    if (!(await nbaBetaCapability())) throw Error("Access denied");
    return Response.json(
      new URL(req.url).searchParams.get("view") === "state"
        ? await sportSandbox("basketball")
        : { allowed: true },
      { headers },
    );
  } catch {
    return Response.json(
      {
        allowed: false,
        error:
          "NBA testing requires an authorised, verified beta account and any required MFA.",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    if (!(await nbaBetaCapability()))
      return Response.json(
        { error: "Access denied" },
        { status: 403, headers },
      );
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 16384)),
    );
    return Response.json(await sportSandbox("basketball", input), { headers });
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
