import { sameOrigin } from "@/server/auth";
import { memberReleaseAdmin } from "@/server/member-release";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await memberReleaseAdmin(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Administrator MFA required or service unavailable" },
      { status: 403 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403 });
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 32768)),
    );
    return Response.json(await memberReleaseAdmin(body), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Change not confirmed. Check permissions, values and current revision, then refresh before retrying.",
      },
      { status: 400 },
    );
  }
}
