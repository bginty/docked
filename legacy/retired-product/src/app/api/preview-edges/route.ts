import { NextResponse } from "next/server";
import { requireIdentity, sameOrigin } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import { previewPriceLabel } from "@/core/preview-market-contracts";
import {
  previewEdgeOptions,
  reviewPreviewEdge,
  submitPreviewEdge,
} from "@/server/preview-edges";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET() {
  try {
    return NextResponse.json(await previewEdgeOptions(), { headers });
  } catch {
    return NextResponse.json(
      {
        status: "RESTRICTED",
        label: previewPriceLabel,
        message:
          "Preview fixture access requires an active invitation and test entitlement.",
        options: [],
        records: [],
      },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const who = await requireIdentity();
    if (!(await rateLimit(`preview-edge:${who.user.id}`, 20)))
      throw new Error("Rate limit");
    const { action, ...input } = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 3000)),
    );
    if (action === "review")
      return NextResponse.json(
        {
          ok: true,
          review: await reviewPreviewEdge(input),
          label: previewPriceLabel,
        },
        { headers },
      );
    if (action !== "submit") throw new Error("Unsupported preview action");
    return NextResponse.json(
      { ok: true, ...(await submitPreviewEdge(input)) },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        label: previewPriceLabel,
        error:
          "Preview action unavailable. Confirm your entitlement, then review the DEMO price again before submitting.",
      },
      { status: 400, headers },
    );
  }
}
