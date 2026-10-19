import { NextResponse } from "next/server";
import { memberMarketplace } from "@/server/marketplace";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { z } from "zod";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    return NextResponse.json(
      await memberMarketplace(new URL(req.url).searchParams),
      { headers },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const auth = /Authentication required/.test(message),
      denied =
        /admission|MFA|unavailable|revoked/i.test(message) &&
        !/service/i.test(message);
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid filters. Clear filters and retry."
            : auth
              ? "Sign in with your invited account."
              : denied
                ? "Market access is unavailable for this account. Owner accounts must complete MFA."
                : "Market service unavailable. Retry; your cards and credits are unchanged.",
      },
      {
        status: e instanceof z.ZodError ? 400 : auth ? 401 : denied ? 403 : 503,
        headers,
      },
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
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    const envelope = z
      .object({
        request: z.string().uuid(),
        command: z
          .object({
            kind: z.enum([
              "list",
              "reprice-listing",
              "cancel-listing",
              "review-buy",
              "buy",
            ]),
          })
          .passthrough(),
      })
      .strict()
      .parse(body);
    return NextResponse.json(
      await memberMarketplace(new URL(req.url).searchParams, envelope),
      { headers },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CreditsRejected
            ? e.message
            : e instanceof z.ZodError
              ? "Invalid listing details. Use a whole-credit price and refresh the listing."
              : "Unable to confirm. Retry the original request to check its receipt.",
        outcome:
          e instanceof CreditsRejected || e instanceof z.ZodError
            ? "rejected"
            : "unknown",
      },
      { status: 400, headers },
    );
  }
}
