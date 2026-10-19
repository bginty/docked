import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { fantasyRequest } from "@/server/fantasy";
import { boundedCommunityBody } from "@/core/community-social";
import { fantasyFailureOutcome } from "@/core/fantasy-response";
import { ZodError } from "zod";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return NextResponse.json(await fantasyRequest(), { headers });
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        kind,
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : kind === "permission"
                ? "You don’t have access to this page."
                : "Docked could not refresh. Please retry.",
      },
      {
        status:
          kind === "authentication"
            ? 401
            : kind === "mfa" || kind === "permission"
              ? 403
              : 503,
        headers,
      },
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
