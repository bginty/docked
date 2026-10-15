import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { redemptionSource } from "@/server/redemptions";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { ZodError } from "zod";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    return NextResponse.json(
      await redemptionSource(
        new URL(req.url).searchParams.get("admin") === "true",
      ),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Withdrawals unavailable for this session.",
        outcome: "rejected",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origin denied", outcome: "rejected" },
      { status: 403, headers },
    );
  try {
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    return NextResponse.json(
      await redemptionSource(
        new URL(req.url).searchParams.get("admin") === "true",
        input,
      ),
      { headers },
    );
  } catch (e) {
    const rejected =
      e instanceof CreditsRejected ||
      e instanceof ZodError ||
      process.env.DOCKED_REDEMPTION_LOCAL !== "true";
    return NextResponse.json(
      {
        error:
          e instanceof CreditsRejected
            ? e.message
            : rejected
              ? "Redemption is disabled or this request is invalid."
              : "Could not confirm the outcome. Retry the same request to recover it.",
        outcome: rejected ? "rejected" : "unknown",
      },
      { status: 400, headers },
    );
  }
}
