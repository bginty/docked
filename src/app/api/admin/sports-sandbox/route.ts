import { sportSandbox } from "@/server/sport-sandbox";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    return Response.json(
      await sportSandbox(new URL(req.url).searchParams.get("sport") ?? "afl"),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Isolated Preview, staff MFA and sandbox access are required." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 16384)),
    );
    return Response.json(await sportSandbox(input.sport, input), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Unable to save. Refresh the round and check access, ownership, positions and lock time before retrying.",
      },
      { status: 409, headers },
    );
  }
}
