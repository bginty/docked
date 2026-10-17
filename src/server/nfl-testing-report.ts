import {
  feedGame,
  playerReadiness,
  rawPlayerGame,
} from "../core/nfl-testing-feed";
import { nflPostgameVersion } from "../core/nfl-postgame-policy";
import type { FeedDb } from "./nfl-testing-store";

export async function nflTestingReport(db: FeedDb, retainedHistory = false) {
  return db.transaction(async (tx) => {
    await tx.query("set transaction isolation level repeatable read read only");
    return readReport(tx, retainedHistory);
  });
}
async function readReport(db: FeedDb, retainedHistory: boolean) {
  const current = (
    await db.query(
      "select c.last_success,c.last_error,(c.lease is not null and c.lease_until>now()) as importing,(c.last_success is null or c.last_success<now()-interval '8 hours') as sync_stale,g.* from nfl_test_feed.consumer c left join nfl_test_feed.generations g on g.id=c.active where c.id=1",
    )
  ).rows[0];
  const generation = current?.id;
  if (!generation)
    return {
      version: nflPostgameVersion,
      health: "Awaiting initial import",
      lastSuccess: null,
      dataset: null,
      rawRecords: 0,
      incompleteGames: 0,
      unmappedPlayers: 0,
      pending: 0,
      corrections: 0,
      games: [],
      players: [],
    };
  const [games, records, mappings, identities, outbox] = await Promise.all([
    db.query("select payload from nfl_test_feed.games where generation=$1", [
      generation,
    ]),
    db.query(
      "select payload,removed,revision from nfl_test_feed.records where generation=$1",
      [generation],
    ),
    db.query(
      "select canonical,docked,position from nfl_test_feed.mappings where dataset=$1",
      [current.dataset],
    ),
    db.query(
      "select player,payload from nfl_test_feed.players where generation=$1",
      [generation],
    ),
    db.query(
      "select count(distinct game) filter(where status<>'applied')::int pending from nfl_test_feed.outbox where generation=$1",
      [generation],
    ),
  ]);
  const gameMap = new Map(
    games.rows.map((r) => {
      const g = feedGame.parse(r.payload);
      if (current.last_error || current.importing || current.sync_stale) {
        g.freshness.stale = true;
        g.usable = false;
      }
      return [g.id, g];
    }),
  );
  const identityMap = new Map(
    identities.rows.map((r) => [r.player, r.payload]),
  );
  const mapped = new Map(mappings.rows.map((r) => [r.canonical, r]));
  const seen = new Set<string>();
  const rows = records.rows
    .filter((r) => !r.removed)
    .map((r) => {
      const raw = rawPlayerGame.parse(r.payload),
        game = gameMap.get(raw.game_id),
        mapping = mapped.get(raw.player_id);
      seen.add(raw.player_id);
      const { stats, ...readiness } = playerReadiness(
        raw,
        game,
        mapping?.position,
      );
      if (retainedHistory && !raw.synthetic) {
        readiness.points = readiness.retainedPoints;
        if (readiness.points !== null) readiness.status = "Available stats";
      }
      void stats; // Raw statistics stay server-side; the panel receives the score projection.
      return {
        player: raw.player_id,
        docked: mapping?.docked ?? null,
        name: identityMap.get(raw.player_id)?.name ?? raw.player_id,
        game: raw.game_id,
        season: raw.season,
        seasonType: raw.season_type,
        week: raw.week,
        team: raw.team_id,
        revision: raw.revision,
        kickoff: game?.kickoff ?? null,
        ...readiness,
      };
    });
  const players = [...seen]
    .filter((p) => mapped.has(p))
    .map((id) => {
      const history = rows
        .filter((r) => r.player === id)
        .sort(
          (a, b) =>
            (b.kickoff ?? 0) - (a.kickoff ?? 0) || b.game.localeCompare(a.game),
        );
      const seasons = [
        ...new Set(history.map((r) => `${r.season}:${r.seasonType}`)),
      ]
        .sort()
        .reverse()
        .map((key) => {
          const period = history.filter(
            (r) => `${r.season}:${r.seasonType}` === key,
          );
          const available = period.filter((r) => r.points !== null);
          const weeks = [...new Set(period.map((r) => r.week))]
            .sort((a, b) => b - a)
            .map((week) => {
              const games = period.filter((r) => r.week === week);
              return {
                week,
                points: games.every((r) => r.points !== null)
                  ? games.reduce((n, r) => n + r.points!, 0)
                  : null,
              };
            });
          return {
            key,
            weeks,
            points: available.length
              ? available.reduce((n, r) => n + r.points!, 0)
              : null,
            included: available.length,
            observed: period.length,
            complete: available.length === period.length,
          };
        });
      return {
        id,
        docked: mapped.get(id)!.docked,
        name: history[0].name,
        history,
        seasons,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: nflPostgameVersion,
    health: current.importing
      ? "Sync in progress · retained data"
      : current.last_error
        ? "Sync failed · retained data"
        : current.sync_stale
          ? "Sync overdue · retained data"
          : "Postgame test feed connected",
    lastSuccess: current.last_success,
    dataset: current.dataset,
    rawRecords: rows.length,
    incompleteGames: [...gameMap.values()].filter(
      (g) => g.stats_state === "incomplete",
    ).length,
    unmappedPlayers: [...seen].filter((p) => !mapped.has(p)).length,
    pending: outbox.rows[0].pending,
    corrections: records.rows.filter((r) => Number(r.revision) > 1).length,
    games: [...gameMap.values()].map((g) => ({
      id: g.id,
      season: g.season,
      week: g.week,
      status: g.stats_state,
      stale: g.freshness.stale,
      records: g.record_count,
      gameStatus: g.status,
    })),
    players,
  };
}
export type NflTestingReport = Awaited<ReturnType<typeof nflTestingReport>>;
