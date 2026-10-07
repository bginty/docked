import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { fantasyRequest } from "@/server/fantasy";
import { boundedCommunityBody } from "@/core/community-social";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return NextResponse.json(await fantasyRequest(), { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Fantasy Preview requires an active invited account and configured Preview services.",
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
    const raw = await boundedCommunityBody(request, 16384);
    return NextResponse.json(
      await fantasyRequest(JSON.parse(new TextDecoder().decode(raw))),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Action could not complete. Check credits, ownership, eligibility and round lock. No partial changes were saved.",
      },
      { status: 409, headers },
    );
  }
}
