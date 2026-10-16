import { sameOrigin } from "@/server/auth";
import { checkOwnerHealth } from "@/server/owner-health";
import { boundedCommunityBody } from "@/core/community-social";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 1024)),
    );
    return Response.json(await checkOwnerHealth(body), { headers });
  } catch (error) {
    const denied = /Authentication|MFA|Role denied/.test(
      error instanceof Error ? error.message : "",
    );
    return Response.json(
      {
        error:
          "Health check could not be recorded. Owner MFA is required; retry shortly.",
      },
      { status: denied ? 403 : 503, headers },
    );
  }
}
