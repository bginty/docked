import { z } from "zod";
import { nflOffensiveStats, scoreNflOffense } from "./fantasy-nfl";

export const sports = ["epl", "nfl", "afl"] as const;
export type Sport = (typeof sports)[number];
const count = z.number().int().min(0).max(1000);
export const eplStats = z
  .object({
    regulationSeconds: z.number().int().min(0).max(5400),
    playedSeconds: z.number().int().min(0).max(8000),
    goals: count,
    assists: count,
    saves: count,
    penaltySaves: count,
    penaltiesMissed: count,
    yellowCards: z.number().int().min(0).max(2),
    dismissal: z.enum(["none", "straight-red", "second-yellow"]),
    ownGoals: count,
    concededOnPitch: count,
    onPitchEvidence: z.literal("ordered-events-verified"),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.playedSeconds < s.regulationSeconds)
      ctx.addIssue({
        code: "custom",
        message: "Total played time cannot be shorter than regulation time",
      });
    if ((s.dismissal === "second-yellow") !== (s.yellowCards === 2))
      ctx.addIssue({
        code: "custom",
        message: "Second-yellow evidence must include exactly two yellows",
      });
    if (s.penaltySaves > s.saves)
      ctx.addIssue({
        code: "custom",
        message: "Penalty saves are included in total saves",
      });
  });
export const aflStats = z
  .object({
    kicks: count,
    handballs: count,
    marks: count,
    tackles: count,
    goals: count,
    behinds: count,
    hitouts: count,
    freesFor: count,
    freesAgainst: count,
  })
  .strict();
// Reuse Docked's existing individual-offence schema; no team-defence cards.
export const nflStats = nflOffensiveStats
  .extend({ offensiveFumbleRecoveryTouchdowns: count })
  .strict();
export type Part = { statistic: string; quantity: number; centipoints: number };
export type Rules = {
  sport: Sport;
  version: string;
  title: string;
  beta: true;
  positions: string[];
  slots: { id: string; positions: string[] }[];
  weights: Record<string, number>;
  goal?: Record<string, number>;
  clean?: Record<string, number>;
  correctionHours: number;
  periodName: string;
  policy: string[];
};
const slots = (position: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${position}${i + 1}`,
    positions: [position],
  }));
export const rulesets: Record<Sport, Rules> = {
  epl: {
    sport: "epl",
    version: "docked-epl-beta-v1",
    title: "Docked EPL Scoring v1",
    beta: true,
    positions: ["GK", "DEF", "MID", "FWD"],
    slots: [
      ...slots("GK", 1),
      ...slots("DEF", 4),
      ...slots("MID", 4),
      ...slots("FWD", 2),
    ],
    weights: {
      shortAppearance: 100,
      fullAppearance: 200,
      assists: 300,
      savesPerThree: 100,
      penaltySaves: 500,
      penaltiesMissed: -200,
      yellowCards: -100,
      dismissal: -300,
      ownGoals: -200,
      concededPerTwo: -100,
    },
    goal: { GK: 600, DEF: 600, MID: 500, FWD: 400 },
    clean: { GK: 400, DEF: 400, MID: 100, FWD: 0 },
    correctionHours: 72,
    periodName: "gameweek",
    policy: [
      "Appearance: more than 0 and under 60 regulation minutes = 1; 60+ = 2 total. Added time does not count toward 60; goals and disciplinary events in added time count.",
      "Goals: GK/DEF 6, MID 5, FWD 4. Assists 3. Synthetic assists mean the final deliberate teammate touch directly creating a goal, excluding own-goal, rebound and materially deflected assists. A live adapter must document its provider definition before activation.",
      "Clean sheet: 60+ regulation minutes, no concession during verified on-pitch intervals, and no dismissal: GK/DEF 4, MID 1, FWD 0. Substituted players retain this if a goal is conceded after they leave. Dismissed players receive no clean-sheet points.",
      "GK saves: 1 per complete 3 (penalty saves included), plus 5 per penalty save. Penalty missed -2, own goal -2. GK/DEF lose 1 per complete 2 goals conceded while on pitch, including own goals. No post-dismissal concessions counted.",
      "Yellow -1; straight red -3 in addition to an earlier single yellow. A second-yellow dismissal replaces BOTH yellow penalties with one -3 dismissal penalty. This is a Docked choice, not exact FPL compatibility.",
      "On-pitch event order and substitution/dismissal boundaries must be verified; equal-minute unordered events are insufficient. No events or minutes are guessed from full-match team scores. No bonus ratings or tackle/interception points.",
    ],
  },
  nfl: {
    sport: "nfl",
    version: "docked-nfl-half-ppr-beta-v1",
    title: "Docked NFL Scoring v1 · half-PPR",
    beta: true,
    positions: ["QB", "RB", "WR", "TE"],
    slots: [
      ...slots("QB", 1),
      ...slots("RB", 2),
      ...slots("WR", 2),
      ...slots("TE", 1),
      { id: "FLEX1", positions: ["RB", "WR", "TE"] },
    ],
    weights: {
      passing_yards: 4,
      passing_touchdowns: 400,
      interceptions_thrown: -200,
      rushing_yards: 10,
      rushing_touchdowns: 600,
      receptions: 50,
      receiving_yards: 10,
      receiving_touchdowns: 600,
      fumbles_lost: -200,
      passing_two_point_conversions: 200,
      rushing_two_point_conversions: 200,
      receiving_two_point_conversions: 200,
      kickoff_return_touchdowns: 600,
      punt_return_touchdowns: 600,
      offensiveFumbleRecoveryTouchdowns: 600,
    },
    correctionHours: 96,
    periodName: "week",
    policy: [
      "Half-PPR: reception 0.5. Passing yards 0.04 each; passing TD 4; interception thrown -2. Rushing/receiving yards 0.1 each and TDs 6. Negative yards subtract proportionally; no yardage thresholds or bonuses.",
      "Fumble lost -2 (all phases, once). Passing, rushing or receiving two-point conversion 2 to the credited player. Kickoff/punt return TD and offensive fumble-recovery TD 6, only to the individual credited. No return-yard points; no double categorisation of the same TD.",
      "Seven active individual cards: QB, 2 RB, 2 WR, TE and RB/WR/TE FLEX. No kicker, team defence, IDP, bench substitution or captain multiplier in v1. Existing NFL scaffolding supports offensive individual cards only; live catalogue is not enabled.",
      "All overtime statistics count. Bye/confirmed did-not-play is an explicit confirmed zero, never a missing-feed zero. Week and fixture membership are frozen at lock. No cross-sport standings.",
    ],
  },
  afl: {
    sport: "afl",
    version: "docked-afl-events-beta-v1",
    title: "Docked AFL Scoring v1",
    beta: true,
    positions: ["DEF", "MID", "RUC", "FWD"],
    slots: [
      ...slots("DEF", 2),
      ...slots("MID", 3),
      ...slots("RUC", 1),
      ...slots("FWD", 2),
    ],
    weights: {
      kicks: 300,
      handballs: 200,
      marks: 300,
      tackles: 400,
      goals: 600,
      behinds: 100,
      hitouts: 100,
      freesFor: 100,
      freesAgainst: -300,
    },
    correctionHours: 72,
    periodName: "round",
    policy: [
      "Kick 3, handball 2, mark 3, tackle 4, goal 6, behind 1, hitout 1, free kick for 1, free kick against -3. Counts are additive: a mark, kick and goal scores 12. No proprietary player rating or normalisation.",
      "Compact Docked beta lineup: 2 DEF, 3 MID, 1 RUC, 2 FWD (8 active cards). This is a proposed Docked format, not AFL Fantasy's squad format. One locked position per card; no dual-position switching, emergencies or captain multipliers.",
      "Substitutes and partial appearances earn their actual events with no appearance/minimum-time bonus. Confirmed unused substitute/DNP/bye is zero. Missing statistics remain pending. Time-on-ground does not multiply scores.",
    ],
  },
};
export function scorePlayer(rules: Rules, position: string, raw: unknown) {
  if (!rules.positions.includes(position))
    throw Error("Invalid sport position");
  let parts: Part[] = [];
  const add = (statistic: string, quantity: number, rate: number) =>
    parts.push({ statistic, quantity, centipoints: quantity * rate });
  if (rules.sport === "epl") {
    const s = eplStats.parse(raw),
      w = rules.weights;
    add(
      "Appearance",
      s.playedSeconds > 0 ? 1 : 0,
      s.regulationSeconds >= 3600 ? w.fullAppearance : w.shortAppearance,
    );
    add("Goals", s.goals, rules.goal![position]);
    add("Assists", s.assists, w.assists);
    add(
      "Clean sheet",
      s.regulationSeconds >= 3600 &&
        s.concededOnPitch === 0 &&
        s.dismissal === "none"
        ? 1
        : 0,
      rules.clean![position],
    );
    add(
      "Saves (groups of 3)",
      position === "GK" ? Math.floor(s.saves / 3) : 0,
      w.savesPerThree,
    );
    add(
      "Penalty saves",
      position === "GK" ? s.penaltySaves : 0,
      w.penaltySaves,
    );
    add("Penalties missed", s.penaltiesMissed, w.penaltiesMissed);
    add(
      "Yellow cards (excluding second-yellow dismissal)",
      s.dismissal === "second-yellow" ? 0 : s.yellowCards,
      w.yellowCards,
    );
    add("Dismissal", s.dismissal !== "none" ? 1 : 0, w.dismissal);
    add("Own goals", s.ownGoals, w.ownGoals);
    add(
      "Conceded on pitch (groups of 2)",
      ["GK", "DEF"].includes(position) ? Math.floor(s.concededOnPitch / 2) : 0,
      w.concededPerTwo,
    );
  } else if (rules.sport === "nfl") {
    const { offensiveFumbleRecoveryTouchdowns, ...s } = nflStats.parse(raw);
    const { offensiveFumbleRecoveryTouchdowns: rate, ...weights } =
      rules.weights;
    parts = scoreNflOffense(s, {
      sport: "nfl",
      version: rules.version,
      centipoints_per_unit: weights,
    }).breakdown;
    add(
      "offensiveFumbleRecoveryTouchdowns",
      offensiveFumbleRecoveryTouchdowns,
      rate,
    );
  } else {
    for (const [key, value] of Object.entries(aflStats.parse(raw)))
      add(key, value, rules.weights[key]);
  }
  if (parts.some((p) => !Number.isSafeInteger(p.centipoints)))
    throw Error("Invalid scoring coefficients");
  return { centipoints: parts.reduce((n, p) => n + p.centipoints, 0), parts };
}
export const points = (cp: number) =>
  (cp / 100).toFixed(2).replace(/\.00$/, "");
export type LockedCard = { cardId: string; playerId: string; position: string };
export function validateLineup(rules: Rules, cards: LockedCard[]) {
  if (
    cards.length !== rules.slots.length ||
    new Set(cards.map((c) => c.cardId)).size !== cards.length ||
    new Set(cards.map((c) => c.playerId)).size !== cards.length
  )
    throw Error("Invalid lineup size or duplicates");
  const matched = new Map<number, number>();
  const place = (card: number, visited: Set<number>): boolean => {
    for (let slot = 0; slot < rules.slots.length; slot++) {
      if (
        visited.has(slot) ||
        !rules.slots[slot].positions.includes(cards[card].position)
      )
        continue;
      visited.add(slot);
      const previous = matched.get(slot);
      if (previous === undefined || place(previous, visited)) {
        matched.set(slot, card);
        return true;
      }
    }
    return false;
  };
  if (cards.some((_, i) => !place(i, new Set())))
    throw Error("Invalid lineup positions");
}
