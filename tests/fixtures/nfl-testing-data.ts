import { nflPostgameWeights } from "../../src/core/nfl-postgame-policy";
export const dataset = "c2a5d96c-bf07-4a94-bf59-893f4fb3d432";
export function feedRaw(player = "p_one", revision = 1) {
  return {
    schema_version: "1.0" as const,
    game_id: "g_one",
    player_id: player,
    revision,
    team_id: "t_home",
    season: 2026,
    season_type: "REG" as const,
    week: 1,
    stats: Object.fromEntries(
      Object.keys(nflPostgameWeights).map((k) => [
        k,
        k === "receptions" ? 2 : 0,
      ]),
    ),
    fields: Object.fromEntries(
      Object.keys(nflPostgameWeights).map((k) => [
        k,
        { availability: "confirmed", current: true },
      ]),
    ),
    fetched_at: Date.now() / 1000,
    source_updated_at: null,
    source: "nflverse",
    synthetic: true,
    participation: "stat_recorded",
    removed: false,
    complete: true,
  };
}
export function feedGameFixture() {
  return {
    id: "g_one",
    season: 2026,
    season_type: "REG" as const,
    week: 1,
    kickoff: 1790899200,
    status: "final",
    stats_state: "available",
    usable: true,
    game_revision: 1,
    record_count: 1,
    freshness: {
      stale: false,
      retrieved_at: Date.now() / 1000,
      source_updated_at: null,
    },
  };
}
export function eventPage(seq: number, raw = feedRaw(), operation = "upsert") {
  return {
    schema_version: "1.0",
    feed_class: "development_testing",
    feed_mode: "postgame",
    dataset_id: dataset,
    data: [
      {
        seq,
        game_id: raw.game_id,
        player_id: raw.player_id,
        revision: raw.revision,
        operation,
        payload: raw,
      },
    ],
    next_cursor: `${dataset}:${seq}`,
    has_more: false,
  };
}
