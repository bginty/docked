import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { memberTestWallet } from "@/server/member-test-wallet";
import { boundedCommunityBody } from "@/core/community-social";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { ZodError } from "zod";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return NextResponse.json(await memberTestWallet(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Test wallet requires your invited account." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    return NextResponse.json(await memberTestWallet(body), { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unable to complete this test transaction. Refresh to check its status; retrying the same request will not charge twice.",
        outcome:
          error instanceof CreditsRejected || error instanceof ZodError
            ? "rejected"
            : "unknown",
      },
      { status: 400, headers },
    );
  }
}
