import { NextResponse } from "next/server";
import { fantasyRequest } from "@/server/fantasy";
import { publishedLineupRanks } from "@/server/nfl-player-history";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { rateLimit } from "@/server/db";
import { recommendOwnedLineup } from "@/core/owned-lineup-recommendation";
import { hasEstablishedTeam } from "@/core/team-continuity";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const id = new URL(request.url).searchParams.get("competition");
    // Existing authenticated read enforces admission, MFA and per-account secrecy.
    const { state } = await fantasyRequest();
    if (!(await rateLimit(`auto-select:${state.user_id}`, 12, 60)))
      return NextResponse.json(
        { error: "Please wait a moment before trying Auto Select again." },
        { status: 429, headers },
      );
    const round = state.competitions.find((c) => c.id === id);
    if (
      !round ||
      !state.seven?.configurations[String(round.rules.lineup_version)] ||
      round.rules.disabled ||
      round.scored_at
    )
      return NextResponse.json(
        { error: "This competition is unavailable for Auto Select." },
        { status: 409, headers },
      );
    if (
      hasEstablishedTeam(state, round.sport ?? "nfl", String(round.rules.mode))
    )
      return NextResponse.json(
        {
          error:
            "Your team is established. Replace individual players manually.",
        },
        { status: 409, headers },
      );
    const players = state.seven.inventory
      .filter((c) => c.owner_id === state.user_id && c.sport === "nfl")
      .map((c) => c.canonical_player_id ?? c.player_id);
    const now = Date.now();
    const history = await publishedLineupRanks(
      players,
      round.season,
      round.round,
      now,
    );
    return NextResponse.json(
      {
        competition: round.id,
        member: state.user_id,
        asOf: history.asOf,
        recommendation: recommendOwnedLineup(
          state,
          round.id,
          history.ranks,
          now,
        ),
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
              ? "Please complete secure verification."
              : "Verified player history is unavailable. Your lineup has not changed.",
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
