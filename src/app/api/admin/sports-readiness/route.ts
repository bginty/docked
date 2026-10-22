import { sportReadiness } from "@/server/sport-readiness";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return Response.json(await sportReadiness(), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Readiness unavailable. Owner MFA, beta access and the readiness migration are required.",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 4096)),
    );
    return Response.json(await sportReadiness(input), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Decision not recorded. Refresh the package and check the evidence, owner access and MFA.",
      },
      { status: 409, headers },
    );
  }
}
