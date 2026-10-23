import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { weeklyCore } from "@/server/weekly-core";
import { boundedCommunityBody } from "@/core/community-social";
const headers = { "Cache-Control": "private, no-store" };
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    return NextResponse.json(
      await weeklyCore(
        undefined,
        new URL(req.url).searchParams.get("sport") ?? "nfl",
      ),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Weekly packs could not be checked. Sign in again or retry shortly.",
      },
      { status: 503, headers },
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
      new TextDecoder().decode(await boundedCommunityBody(req, 2048)),
    );
    return NextResponse.json(
      await weeklyCore(
        body,
        new URL(req.url).searchParams.get("sport") ?? body.sport ?? "nfl",
      ),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Opening could not be confirmed. Retry this pack to retrieve its saved result; it cannot award twice.",
      },
      { status: 400, headers },
    );
  }
}
