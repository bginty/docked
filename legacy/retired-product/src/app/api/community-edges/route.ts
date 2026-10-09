import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, requireIdentity } from "@/server/auth";
import {
  CommunityEdgeError,
  communityQuoteOptions,
  getCommunityEdge,
  listCommunityEdges,
  reviewCommunityEdge,
  submitCommunityEdge,
} from "@/server/community-edges";
import { recordAnalytics } from "@/server/analytics";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const view = params.get("view");
    const data =
      view === "options"
        ? await communityQuoteOptions()
        : params.get("id")
          ? await getCommunityEdge(z.string().uuid().parse(params.get("id")))
          : await listCommunityEdges({
              profileId: params.get("profileId")
                ? z.string().uuid().parse(params.get("profileId"))
                : undefined,
              sport: params.get("sport") ?? undefined,
              competition: params.get("competition") ?? undefined,
              following: params.get("following") === "true",
              settled: params.get("settled") === "true",
              before: params.get("before") ?? undefined,
            });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Community records are unavailable." },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  let actor: string | undefined;
  try {
    const who = await requireIdentity();
    actor = who.user.id;
    if (!(await rateLimit(`community-edge-body:${who.user.id}`, 40)))
      throw new Error("Rate limit");
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 12000)),
    );
    if (!body || typeof body !== "object") throw new Error("Invalid request");
    const { action, ...input } = body;
    if (action === "review")
      return NextResponse.json({
        ok: true,
        review: await reviewCommunityEdge(input),
      });
    if (action !== "submit") throw new Error("Unsupported community action");
    const { id, created } = await submitCommunityEdge(input);
    if (created) await recordAnalytics(who.user.id, "community_edge_submitted");
    return NextResponse.json({
      ok: true,
      id,
      edgeId: id,
      message: "Permanent verified community Edge submitted.",
    });
  } catch (error) {
    if (actor)
      await recordAnalytics(
        actor,
        error instanceof CommunityEdgeError && error.code === "PRICE_MOVED"
          ? "community_price_moved"
          : error instanceof CommunityEdgeError &&
              error.code === "PROMOTIONAL_EXCLUDED"
            ? "community_promo_excluded"
            : "community_edge_rejected",
      );
    if (error instanceof CommunityEdgeError)
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: error.message,
          current: error.current,
          previousOdds: error.previousOdds,
        },
        {
          status:
            error.code === "PRICE_MOVED" ||
            error.code === "IDEMPOTENCY_CONFLICT"
              ? 409
              : 422,
        },
      );
    return NextResponse.json(
      {
        ok: false,
        error:
          "Submission unavailable. Confirm eligibility, a current verified price and the permanent-record acknowledgement.",
      },
      { status: 400 },
    );
  }
}
