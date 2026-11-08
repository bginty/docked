import "server-only";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { setSportBetaContext } from "./sports-private-beta";
import { publishedSportScoringHistory } from "./nfl-scoring-history";
import { publicCustomersEnabled } from "@/core/public-customer";
import {
  scoringHistoryQuery,
  sportReferenceRules,
  type SportScoringHistory,
} from "@/core/sport-scoring-history";
import manifest from "../../config/hosted-production.json";

export async function readSportScoringHistory(
  input: unknown,
): Promise<SportScoringHistory> {
  const query = scoringHistoryQuery.parse(input);
  const who = await requireIdentity();
  if (!(await rateLimit(`scoring-history:${who.user.id}`, 60, 60)))
    throw Error("Please wait before retrying");
  await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    if (publicCustomersEnabled()) {
      await tx`select set_config('docked.public_gameplay','enabled',true)`;
      const allowed = (
        await tx`select public_gameplay.capabilities() allowed`
      )[0].allowed as string[];
      if (!allowed.includes(query.sport)) throw Error("Sport access required");
    } else if (query.sport === "nfl") {
      await tx`select set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef},true)`;
      // Reuse the exact security-definer history gate already granted to this
      // runtime. An empty reference has no matching player; the function still
      // verifies admission, current session and feature/channel restrictions.
      // Do not grant direct execution of the private eligibility helper.
      await tx`select sports_feed.card_player_history('docked:scoring-reference-access')`;
    } else {
      await setSportBetaContext(tx, query.sport);
      if (
        (
          await tx`select sports_feed.private_beta_sport_capability() allowed`
        )[0].allowed !== true
      )
        throw Error("Sport access required");
    }
  });
  if (query.sport === "nfl" && process.env.NFL_HISTORY_READ_ENABLED === "true")
    return publishedSportScoringHistory(query);
  return {
    sport: query.sport,
    rules: sportReferenceRules(query.sport),
    rounds: [],
    season: null,
    round: null,
    lastSuccess: null,
    rows: [],
    page: 0,
    total: 0,
    hasMore: false,
    unavailable:
      query.sport === "nfl"
        ? "Player statistics are not available right now."
        : "Verified player statistics are not available yet. Match results are available separately; they are not player fantasy scores.",
  };
}
