import { z } from "zod";
import { nflPlayerHistory } from "./nfl-player-history";
import { nflPostgameTestRules, type Rules } from "./scoring-v1";
import { sportEventRules } from "./sport-event-rules";
import type { CustomerSport } from "./customer-sports";
import type { PlayerGameHistory } from "./player-card-history";

export const scoringHistoryQuery = z.object({
  sport: z.enum(["nfl", "afl", "nrl"]),
  season: z
    .string()
    .regex(/^\d{4}( (PRE|POST))?$/)
    .optional(),
  round: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(0).max(100).default(0),
});
export type ScoringHistoryQuery = z.infer<typeof scoringHistoryQuery>;
export type ScoringRound = {
  season: string;
  round: number;
  games: number;
  records: number;
  mappedRecords: number;
};
export type ScoringHistoryRow = {
  player: string;
  name: string;
  position: string;
  scoringVersion: string;
  game: PlayerGameHistory;
};
export type SportScoringHistory = {
  sport: CustomerSport;
  rules: Rules;
  rounds: ScoringRound[];
  season: string | null;
  round: number | null;
  lastSuccess: string | null;
  rows: ScoringHistoryRow[];
  page: number;
  total: number;
  hasMore: boolean;
  unavailable?: string;
};
export const scoringHistoryPageSize = 40;

/** This is the game's sport reference, never a rewrite of a saved competition. */
export function sportReferenceRules(sport: CustomerSport): Rules {
  return sport === "nfl" ? nflPostgameTestRules() : sportEventRules(sport);
}
export function selectedScoringRound(
  rounds: ScoringRound[],
  query: Pick<ScoringHistoryQuery, "season" | "round">,
) {
  const season = query.season ?? rounds[0]?.season ?? null;
  const candidates = rounds.filter((r) => r.season === season);
  const round = query.round ?? candidates[0]?.round ?? null;
  return { season, round };
}
export type PublishedScoringRow = {
  player: string;
  name: string;
  position: string;
  payload: unknown;
  game_payload: unknown;
};

/** Use the same revision, participation, missing-field and base-point rules as cards. */
export function scoringHistoryRows(
  records: PublishedScoringRow[],
  season: string,
  round: number,
  lastSuccess: string | null,
): ScoringHistoryRow[] {
  const byPlayer = new Map<string, PublishedScoringRow[]>();
  for (const record of records)
    byPlayer.set(record.player, [
      ...(byPlayer.get(record.player) ?? []),
      record,
    ]);
  return [...byPlayer.values()].flatMap((observations) => {
    const history = nflPlayerHistory(observations, season, lastSuccess);
    return (history.games ?? [])
      .filter((game) => game.week === round)
      .map((game) => ({
        player: observations[0].player,
        name: observations[0].name,
        position: observations[0].position,
        scoringVersion: history.scoringVersion!,
        game,
      }));
  });
}
