import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { readPublishedNflScoringHistory } from "../../src/server/nfl-scoring-history";
import type { FeedDb } from "../../src/server/nfl-testing-store";
import {
  feedRaw,
  feedGameFixture,
  dataset,
} from "../fixtures/nfl-testing-data";

test("published NFL history pages beyond fantasy rounds with restricted reader and no settlement access", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create role anon;create role authenticated;create role service_role;create schema fixture_private;create table fixture_private.wallet(balance int);insert into fixture_private.wallet values(42000);",
    );
    await pg.exec(
      await readFile(
        "supabase/migrations/20261017092746_nfl_player_history_publication.sql",
        "utf8",
      ),
    );
    await pg.query(
      "insert into nfl_history.generations(id,dataset) values('published',$1)",
      [dataset],
    );
    await pg.exec(
      "update nfl_history.consumer set active='published',last_success=now() where id=1",
    );
    for (const round of [1, 7, 8, 9]) {
      const game = { ...feedGameFixture(), id: `game-${round}`, week: round };
      await pg.query(
        "insert into nfl_history.games values('published',$1,$2)",
        [game.id, game],
      );
      for (let i = 0; i < (round === 8 ? 42 : 1); i++) {
        const id = `player-${i}`;
        await pg.query(
          "insert into nfl_history.players values('published',$1,$2) on conflict do nothing",
          [
            id,
            {
              id,
              name: `QA Player ${String(i).padStart(2, "0")}`,
              position: "WR",
            },
          ],
        );
        await pg.query(
          "insert into nfl_history.mappings(dataset,canonical,docked,position,evidence,reviewed_by) values($1,$2,$3,'WR','{}','isolated-fixture') on conflict do nothing",
          [dataset, id, `qa:${id}`],
        );
        const raw = {
          ...feedRaw(id, 2),
          game_id: game.id,
          week: round,
          synthetic: false,
        };
        await pg.query(
          "insert into nfl_history.records values('published',$1,$2,2,false,$3)",
          [game.id, id, raw],
        );
      }
    }
    await pg.exec("set role docked_nfl_history_reader");
    const adapt = (connection: { query: typeof pg.query }): FeedDb => ({
      query: async (query, values) => ({
        rows: (await connection.query(query, values)).rows as any[],
      }),
      transaction: async (fn) => pg.transaction((tx) => fn(adapt(tx))),
    });
    const read = (round = 8, page = 0, search = "") =>
      readPublishedNflScoringHistory(adapt(pg), {
        sport: "nfl",
        round,
        page,
        search,
      });
    const history = await read();
    assert.deepEqual(
      history.rounds.map((r) => r.round),
      [9, 8, 7, 1],
    );
    assert.equal(history.total, 42);
    assert.equal(history.rows.length, 40);
    assert.equal(history.hasMore, true);
    assert.equal(history.rows[0].game.base, 200);
    assert.equal(history.rows[0].game.week, 8);
    assert.equal(history.rows[0].name, "QA Player 00");
    assert.equal((await read(8, 1)).rows.length, 2);
    assert.equal((await read(8, 0, "Player 41")).rows.length, 1);
    assert.equal((await read(9)).rows.length, 1);
    assert.equal((await read(2)).rows.length, 0);
    await assert.rejects(
      pg.query("select * from fixture_private.wallet"),
      /permission denied/,
    );
    await assert.rejects(
      pg.query("update nfl_history.records set removed=true"),
      /permission denied/,
    );
    await pg.exec(
      "reset role;update nfl_history.consumer set lease='incomplete' where id=1;set role docked_nfl_history_reader",
    );
    await assert.rejects(read(), /publication incomplete/);
    await pg.exec("reset role");
    assert.equal(
      (
        await pg.query<{ balance: number }>(
          "select * from fixture_private.wallet",
        )
      ).rows[0].balance,
      42000,
    );
  } finally {
    await pg.close();
  }
});
