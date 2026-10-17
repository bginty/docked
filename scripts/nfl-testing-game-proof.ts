import assert from "node:assert/strict";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  digest,
} from "../src/core/scoring-engine";
import { nflPostgameTestRules } from "../src/core/scoring-v1";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { reconcileTestingGame } from "../src/server/nfl-testing-reconcile";
import { NflTestingStore, type FeedDb } from "../src/server/nfl-testing-store";
import { nflTestingReport } from "../src/server/nfl-testing-report";
import { taggedFeedSql } from "../tests/fixtures/nfl-testing-sql";
import type { NflTestingReport } from "../src/server/nfl-testing-report";
export async function verifyRestoredGame(
  db: FeedDb,
  generation: string,
  game: string,
  expected: number,
  permit: unknown,
) {
  await reconcileTestingGame(
    db,
    taggedFeedSql(db),
    generation,
    game,
    { id: "local-test-importer", role: "importer" },
    permit,
  );
  const row = (
    await db.query(
      "select calculated from sports_feed.journal where stream_id='beta-real:qa:feed:real-game' order by revision desc limit 1",
    )
  ).rows[0];
  assert.equal(row.calculated.rows[0].centipoints, expected);
  return row.calculated.rows[0].centipoints as number;
}
export async function realGameProof(
  db: FeedDb,
  generation: string,
  report: NflTestingReport,
  permit: unknown,
) {
  const raw = (
    await db.query(
      "select r.payload,m.docked,m.position from nfl_test_feed.records r join nfl_test_feed.mappings m on m.canonical=r.player and m.dataset=$2 where r.generation=$1 and not r.removed",
      [generation, report.dataset],
    )
  ).rows;
  let chosen: typeof raw = [],
    game: any;
  for (const g of report.games.filter((g) => g.status === "available")) {
    const pool = raw.filter((r) => r.payload.game_id === g.id);
    const picks: typeof raw = [];
    for (const slot of nflPostgameTestRules().slots) {
      const p = pool.find(
        (p) => slot.positions.includes(p.position) && !picks.includes(p),
      );
      if (p) picks.push(p);
    }
    if (picks.length === 7) {
      chosen = picks;
      game = (
        await db.query(
          "select payload from nfl_test_feed.games where generation=$1 and game=$2",
          [generation, g.id],
        )
      ).rows[0].payload;
      break;
    }
  }
  assert.equal(chosen.length, 7);
  const at = new Date(game.kickoff * 1000 - 3600000).toISOString(),
    lock = new Date(game.kickoff * 1000).toISOString();
  const state = createPeriod(
    {
      id: "sim:nfl:postgame-proof",
      sport: "nfl",
      label: "Isolated recorded test lineup",
      locksAt: lock,
      rules: nflPostgameTestRules(),
      fixtures: [
        {
          id: "sim:nfl:feed-game",
          playerIds: chosen.map((r) => r.docked),
          scheduledAt: lock,
        },
      ],
    },
    at,
  );
  state.scope = "authorised-free-beta";
  state.period.id = "beta-real:qa:feed:real-game";
  const catalog = chosen.map((r, i) => ({
    cardId: `local-proof-card:${i}`,
    playerId: r.docked,
    position: r.position,
    owner: "local-proof-member",
    sport: "nfl" as const,
    eligible: true,
  }));
  const sql = taggedFeedSql(db),
    journal = new SportsFeedStore(sql);
  await journal.create(state);
  await journal.change(state.period.id, (s) =>
    saveTeam(
      s,
      "local-proof-member",
      "Isolated historical test lineup",
      catalog.map((c) => c.cardId),
      catalog,
      at,
    ),
  );
  await journal.change(state.period.id, (s) => lockTeams(s, catalog, lock));
  await db.query(
    "insert into nfl_test_feed.fixtures values($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      report.dataset,
      game.id,
      state.period.id,
      state.period.fixtures[0].id,
      game.season,
      game.season_type,
      game.week,
      JSON.stringify({
        review:
          "local recorded game identity + season/type/NFL week; not a real competition",
      }),
    ],
  );
  const actor = { id: "local-test-importer", role: "importer" as const };
  assert.equal(
    (await reconcileTestingGame(db, sql, generation, game.id, actor, permit))
      .status,
    "applied",
  );
  const get = async () =>
    (
      await db.query(
        "select * from sports_feed.journal where stream_id=$1 order by revision desc limit 1",
        [state.period.id],
      )
    ).rows[0];
  const before = await get();
  const expected = chosen.reduce(
    (n, r) =>
      n +
      report.players
        .find((p) => p.id === r.payload.player_id)!
        .history.find((h) => h.game === game.id)!.points!,
    0,
  );
  assert.equal(before.calculated.rows[0].centipoints, expected);
  await reconcileTestingGame(db, sql, generation, game.id, actor, permit);
  assert.equal((await get()).revision, before.revision);
  // Explicit isolated correction injection, not an alleged upstream correction.
  const store = new NflTestingStore(db),
    token = await store.lease();
  const cursor = (
    await db.query("select cursor from nfl_test_feed.generations where id=$1", [
      generation,
    ])
  ).rows[0].cursor;
  const sequence = Number(cursor.slice(cursor.lastIndexOf(":") + 1)) + 1;
  const corrected = {
    ...chosen[0].payload,
    revision: chosen[0].payload.revision + 1,
    stats: {
      ...chosen[0].payload.stats,
      receptions: chosen[0].payload.stats.receptions + 1,
    },
  };
  const originalPlayer = report.players.find(
    (p) => p.id === corrected.player_id,
  )!;
  await store.page(
    token,
    generation,
    {
      dataset_id: report.dataset,
      data: [
        {
          seq: sequence,
          game_id: game.id,
          player_id: corrected.player_id,
          revision: corrected.revision,
          operation: "upsert",
          payload: corrected,
        },
      ],
      next_cursor: `${report.dataset}:${sequence}`,
      has_more: false,
    },
    cursor,
  );
  await db.query(
    "update nfl_test_feed.consumer set lease=null,lease_until=null where lease=$1",
    [token],
  );
  await reconcileTestingGame(db, sql, generation, game.id, actor, permit);
  const after = await get();
  assert.equal(after.calculated.rows[0].centipoints, expected + 100);
  assert.equal(digest(after.body.entries), digest(before.body.entries));
  const changed = await nflTestingReport(db),
    p = changed.players.find((p) => p.id === corrected.player_id)!;
  const key = `${game.season}:${game.season_type}`;
  assert.equal(
    p.seasons.find((s) => s.key === key)!.points,
    originalPlayer.seasons.find((s) => s.key === key)!.points! + 100,
  );
  return {
    game: game.id,
    source: "real imported game",
    lineup: "isolated recorded seven-card fixture, no member awards",
    expectedCentipoints: expected,
    journalCentipoints: before.calculated.rows[0].centipoints,
    duplicateJournalUnchanged: true,
    simulatedCorrection: {
      receptionsDelta: 1,
      afterCentipoints: after.calculated.rows[0].centipoints,
      seasonDelta: 100,
    },
    frozenEntriesUnchanged: true,
  };
}
