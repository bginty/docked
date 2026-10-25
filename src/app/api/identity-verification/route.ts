import { sameOrigin } from "@/server/auth";
import { redemptionSource } from "@/server/redemptions";
import { boundedCommunityBody } from "@/core/community-social";
import { identityCaseCommand } from "@/core/manual-identity";
import { z } from "zod";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(req: Request) {
  try {
    const data = await redemptionSource(
      new URL(req.url).searchParams.get("admin") === "true",
    );
    return Response.json(data.verification, { headers });
  } catch {
    return Response.json(
      { error: "Identity verification is unavailable for this session." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const body = z
      .object({ request: z.string().uuid(), case: identityCaseCommand })
      .strict()
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
        ),
      );
    const data = await redemptionSource(
      new URL(req.url).searchParams.get("admin") === "true",
      {
        request: body.request,
        operation: { action: "identity-case", case: body.case },
      },
    );
    return Response.json(data.verification, { headers });
  } catch {
    return Response.json(
      {
        error:
          "The case could not be updated. Refresh to check its status, then retry. Real ID collection is disabled.",
      },
      { status: 400, headers },
    );
  }
}
