import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("official roster gates direct admin and pack mint paths; private evidence and append-only audit", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create role docked_beta_app;create role docked_app;create role docked_nfl_worker;
   create schema credits_sandbox;create schema beta_fantasy;
   create table credits_sandbox.permanent_players(id text primary key,identity jsonb,sport text);
   create table credits_sandbox.card_definitions(id text primary key,player_id text references credits_sandbox.permanent_players);
   create table credits_sandbox.card_instances(id text primary key,definition text references credits_sandbox.card_definitions);
   create table beta_fantasy.players(id text primary key,position text,sport text);
   create table beta_fantasy.editions(id text primary key,player_id text references beta_fantasy.players);
   create table beta_fantasy.cards(id text primary key,edition_id text references beta_fantasy.editions);
   insert into credits_sandbox.permanent_players values('p','{"position":"QB"}','nfl');
   insert into credits_sandbox.card_definitions values('d','p');
   insert into beta_fantasy.players values('p','QB','nfl'),('k','K','nfl');
   insert into beta_fantasy.editions values('d','p'),('k','k');`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20261017052556_official_nfl_roster_eligibility.sql",
        "utf8",
      ),
    );
    await db.exec("update nfl_roster.control set enabled=true");
    await db.exec(
      readFileSync(
        "supabase/migrations/20261021111949_official_roster_refresh.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261021112618_official_roster_refresh_scope.sql",
        "utf8",
      ),
    );
    await assert.rejects(
      () => db.exec("insert into beta_fantasy.cards values('x','d')"),
      /eligibility/,
    );
    await assert.rejects(
      () =>
        db.exec("insert into credits_sandbox.card_instances values('x','d')"),
      /eligibility/,
    );
    for (const status of [
      "reserve",
      "practice-squad",
      "released",
      "retired",
      "unknown",
      "active",
    ]) {
      await db.query(
        "insert into nfl_roster.observations values('p','gsis','MIN','QB',$1,true,'https://www.vikings.com/',$2,clock_timestamp(),'{}')",
        [status, "a".repeat(64)],
      );
      if (status === "active") {
        await db.exec(
          "insert into beta_fantasy.cards values('x','d');insert into credits_sandbox.card_instances values('x','d')",
        );
      } else
        await assert.rejects(
          () => db.exec("insert into beta_fantasy.cards values('x','d')"),
          /eligibility/,
        );
    }
    await assert.rejects(
      () => db.exec("insert into beta_fantasy.cards values('k','k')"),
      /eligibility/,
    );
    await assert.rejects(
      () => db.exec("delete from nfl_roster.observations"),
      /append-only/,
    );
    const before = (await db.query("select count(*) n from beta_fantasy.cards"))
      .rows;
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          await tx.exec(
            "insert into beta_fantasy.cards values('ok','d');insert into beta_fantasy.cards values('bad','k')",
          );
        }),
      /eligibility/,
    );
    assert.deepEqual(
      (await db.query("select count(*) n from beta_fantasy.cards")).rows,
      before,
    );
    await db.exec(
      "insert into nfl_roster.observations values('old','old-gsis','MIN','RB','active',true,'https://www.vikings.com/',repeat('b',64),clock_timestamp()-interval '73 hours','{}'); insert into nfl_roster.observations values('fb','fb-gsis','MIN','FB','active',true,'https://www.vikings.com/',repeat('c',64),clock_timestamp(),'{}');",
    );
    assert.deepEqual(
      (
        await db.query(
          "select nfl_roster.can_issue('old','RB') stale,nfl_roster.can_issue('fb','RB') fullback,nfl_roster.can_issue('p',null) missing,nfl_roster.can_issue('p','P') punter",
        )
      ).rows,
      [{ stale: false, fullback: true, missing: false, punter: false }],
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      () => db.exec("select * from nfl_roster.observations"),
      /permission/,
    );
    await db.exec("reset role;set role docked_beta_app");
    assert.ok(
      (await db.query("select * from nfl_roster.current_evidence")).rows.length,
    );
    await assert.rejects(
      () => db.exec("update nfl_roster.control set enabled=false"),
      /permission/,
    );
    await assert.rejects(
      () => db.exec("select nfl_roster.record_refresh('[]')"),
      /permission/,
    );
    await db.exec("reset role;set role docked_nfl_worker");
    const refresh = [
      {
        playerId: "p",
        providerId: "gsis",
        team: "MIN",
        position: "QB",
        status: "active",
        identityVerified: true,
        sourceUrl: "https://www.vikings.com/",
        sourceHash: "e".repeat(64),
        checkedAt: new Date().toISOString(),
      },
    ];
    await db.query("select nfl_roster.record_refresh($1::jsonb)", [
      JSON.stringify(refresh),
    ]);
    await db.query("select nfl_roster.record_refresh($1::jsonb)", [
      JSON.stringify(refresh),
    ]);
    await assert.rejects(
      () =>
        db.query("select nfl_roster.record_refresh($1::jsonb)", [
          JSON.stringify([{ ...refresh[0], playerId: "unreviewed" }]),
        ]),
      /verified identity/,
    );
    await db.exec("reset role");
    await db.exec(
      "insert into nfl_roster.observations values('p','gsis','MIN','QB','active',true,'https://www.vikings.com/team/players-roster/',repeat('f',64),clock_timestamp(),'{}')",
    );
    assert.equal(
      (await db.query("select * from nfl_roster.refresh_candidates()")).rows
        .length,
      1,
    );
    await db.exec(
      "insert into nfl_roster.observations values('p','gsis','MIN','QB','released',true,'https://www.vikings.com/team/transactions/',repeat('f',64),clock_timestamp(),'{}')",
    );
    assert.equal(
      (await db.query("select * from nfl_roster.refresh_candidates()")).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});
