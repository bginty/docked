import { sameOrigin } from "@/server/auth";
import { publicOwnerSupport } from "@/server/public-owner-support";
import { boundedCommunityBody } from "@/core/community-social";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 4096)),
    );
    return Response.json(await publicOwnerSupport(input), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Support action unavailable. Reload the record and check current permissions before retrying.",
      },
      { status: 403, headers },
    );
  }
}
