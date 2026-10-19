import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { playerJerseysQuery } from "../../src/server/player-jerseys-query";

test("owned jersey lookup accepts text player IDs and returns only requested players", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema credits_sandbox;
      create table credits_sandbox.current_player_jerseys(id text primary key,team text,verified_jersey_number integer);
      insert into credits_sandbox.current_player_jerseys values
      ('11111111-1111-4111-8111-111111111111','A',12),('nfl-legacy-42','B',42),('unowned','C',7);`);
    // Reproduce the production failure, even for UUID-shaped text IDs.
    await assert.rejects(
      pg.query(playerJerseysQuery.replace("text[]", "uuid[]"), [
        ["11111111-1111-4111-8111-111111111111"],
      ]),
      /operator does not exist: text = uuid/,
    );
    const rows = (await pg.query<{ id: string }>(playerJerseysQuery, [
      ["11111111-1111-4111-8111-111111111111", "nfl-legacy-42", "missing"],
    ])).rows;
    assert.deepEqual(rows.map((r) => r.id).sort(), [
      "11111111-1111-4111-8111-111111111111", "nfl-legacy-42",
    ]);
    assert.deepEqual((await pg.query(playerJerseysQuery, [[]])).rows, []);
  } finally {
    await pg.close();
  }
});
