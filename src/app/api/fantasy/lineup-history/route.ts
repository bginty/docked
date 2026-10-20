import { NextResponse } from "next/server";
import { playStandings } from "@/server/postgame-results";
import { memberAccessFailure } from "@/core/member-access-recovery";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const id = new URL(request.url).searchParams.get("competition");
    const round = (await playStandings()).find((r) => r.competitionId === id);
    return NextResponse.json(
      {
        competition: id,
        finalised: round?.finalised ?? false,
        fixtures: round?.fixtures ?? [],
        serverTime: round?.serverTime ?? Date.now(),
        entry: round?.rows.find((r) => r.isMe) ?? null,
      },
      { headers },
    );
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : "Results are temporarily unavailable. Your entry is preserved.",
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
