import { feedGame, rawPlayerGame, playerReadiness } from "./nfl-testing-feed";
import { nflPostgameVersion } from "./nfl-postgame-policy";
import type { PlayerHistory } from "./player-card-history";
export function nflPlayerHistory(
  input: { payload: unknown; game_payload: unknown; position: string }[],
  requested?: string,
  lastSuccess?: string | null,
): PlayerHistory {
  const observations = input
    .map((r) => ({
      raw: rawPlayerGame.parse(r.payload),
      game: feedGame.parse(r.game_payload),
      position: r.position,
    }))
    .filter((r) => !r.raw.removed && !r.raw.synthetic);
  const seasonKey = (r: (typeof observations)[number]) =>
    r.raw.season_type === "REG"
      ? String(r.raw.season)
      : `${r.raw.season} ${r.raw.season_type}`;
  const seasons = [...new Set(observations.map(seasonKey))].sort().reverse();
  const season = requested ?? seasons[0] ?? null;
  const games = observations
    .filter((r) => seasonKey(r) === season)
    .map((r) => {
      // Historical, complete statistics remain inspectable when the feed is stale.
      // Freshness is disclosed separately; this never changes competition readiness.
      const ready = playerReadiness(
        r.raw,
        { ...r.game, freshness: { ...r.game.freshness, stale: false } },
        r.position,
      );
      const dnp =
        r.raw.participation === "confirmed-dnp" && r.game.status === "final";
      return {
        week: r.raw.week,
        base: ready.points ?? (dnp ? 0 : null),
        played: ready.points !== null,
        status:
          ready.points !== null
            ? "Available stats"
            : dnp
              ? "DNP"
              : ready.status,
        updatedAt: r.raw.source_updated_at ?? r.raw.fetched_at,
        stale: r.game.freshness.stale,
        rawStats: {
          game: r.raw.game_id,
          values: Object.fromEntries(
            Object.entries(r.raw.stats).map(([key, value]) => [
              key,
              r.raw.fields[key]?.current &&
              r.raw.fields[key]?.availability === "confirmed"
                ? value
                : null,
            ]),
          ),
          incomplete: r.game.stats_state === "incomplete",
        },
      };
    });
  const played = games.filter((r) => r.played);
  const rows = [...new Set(games.map((r) => r.week))]
    .sort((a, b) => b - a)
    .map((week) => {
      const g = games.filter((r) => r.week === week),
        missing = g.find((r) => r.base === null);
      return {
        week,
        base: missing ? null : g.reduce((n, r) => n + r.base!, 0),
        status:
          missing?.status ??
          (g.every((r) => !r.played) ? "DNP" : "Available stats"),
        updatedAt: new Date(
          Math.max(...g.map((r) => r.updatedAt)) * 1000,
        ).toISOString(),
        rawStats: g.map((r) => r.rawStats),
      };
    });
  return {
    season,
    seasons,
    rows,
    played: played.length,
    averageBase: played.length
      ? played.reduce((n, r) => n + r.base!, 0) / played.length
      : null,
    bestBase: played.length ? Math.max(...played.map((r) => r.base!)) : null,
    feed: {
      version: nflPostgameVersion,
      lastSuccess: lastSuccess ?? null,
      stale:
        games.some((r) => r.stale) ||
        !lastSuccess ||
        Date.now() - Date.parse(lastSuccess) > 86400000,
      seasonBase: played.length
        ? played.reduce((n, r) => n + r.base!, 0)
        : null,
      complete: games.length > 0 && games.every((r) => r.base !== null),
    },
  };
}
