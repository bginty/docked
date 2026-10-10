import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { sandboxSwaps } from "@/server/sandbox-swaps";
import { boundedCommunityBody } from "@/core/community-social";
const headers = { "Cache-Control": "private, no-store" };
const safeMessages = new Set([
  "Two-person sandbox unavailable",
  "Other participant has not completed admission",
  "Swap participant unavailable",
  "Card ownership changed",
  "Open the pack before swapping",
  "Remove card from unsettled lineup before swapping",
  "Fee changed; review again",
  "Offer expired; request a new offer",
  "Stale card ownership; create a new offer",
  "Insufficient simulated balance",
  "Swap already completed",
  "Swap permission denied",
  "Owner MFA required",
  "Review the participant fee",
]);
function failure(e: unknown) {
  const message =
    e instanceof Error && safeMessages.has(e.message)
      ? e.message
      : "Swap could not be confirmed. Refresh to check its receipt before trying again.";
  return NextResponse.json({ error: message }, { status: 400, headers });
}
export async function GET() {
  try {
    return NextResponse.json(await sandboxSwaps(), { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const raw = await boundedCommunityBody(request, 4096);
    return NextResponse.json(
      await sandboxSwaps(JSON.parse(new TextDecoder().decode(raw))),
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
