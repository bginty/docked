import { NextResponse } from "next/server";
import { fantasyRequest } from "@/server/fantasy";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { rateLimit } from "@/server/db";
import { recommendOwnedLineup } from "@/core/owned-lineup-recommendation";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { z } from "zod";
const fillRequest = z
  .object({
    competition: z.string().uuid(),
    picks: z
      .array(
        z
          .object({
            slot: z.string().min(1).max(30),
            card: z.string().min(1).max(160),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export const runtime = "nodejs";
async function recommend(request: Request, submittedDraft: boolean) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (submittedDraft && !sameOrigin(request))
      return NextResponse.json(
        { error: "Origin denied" },
        { status: 403, headers },
      );
    const input = submittedDraft
      ? fillRequest.safeParse(
          JSON.parse(
            new TextDecoder().decode(await boundedCommunityBody(request, 8192)),
          ),
        )
      : null;
    if (input && !input.success)
      return NextResponse.json(
        { error: "Choose a round and valid draft selections." },
        { status: 400, headers },
      );
    const id = input?.success
      ? input.data.competition
      : new URL(request.url).searchParams.get("competition");
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
    const now = Date.now();
    let recommendation;
    try {
      // Configured salaries and stable card IDs suffice; no provider or invented projections.
      recommendation = recommendOwnedLineup(
        state,
        round.id,
        {},
        now,
        input?.success ? input.data.picks : undefined,
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The current draft cannot be filled.",
        },
        { status: 409, headers },
      );
    }
    return NextResponse.json(
      {
        competition: round.id,
        member: state.user_id,
        asOf: new Date(now).toISOString(),
        method: "owned-eligible-salary-stable-id-v1",
        recommendation,
      },
      { headers },
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Request too large")
    )
      return NextResponse.json(
        { error: "Choose a round and valid draft selections." },
        { status: 400, headers },
      );
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Please complete secure verification."
              : "Lineup eligibility could not be checked. Your draft has not changed.",
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
/** Older open tabs may still request the saved draft; neither endpoint saves or enters. */
export function GET(request: Request) {
  return recommend(request, false);
}
export function POST(request: Request) {
  return recommend(request, true);
}
