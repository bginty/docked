import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { fantasyRequest } from "@/server/fantasy";
import { boundedCommunityBody } from "@/core/community-social";
import { fantasyFailureOutcome } from "@/core/fantasy-response";
import { ZodError } from "zod";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return NextResponse.json(await fantasyRequest(), { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Fantasy requires an eligible verified account, current consent and configured services.",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied", outcome: "rejected" },
      { status: 403, headers },
    );
  let input: unknown;
  try {
    const raw = await boundedCommunityBody(request, 16384);
    input = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", outcome: "rejected" },
      { status: 400, headers },
    );
  }
  try {
    return NextResponse.json(await fantasyRequest(input), { headers });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid action fields", outcome: "rejected" },
        { status: 400, headers },
      );
    const failure = fantasyFailureOutcome(error);
    return NextResponse.json(
      { error: failure.error, outcome: failure.outcome },
      { status: failure.status, headers },
    );
  }
}
