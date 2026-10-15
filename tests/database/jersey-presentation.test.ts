import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("jersey projection rejects missing/conflicting/stale/wrong-team source facts and grants no raw access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create role docked_beta_app;create schema credits_sandbox;create schema sports_feed;
  create table credits_sandbox.permanent_players(id text,provider_id text,provider text,sport text);
  create table credits_sandbox.current_player_status(id text,team text,name text,checked_at timestamptz,raw_id text);
  create table sports_feed.raw_revisions(id bigint,provider text,body jsonb,expires_at timestamptz);
  insert into credits_sandbox.permanent_players values('player','00-0000001','nflverse','nfl');
  insert into credits_sandbox.current_player_status values('player','PIT','Synthetic Player',clock_timestamp(),'1');`);
    const row = {
      gsis_id: "00-0000001",
      team: "PIT",
      full_name: "Synthetic Player",
      jersey_number: "0",
    };
    await db.query(
      `insert into sports_feed.raw_revisions values(1,'nflverse',$1,clock_timestamp()+interval '1 day')`,
      [JSON.stringify({ dataset: "rosters", rows: [row] })],
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261015080107_verified_jersey_presentation.sql",
        "utf8",
      ),
    );
    const read = async () =>
      (
        await db.query<{ verified_jersey_number: number | null }>(
          "select verified_jersey_number from credits_sandbox.current_player_jerseys",
        )
      ).rows;
    assert.equal((await read())[0].verified_jersey_number, 0);
    for (const rows of [
      [{ ...row, jersey_number: "87" }],
      [{ ...row, jersey_number: "100" }],
      [{ ...row, jersey_number: "" }],
      [row, { ...row, jersey_number: "8" }],
    ]) {
      await db.query(`update sports_feed.raw_revisions set body=$1`, [
        JSON.stringify({ dataset: "rosters", rows }),
      ]);
      assert.equal(
        (await read())[0].verified_jersey_number,
        rows[0].jersey_number === "87" ? 87 : null,
      );
    }
    await db.query(`update sports_feed.raw_revisions set body=$1`, [
      JSON.stringify({ dataset: "rosters", rows: [{ ...row, team: "KC" }] }),
    ]);
    assert.equal((await read()).length, 0);
    await db.query(`update sports_feed.raw_revisions set body=$1`, [
      JSON.stringify({ dataset: "rosters", rows: [row] }),
    ]);
    await db.exec(
      `update credits_sandbox.current_player_status set checked_at=clock_timestamp()-interval '73 hours'`,
    );
    assert.equal((await read()).length, 0);
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          `select has_table_privilege('docked_beta_app','sports_feed.raw_revisions','SELECT') allowed`,
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          `select has_table_privilege('authenticated','credits_sandbox.current_player_jerseys','SELECT') allowed`,
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
