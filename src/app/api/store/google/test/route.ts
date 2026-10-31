import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { memberGoogleTest } from "@/server/member-google-test";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function unavailable() {
  return NextResponse.json(
    {
      error:
        "Google test purchasing is unavailable. No purchase fulfilment has been confirmed.",
    },
    { status: 403, headers },
  );
}
export async function GET() {
  try {
    return NextResponse.json(await (await memberGoogleTest()).session(), {
      headers,
    });
  } catch {
    return unavailable();
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return unavailable();
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    if (new URL(req.url).searchParams.get("action") === "reconcile") {
      if (!body || Array.isArray(body) || Object.keys(body).length)
        return unavailable();
      return NextResponse.json(await (await memberGoogleTest()).reconcile(), {
        headers,
      });
    }
    return NextResponse.json(await (await memberGoogleTest()).receipt(body), {
      headers,
    });
  } catch {
    return unavailable();
  }
}
