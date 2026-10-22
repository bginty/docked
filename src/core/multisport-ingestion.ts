import { eplOnPitchEvidence } from "./scoring-provider";
import { eplStats } from "./scoring-v1";
import { z } from "zod";
/** Raw-feed translation only. The existing authorised validator and scoring engine
 * remain authoritative. Never infer ordered EPL evidence from rounded minutes. */
export type RawGame = {
  sport: "epl" | "nba" | "afl" | "nrl";
  fixture_id: string;
  player_id: string;
  revision: number;
  synthetic: boolean;
  usable: boolean;
  stats: Record<string, number | null>;
  current_fields: Record<string, boolean>;
  participation?: string;
  removed?: boolean;
  scoring_evidence?: unknown;
};
const aflFields = {
  kicks: "kicks",
  handballs: "handballs",
  marks: "marks",
  tackles: "tackles",
  goals: "goals",
  behinds: "behinds",
  hitouts: "hitouts",
  freesFor: "frees_for",
  freesAgainst: "frees_against",
} as const;
export function mapRawScoringInput(
  row: RawGame,
  mappedPlayerId: string | null,
) {
  if (!mappedPlayerId)
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Player mapping requires review",
    };
  if (row.synthetic || !row.usable)
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Awaiting usable real statistics",
    };
  if (row.removed)
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Source record withdrawn; reconciliation required",
    };
  if (
    row.participation === "dnp" &&
    Object.entries(row.stats).some(
      ([k, v]) => row.current_fields[k] && v != null && v !== 0,
    )
  )
    return {
      availability: "pending" as const,
      stats: null,
      reason: "DNP contradicts current statistics",
    };
  if (row.participation === "dnp")
    return {
      availability: "confirmed-dnp" as const,
      stats: null,
      reason: null,
    };
  if (row.sport === "epl" && row.scoring_evidence) {
    const evidence = z
      .object({
        version: z.literal("docked-epl-ordered-events-v1"),
        assistDefinition: z.literal("docked-epl-assist-v1"),
        dismissal: z.enum(["none", "straight-red", "second-yellow"]),
        onPitch: z.unknown(),
      })
      .strict()
      .safeParse(row.scoring_evidence);
    if (evidence.success) {
      const fields = {
        goals: "goals",
        assists: "assists",
        saves: "saves",
        penaltySaves: "penalty_saves",
        penaltiesMissed: "penalties_missed",
        yellowCards: "yellow_cards",
        ownGoals: "own_goals",
      };
      if (
        Object.values(fields).every(
          (k) =>
            row.current_fields[k] &&
            Number.isSafeInteger(row.stats[k]) &&
            row.stats[k] !== null,
        )
      ) {
        try {
          const stats = eplStats.parse({
            ...Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [k, row.stats[v]]),
            ),
            ...eplOnPitchEvidence(evidence.data.onPitch),
            dismissal: evidence.data.dismissal,
          });
          return { availability: "complete" as const, stats, reason: null };
        } catch {
          /* Inconsistent evidence remains pending. */
        }
      }
    }
  }
  if (row.sport === "epl")
    return {
      availability: "pending" as const,
      stats: null,
      reason:
        "Ordered on-pitch and regulation-time evidence required by existing EPL rules",
    };
  const stats: Record<string, number> = {};
  const fields =
    row.sport === "nba"
      ? {
          points: "points",
          rebounds: "rebounds",
          assists: "assists",
          steals: "steals",
          blocks: "blocks",
          turnovers: "turnovers",
          threePointers: "three_pointers_made",
        }
      : row.sport === "nrl"
        ? {
            tries: "tries",
            goals: "goals",
            fieldGoals: "field_goals",
            tryAssists: "try_assists",
            lineBreaks: "line_breaks",
            lineBreakAssists: "line_break_assists",
            tackles: "tackles",
            tackleBreaks: "tackle_breaks",
            missedTackles: "missed_tackles",
            offloadsToHand: "offloads_to_hand",
            offloadsToGround: "offloads_to_ground",
            errors: "errors",
            fortyTwenties: "forty_twenties",
            twentyForties: "twenty_forties",
            runMetres: "run_metres",
            kickMetres: "kick_metres",
            penaltiesConceded: "penalties_conceded",
            sixAgainInfringements: "six_again_infringements",
            sinBins: "sin_bins",
            sendOffs: "send_offs",
            trySaves: "try_saves",
            kicksDefused: "kicks_defused",
            forcedDropouts: "forced_dropouts",
            turnovers: "turnovers",
            escapesInGoal: "escapes_in_goal",
          }
        : aflFields;
  for (const [target, source] of Object.entries(fields)) {
    const value = row.stats[source];
    if (
      !row.current_fields[source] ||
      !Number.isSafeInteger(value) ||
      value == null ||
      value < 0
    )
      return {
        availability: "pending" as const,
        stats: null,
        reason: `Awaiting ${source}`,
      };
    stats[target] = value;
  }
  return { availability: "complete" as const, stats, reason: null };
}
