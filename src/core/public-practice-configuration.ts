import { nflSeven } from "./nfl-seven";
import { approvedAustralianLineup } from "./approved-australian-rules";
import type { PublicSport } from "./public-customer";

export function publicPracticeLineup(sport: PublicSport) {
  return sport === "nfl"
    ? {
        ...nflSeven,
        version: "public-nfl-round-wide-practice-v1",
        lockPolicy: "round-wide-v1",
        salaryUnit: "fantasy-dollars",
      }
    : approvedAustralianLineup(sport);
}

/** Dated roster practice only. Never inherits an old round's entry fee/prizes. */
export function publicPracticeRules(
  source: { rules: Record<string, unknown>; scoring_version: string },
  sport: PublicSport,
  mode: "SALARY_CAP" | "OPEN",
  version: string,
  authority: string,
) {
  const config = publicPracticeLineup(sport);
  return {
    ...source.rules,
    mode,
    lineup_version: config.version,
    scoring_version: source.scoring_version,
    inventory_scope: config.inventoryScope,
    free_core_policy: "public-free-core-v1",
    public_access_policy: "au-adult-free-play-v1",
    entry_fee_credits: 0,
    lock_policy: "round-wide-v1",
    public_template_version: version,
    synthetic: true,
    authority,
    round_reward_policy: {
      version: "public-no-prizes-v1",
      active: false,
      items: [],
      tiePolicy: null,
    },
  };
}
