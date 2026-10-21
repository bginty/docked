import { requireRole, sameOrigin } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { setCommunityClaims } from "@/server/community-social";
import { boundedCommunityBody } from "@/core/community-social";
import { z } from "zod";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireRole(["owner"]);
    if (!(await rateLimit(`score-retry:${who.user.id}`, 6, 60)))
      return Response.json(
        { error: "Please wait before another retry." },
        { status: 429 },
      );
    const { competition } = z
      .object({ competition: z.string().uuid() })
      .strict()
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(req, 512)),
        ),
      );
    await db().begin(async (tx) => {
      await setCommunityClaims(tx, who);
      await tx`select sports_feed.request_round_retry(${competition}::uuid)`;
    });
    return Response.json(
      {
        message:
          "Retry queued for the next scheduled scoring run. Existing results are preserved.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Retry unavailable. Verified owner access and an unfinished round are required.",
      },
      { status: 403 },
    );
  }
}
