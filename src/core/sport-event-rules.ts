import {
  nrlEventVersion,
  nbaEventVersion,
} from "./additional-sport-statistics";
import { aflTwentyTwoRules } from "./afl-twenty-two";
import { nrlConfiguration, nbaConfiguration } from "./sport-configuration";
import { currentRulesets } from "./scoring-release";
import type { Rules } from "./scoring-v1";

/** Owner requested researched event scoring on 2026-10-22. These are new
 * templates, not a mutation of saved periods or permission to activate a sport. */
export function sportEventRules(
  sport: "afl" | "nrl" | "basketball" | "epl",
): Rules {
  if (sport === "afl") {
    const rules = aflTwentyTwoRules();
    return {
      ...rules,
      version: "docked-afl-22-events-v1",
      title: "Docked AFL · 22 players",
      policy: [
        rules.policy[0],
        "22 active cards: six backs, eight midfielders, six forwards, two rucks. Raw events, no match-wide scaling or proprietary ratings. Source connection and competition activation are separate.",
        ...rules.policy.slice(2),
      ],
    };
  }
  // Keep the existing explicit Docked EPL differences, including disciplinary
  // treatment. No silent upgrade to a newer external competition's rules.
  if (sport === "epl") return structuredClone(currentRulesets.epl);
  const config = sport === "nrl" ? nrlConfiguration : nbaConfiguration;
  const common = {
    sport,
    beta: true as const,
    positions: [...new Set(config.slots.flatMap((s) => s.positions))],
    slots: structuredClone(config.slots),
    correctionHours: 72,
    periodName: config.period,
  };
  if (sport === "nrl")
    return {
      ...common,
      version: nrlEventVersion,
      title: "Docked NRL · event scoring",
      weights: {
        tries: 800,
        goals: 200,
        fieldGoals: 500,
        tryAssists: 500,
        lineBreaks: 400,
        lineBreakAssists: 200,
        tackles: 100,
        tackleBreaks: 200,
        missedTackles: -200,
        offloadsToHand: 400,
        offloadsToGround: 200,
        errors: -200,
        fortyTwenties: 400,
        twentyForties: 400,
        runMetres: 100,
        kickMetres: 100,
        penaltiesConceded: -200,
        sixAgainInfringements: -100,
        sinBins: -500,
        sendOffs: -1000,
        trySaves: 500,
        kicksDefused: 100,
        forcedDropouts: 200,
        turnovers: 400,
        escapesInGoal: 200,
      },
      statisticGroups: { runMetres: 10, kickMetres: 30 },
      policy: [
        "Event values reference NRL Fantasy 2026 guidelines, reviewed 22 October 2026. Docked retains its own lineup and lock rules; no captain, emergency or bench scoring is added.",
        "Run and kick metres earn points only for complete groups of 10 and 30 respectively, calculated separately per match. Offloads to hand and ground are separate required statistics. One- and two-point field goals each earn 5 fantasy points.",
        "Use source-defined turnover events once: do not add an intercept and a strip again when they are already in the turnover total. Missing event fields are unavailable, never automatically zero. Explicit confirmed DNP/bye remains distinct.",
      ],
    };
  return {
    ...common,
    version: nbaEventVersion,
    title: "Docked NBA · event scoring",
    weights: {
      points: 100,
      rebounds: 100,
      assists: 200,
      steals: 300,
      blocks: 300,
      turnovers: 0,
      threePointers: 0,
    },
    policy: [
      "Event values reference NBA Fantasy Salary Cap scoring, reviewed 22 October 2026: points 1, rebound 1, assist 2, steal/block 3, no turnover penalty. Made threes are already in points and earn no extra bonus.",
      "Docked sums every frozen eligible match in the explicit weekly window; it does not select only a player's best game. Include overtime. No double/triple-double or captain bonus.",
      "Raw box-score fields are required. A verified all-zero performance is zero; missing data remains pending. Finalisation retains Docked's correction window and reviewer controls.",
    ],
  };
}

export const sportScoringReferences = {
  afl: "https://www.afl.com.au/news/1464392/afl-fantasy-for-dummies-how-to-play-scoring-system-more/amp",
  nrl: "https://fantasy.nrl.com/help/guidelines",
  basketball: "https://en.nbafantasy.nba.com/help/updates",
  epl: "https://www.premierleague.com/en/news/2174909",
};
