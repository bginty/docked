import { z } from "zod";
import { nflPostgameStats, nflPostgameWeights } from "./nfl-postgame-policy";
import { nflPostgameTestRules, scorePlayer } from "./scoring-v1";
const key = z.string().regex(/^[a-zA-Z0-9:_-]{1,120}$/);
export const rawPlayerGame = z
  .object({
    schema_version: z.literal("1.0"),
    game_id: key,
    player_id: key,
    revision: z.number().int().positive(),
    team_id: key,
    season: z.number().int(),
    season_type: z.enum(["REG", "POST", "PRE"]),
    week: z.number().int(),
    stats: z.record(z.string(), z.number().int().nullable()),
    fields: z.record(
      z.string(),
      z
        .object({ current: z.boolean(), availability: z.string() })
        .passthrough(),
    ),
    fetched_at: z.number(),
    source_updated_at: z.number().nullable(),
    source: z.string(),
    synthetic: z.boolean(),
    participation: z.string(),
    removed: z.boolean(),
    complete: z.boolean(),
  })
  .passthrough();
export const feedGame = z
  .object({
    id: key,
    season: z.number().int(),
    season_type: z.enum(["REG", "POST", "PRE"]),
    week: z.number().int(),
    kickoff: z.number().nullable(),
    status: z.string(),
    stats_state: z.string(),
    usable: z.boolean(),
    game_revision: z.number().int(),
    record_count: z.number().int(),
    freshness: z
      .object({
        stale: z.boolean(),
        retrieved_at: z.number().nullable(),
        source_updated_at: z.number().nullable(),
      })
      .passthrough(),
  })
  .passthrough();
export const feedChanges = z.object({
  dataset_id: z.string().uuid(),
  data: z.array(
    z.object({
      seq: z.number().int().positive(),
      game_id: key,
      player_id: key,
      revision: z.number().int().positive(),
      operation: z.enum(["upsert", "remove"]),
      payload: rawPlayerGame,
    }),
  ),
  next_cursor: z.string(),
  has_more: z.boolean(),
});
export type RawPlayerGame = z.infer<typeof rawPlayerGame>;
export type FeedGame = z.infer<typeof feedGame>;
export type PlayerMapping = {
  canonical: string;
  docked: string;
  position: string;
};
export function playerReadiness(
  raw: RawPlayerGame | undefined,
  game: FeedGame | undefined,
  position?: string,
) {
  const missing = raw
    ? Object.keys(nflPostgameWeights).filter(
        (k) =>
          raw.stats[k] === null ||
          raw.stats[k] === undefined ||
          !raw.fields[k]?.current ||
          raw.fields[k]?.availability !== "confirmed",
      )
    : ["player observation"];
  // The service's row.complete is game-wide. Independently verify every required
  // player field so an anonymous unrelated row need not suppress this player's history.
  const stats =
    raw &&
    nflPostgameStats.safeParse(
      Object.fromEntries(
        Object.keys(nflPostgameWeights).map((k) => [k, raw.stats[k]]),
      ),
    );
  const available =
    !!raw &&
    !raw.removed &&
    !!game &&
    raw.game_id === game.id &&
    raw.season === game.season &&
    raw.season_type === game.season_type &&
    raw.week === game.week &&
    game.status === "final" &&
    ["available", "incomplete"].includes(game.stats_state) &&
    !game.freshness.stale &&
    ["stat_recorded", "played"].includes(raw.participation) &&
    !missing.length &&
    !!stats &&
    stats.success &&
    ["QB", "RB", "WR", "TE"].includes(position ?? "");
  const points =
    available && stats?.success
      ? scorePlayer(nflPostgameTestRules(), position!, stats.data).centipoints
      : null;
  const retainedPoints =
    raw &&
    !raw.removed &&
    stats?.success &&
    ["QB", "RB", "WR", "TE"].includes(position ?? "")
      ? scorePlayer(nflPostgameTestRules(), position!, stats.data).centipoints
      : null;
  return {
    status: available
      ? "Available stats"
      : raw
        ? "Incomplete stats"
        : "Awaiting stats",
    points,
    retainedPoints,
    missing: [...missing, ...(!position ? ["verified Docked identity"] : [])],
    competitionReady:
      available && game!.stats_state === "available" && game!.usable,
    stats: available && stats?.success ? stats.data : null,
    stale: game?.freshness.stale ?? true,
    retrievedAt: game?.freshness.retrieved_at ?? raw?.fetched_at ?? null,
    sourceUpdatedAt:
      game?.freshness.source_updated_at ?? raw?.source_updated_at ?? null,
  };
}
