import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import roster from "../../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";

test("independent sport rewards: offline catch-up, Core ownership, replay and account/sport isolation", async () => {
  const { pg, q, user, other } = await multiSportDatabase();
  try {
    // Transport identity stubs only; programme, schedule, receipt and inventory SQL are real.
    await pg.exec(`create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
   create or replace function sports_feed.private_beta_sport_identity() returns uuid language sql as $$select auth.uid()$$;`);
    for (const u of [user, other]) {
      await q(
        "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at)values($1,$2,md5($1)||md5($1),gen_random_uuid(),clock_timestamp()+interval '1 day')",
        [u + "@fixture.invalid", u],
      );
      await q(
        "update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions='{\"terms\":\"fixture\"}' where user_id=$1",
        [u],
      );
      await q(
        "insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'fixture')",
        [u],
      );
    }
    await q(
      "insert into sports_feed.nba_beta_control values(true,true,'Local reward test',clock_timestamp())",
    );
    for (const u of [user, other])
      await q(
        "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values($1,true,'Local reward test','infinity')",
        [u],
      );
    await q(
      "update sports_feed.private_beta_sports set enabled=true,authority='Local reward test'",
    );
    for (const p of roster.players
      .filter((p) => ["afl", "nrl"].includes(p.sport))
      .filter((p, i, a) => a.filter((v) => v.sport === p.sport).indexOf(p) < 5))
      await q(
        "insert into credits_sandbox.nba_fixture_players(id,identity)values($1,$2)",
        [p.id, JSON.stringify(p)],
      );
    await q(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('docked.private_beta_sport','afl',false)",
      [user],
    );
    assert.equal(
      (await q("select sports_feed.my_weekly_core('afl') s"))[0].s.enabled,
      false,
    );
    assert.equal(
      (
        await q("select count(*)::int n from sports_feed.weekly_core_schedules")
      )[0].n,
      0,
    );
    await pg.exec(
      "update sports_feed.weekly_sport_programmes set enabled=true,enabled_at=clock_timestamp(),authority_note='Isolated test approval only'",
    );
    const first = (await q("select sports_feed.my_weekly_core('afl') s"))[0].s;
    assert.equal(first.packs.length, 1);
    assert.equal(
      Date.parse(first.nextIssueAt) - Date.parse(first.enrolledAt),
      604800000,
    );
    for (let i = 0; i < 4; i++)
      assert.equal(
        (await q("select sports_feed.my_weekly_core('afl') s"))[0].s.packs
          .length,
        1,
      );
    const request = randomUUID(),
      pack = first.packs[0].id;
    const receipt = (
      await q("select sports_feed.open_weekly_core($1,$2,'afl') r", [
        pack,
        request,
      ])
    )[0].r;
    assert.equal(receipt.cards.length, 4);
    assert.equal(new Set(receipt.cards.map((c: any) => c.player_id)).size, 4);
    assert(
      receipt.cards.every(
        (c: any) => c.sport === "afl" && c.tier === "CORE" && !c.tradeable,
      ),
    );
    assert.deepEqual(
      (
        await q("select sports_feed.open_weekly_core($1,$2,'afl') r", [
          pack,
          randomUUID(),
        ])
      )[0].r,
      receipt,
    );
    assert.equal(
      (await q("select sports_feed.my_weekly_core('afl') s"))[0].s.nextIssueAt,
      first.nextIssueAt,
    );
    assert.equal(
      (
        await q("select sports_feed.owned_sport_inventory($1,'afl') c", [user])
      )[0].c.length,
      4,
    );
    const collection = (
      await q(
        'select beta_fantasy.owned_collection_page(\'{"sport":"afl"}\') p',
      )
    )[0].p;
    assert.equal(collection.total, 4);
    assert.equal(collection.counts.CORE, 4);
    await q("select set_config('docked.private_beta_sport','nrl',false)");
    const nrl = (await q("select sports_feed.my_weekly_core('nrl') s"))[0].s;
    assert.equal(nrl.packs.length, 1);
    await assert.rejects(
      q("select sports_feed.open_weekly_core($1,$2,'nrl')", [
        pack,
        randomUUID(),
      ]),
      /unavailable/i,
    );
    await q(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('docked.private_beta_sport','afl',false)",
      [other],
    );
    await assert.rejects(
      q("select sports_feed.open_weekly_core($1,$2,'afl')", [
        pack,
        randomUUID(),
      ]),
      /unavailable/i,
    );
    await q("select set_config('qa.now','2099-01-23T00:00:00Z',false)");
    const count = (await q("select sports_feed.weekly_core_job() n"))[0].n;
    assert.equal(count, 8); // Three overdue periods per existing sport, plus initial packs for second account.
    assert.equal((await q("select sports_feed.weekly_core_job() n"))[0].n, 0);
    await q("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    const caught = (await q("select sports_feed.my_weekly_core('afl') s"))[0].s;
    assert.equal(caught.packs.length, 4);
    assert.equal(caught.packs.filter((p: any) => p.openedAt).length, 1);
    await assert.rejects(
      q(
        "update sports_feed.weekly_core_schedules set enrolled_at=enrolled_at-interval '1 day' where user_id=$1",
        [user],
      ),
      /immutable/,
    );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from sports_feed.weekly_core_schedules where sport='nfl'",
        )
      )[0].n,
      0,
    );
  } finally {
    await pg.close();
  }
});
