import { NextResponse } from "next/server";
import { playStandings } from "@/server/postgame-results";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json({ rounds: await playStandings() }, { headers });
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : kind === "permission"
                ? "You do not have access to these results."
                : "Scores could not refresh. Your last result is still shown.",
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
