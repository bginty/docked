import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const ref = "abcdefghijklmnopqrst";
const users = Array.from(
  { length: 8 },
  (_, i) => `c0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const sessions = users.map((u) => u.replace("c000", "d000"));
async function q(sql: string, args: unknown[] = []) {
  return (await pg.query<Record<string, any>>(sql, args)).rows;
}
async function actor(n = 0, aal = "aal1") {
  await q(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.fantasy_preview','',false),set_config('docked.fantasy_channel','beta',false),set_config('docked.fantasy_production',$3,false)",
    [
      users[n],
      JSON.stringify({ sub: users[n], session_id: sessions[n], aal }),
      ref,
    ],
  );
}
async function cmd(action: string, p: object = {}, key = randomUUID()) {
  return (
    await q("select fantasy.production_command($1,$2::jsonb,$3) result", [
      action,
      JSON.stringify(p),
      key,
    ])
  )[0].result;
}
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const values of [
    [null, "2026-10-v1", "2026-10-v1"],
    [ref, null, "2026-10-v1"],
    [ref, "2026-10-v1", null],
  ])
    await assert.rejects(
      () => q("select fantasy.initialize_production($1,$2,$3)", values),
      /Reviewed/,
    );
  await q("select fantasy.initialize_production($1,$2,$3)", [
    ref,
    "2026-10-v1",
    "2026-10-v1",
  ]);
  for (let i = 0; i < users.length; i++) {
    await q(
      "insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())",
      [users[i]],
    );
    await q("insert into auth.sessions values($1,$2,null)", [
      sessions[i],
      users[i],
    ]);
    await q(
      "insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'AU','NSW',true,'2026-10-v1')",
      [users[i]],
    );
    await q(
      "insert into private.consent_events(actor,user_id,purpose,granted,version) values('test-fixture',$1,'privacy',true,'2026-10-v1')",
      [users[i]],
    );
  }
  await q("insert into private.roles(user_id,role) values($1,'owner')", [
    users[0],
  ]);
  await actor();
});

after(async () => {
  await pg?.close();
});
test("production starter is permanent, atomic and duplicate-safe across fresh request IDs", async () => {
  const key = randomUUID();
  const a = await cmd("claim_starter", {}, key);
  assert.deepEqual(await cmd("claim_starter", {}, key), a);
  assert.deepEqual(await cmd("claim_starter"), a);
  assert.equal(
    Number(
      (
        await q("select count(*) n from fantasy.cards where owner_id=$1", [
          users[0],
        ])
      )[0].n,
    ),
    11,
  );
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.ownership_events where to_user=$1",
          [users[0]],
        )
      )[0].n,
    ),
    11,
  );
  const pack = await cmd("open_pack", { pack_id: a.pack_id });
  assert.equal(pack.cards.length, 11);
  assert.deepEqual(await cmd("open_pack", { pack_id: a.pack_id }), pack);
  const comp = (
    await q("select competition_id from fantasy.production_rounds")
  )[0].competition_id;
  await cmd("save_lineup", { competition_id: comp, cards: pack.cards });
  await assert.rejects(() => cmd("claim_daily", {}, key), /Request ID reused/);
});
test("daily reward deduplicates fresh keys, snapshots policy and never credits wallet", async () => {
  const a = await cmd("claim_daily");
  const b = await cmd("claim_daily");
  assert.deepEqual(a, b);
  assert.equal(a.points, 10);
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.daily_claims where user_id=$1",
          [users[0]],
        )
      )[0].n,
    ),
    1,
  );
  assert.equal(
    Number((await q("select count(*) n from fantasy.ledger"))[0].n),
    0,
  );
  await assert.rejects(
    () =>
      cmd("admin_reward_policy", {
        daily_points: 12,
        card_every: 7,
        daily_card_limit: 100,
      }),
    /MFA/,
  );
  await actor(0, "aal2");
  await cmd("admin_reward_policy", {
    daily_points: 12,
    card_every: 7,
    daily_card_limit: 100,
  });
  assert.deepEqual(await cmd("claim_daily"), a);
  await assert.rejects(
    () => cmd("claim_daily", { period: "2099-01-01" }),
    /empty/,
  );
});
test("production denies all monetary/trade paths and original Preview entry even as MFA admin", async () => {
  for (const action of [
    "buy_pack",
    "list",
    "buy",
    "admin_credit",
    "admin_pack",
    "admin_fee",
    "offer_trade",
    "accept_trade",
  ])
    await assert.rejects(() => cmd(action, {}), /unavailable/);
  await assert.rejects(
    () =>
      q("select fantasy.command($1,$2::jsonb,$3)", [
        "claim_starter",
        "{}",
        randomUUID(),
      ]),
    /disabled in production/,
  );
  await assert.rejects(
    () => q("select fantasy.read_state()"),
    /disabled in production/,
  );
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec("set role " + role);
    await assert.rejects(
      () => q("select * from fantasy.daily_claims"),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        q(
          "select fantasy.initialize_production('abcdefghijklmnopqrst','2026-10-v1','2026-10-v1')",
        ),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        q("select fantasy.preview_command($1,$2::jsonb,$3)", [
          "admin_credit",
          "{}",
          randomUUID(),
        ]),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
  assert.equal(
    (
      await q(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fantasy' and c.relkind='r' and not c.relrowsecurity",
      )
    ).length,
    0,
  );
});
test("unverified, anonymous, stale consent, banned, disabled and expired sessions cannot enroll", async () => {
  await actor(1);
  for (const [change, restore] of [
    [
      "update auth.users set email_confirmed_at=null where id=$1",
      "update auth.users set email_confirmed_at=clock_timestamp() where id=$1",
    ],
    [
      "update auth.users set is_anonymous=true where id=$1",
      "update auth.users set is_anonymous=false where id=$1",
    ],
    [
      "update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=$1",
      "update auth.users set banned_until=null where id=$1",
    ],
    [
      "update public.profiles set disabled_at=clock_timestamp() where id=$1",
      "update public.profiles set disabled_at=null where id=$1",
    ],
    [
      "update public.profiles set accepted_version='old' where id=$1",
      "update public.profiles set accepted_version='2026-10-v1' where id=$1",
    ],
    [
      "update auth.sessions set not_after=clock_timestamp()-interval '1 second' where user_id=$1",
      "update auth.sessions set not_after=null where user_id=$1",
    ],
  ]) {
    await q(change, [users[1]]);
    await assert.rejects(() => cmd("claim_starter"));
    await q(restore, [users[1]]);
  }
  await q(
    "insert into private.consent_events(actor,user_id,purpose,granted,version) values('test-fixture',$1,'privacy',false,'2026-10-v1')",
    [users[1]],
  );
  await assert.rejects(() => cmd("claim_starter"), /privacy/);
  assert.equal(
    Number(
      (
        await q("select count(*) n from fantasy.members where user_id=$1", [
          users[1],
        ])
      )[0].n,
    ),
    0,
  );
});
test("production supports more than three verified members and isolates their inventory/history", async () => {
  for (let i = 2; i < 7; i++) {
    await actor(i);
    await cmd("claim_starter");
  }
  await actor(2);
  const other = (
    await q("select pack_id from fantasy.starter_claims where user_id=$1", [
      users[3],
    ])
  )[0].pack_id;
  await assert.rejects(
    () => cmd("open_pack", { pack_id: other }),
    /Own production pack/,
  );
  const state = (await q("select fantasy.production_read_state() s"))[0].s;
  assert.ok(state.packs.every((p: any) => p.user_id === users[2]));
  assert.deepEqual(state.members, [{ id: users[2], name: "You" }]);
  for (const key of ["market", "trades", "ledger", "shop"])
    assert.deepEqual(state[key], []);
  assert.equal(state.credits, 0);
  assert.equal(state.catalog, null);
  await q(
    "select set_config('docked.fantasy_preview','test-credits-only',false)",
  );
  await assert.rejects(() => cmd("claim_daily"), /context/);
  await actor(2);
});
test("seventh claim allocates controlled card; claims and scarcity cannot be rewritten", async () => {
  const version = (
    await q("select max(version) v from fantasy.production_policy")
  )[0].v;
  for (let i = 1; i <= 6; i++)
    await q(
      "insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values($1,(clock_timestamp() at time zone 'UTC')::date-$2::integer,10,$3,'not_due')",
      [users[2], i, version],
    );
  const a = await cmd("claim_daily");
  assert.equal(a.card_outcome, "awarded");
  assert.ok(a.pack_id);
  assert.deepEqual(await cmd("claim_daily"), a);
  const open = await cmd("open_pack", { pack_id: a.pack_id });
  assert.equal(open.cards.length, 1);
  await assert.rejects(
    () =>
      q("update fantasy.daily_claims set points=50 where user_id=$1", [
        users[2],
      ]),
    /Immutable/,
  );
  await assert.rejects(
    () => q("delete from fantasy.starter_claims where user_id=$1", [users[2]]),
    /Immutable/,
  );
  await assert.rejects(
    () => q("update fantasy.editions set max_supply=max_supply+1"),
    /locked/,
  );
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.editions where issued>max_supply",
        )
      )[0].n,
    ),
    0,
  );
});
test("failed partial starter allocation rolls back membership, stock, cards and provenance", async () => {
  await actor(7);
  await pg.exec(
    `create function fantasy.test_failure() returns trigger language plpgsql as $$begin if new.slot=5 then raise exception 'injected allocation failure';end if;return new;end$$;create trigger test_failure before insert on fantasy.pack_items for each row execute function fantasy.test_failure();`,
  );
  const before = (await q("select sum(issued) n from fantasy.editions"))[0].n;
  await assert.rejects(() => cmd("claim_starter"), /injected/);
  assert.equal(
    (await q("select sum(issued) n from fantasy.editions"))[0].n,
    before,
  );
  assert.equal(
    Number(
      (
        await q("select count(*) n from fantasy.members where user_id=$1", [
          users[7],
        ])
      )[0].n,
    ),
    0,
  );
  await pg.exec(
    "drop trigger test_failure on fantasy.pack_items;drop function fantasy.test_failure()",
  );
  const a = await cmd("claim_starter");
  assert.ok(a.pack_id);
});

test("runtime role executes eligible commands; missing context and revoked membership deny", async () => {
  await actor(3);
  await pg.exec("set role docked_app");
  try {
    const a = await cmd("claim_daily");
    assert.equal(a.points, 12);
    await q("select set_config('docked.fantasy_production','',false)");
    await assert.rejects(() => cmd("claim_daily"), /context/);
  } finally {
    await pg.exec("reset role");
  }
  await actor(3);
  await q(
    "update fantasy.members set revoked_at=clock_timestamp() where user_id=$1",
    [users[3]],
  );
  await assert.rejects(() => cmd("claim_daily"), /membership/i);
  await q("update fantasy.members set revoked_at=null where user_id=$1", [
    users[3],
  ]);
});

test("daily card limit and exhausted inventory award only points with stable receipts", async () => {
  await actor(0, "aal2");
  await cmd("admin_reward_policy", {
    daily_points: 10,
    card_every: 7,
    daily_card_limit: 0,
  });
  for (const n of [4, 5]) {
    const v = (
      await q("select max(version) v from fantasy.production_policy")
    )[0].v;
    for (let i = 1; i <= 6; i++)
      await q(
        "insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values($1,(clock_timestamp() at time zone 'UTC')::date-$2::integer,10,$3,'not_due')",
        [users[n], i, v],
      );
  }
  await actor(4);
  assert.equal((await cmd("claim_daily")).card_outcome, "daily_limit");
  await actor(0, "aal2");
  await cmd("admin_reward_policy", {
    daily_points: 10,
    card_every: 7,
    daily_card_limit: 100,
  });
  const previousSold = (
    await q(
      "select sold from fantasy.pack_definitions where id=(select reward_definition from fantasy.production_catalog)",
    )
  )[0].sold;
  await q(
    "update fantasy.pack_definitions set sold=max_quantity where id=(select reward_definition from fantasy.production_catalog)",
  );
  await actor(5);
  const a = await cmd("claim_daily");
  assert.equal(a.card_outcome, "stock_unavailable");
  assert.equal(a.pack_id, null);
  await q(
    "update fantasy.pack_definitions set sold=$1 where id=(select reward_definition from fantasy.production_catalog)",
    [previousSold],
  );
  assert.deepEqual(await cmd("claim_daily"), a);
});

test("new MFA free rounds preserve fixed scoring and immutable prior results", async () => {
  await actor(0);
  const payload = {
    name: "Free round two",
    season: "2027",
    round: 2,
    locks_at: new Date(Date.now() + 86400000).toISOString(),
  };
  await assert.rejects(() => cmd("admin_free_round", payload), /MFA/);
  await actor(0, "aal2");
  const key = randomUUID();
  const round = await cmd("admin_free_round", payload, key);
  assert.deepEqual(await cmd("admin_free_round", payload, key), round);
  await assert.rejects(
    () => cmd("admin_free_round", { ...payload, awards: [100000] }),
    /Valid/,
  );
  const pack = (
    await q("select pack_id from fantasy.starter_claims where user_id=$1", [
      users[0],
    ])
  )[0].pack_id;
  const cards = (await cmd("open_pack", { pack_id: pack })).cards;
  await cmd("save_lineup", { competition_id: round.competition_id, cards });
  await assert.rejects(
    () =>
      cmd("admin_simulate", { competition_id: round.competition_id, seed: 7 }),
    /locked/,
  );
  // Disposable SQL fixture advances the round boundary, never a shared database.
  await pg.exec(
    "alter table fantasy.competitions disable trigger competition_version",
  );
  try {
    await q(
      "update fantasy.competitions set opens_at=clock_timestamp()-interval '2 days',locks_at=clock_timestamp()-interval '1 day' where id=$1",
      [round.competition_id],
    );
  } finally {
    await pg.exec(
      "alter table fantasy.competitions enable trigger competition_version",
    );
  }
  await assert.rejects(
    () => cmd("save_lineup", { competition_id: round.competition_id, cards }),
    /locked/i,
  );
  const player = (await q("select id from fantasy.players limit 1"))[0].id;
  const stats = {
    minutes: 0,
    goals: 0,
    assists: 0,
    conceded: 0,
    saves: 0,
    yellow: 0,
    red: 0,
    own_goals: 0,
  };
  await cmd("admin_stats", {
    competition_id: round.competition_id,
    player_id: player,
    stats,
  });
  await cmd("admin_simulate", {
    competition_id: round.competition_id,
    seed: 7,
  });
  assert.equal(
    (
      await q(
        "select score from fantasy.round_scores where competition_id=$1 and player_id=$2",
        [round.competition_id, player],
      )
    )[0].score,
    0,
  );
  await assert.rejects(
    () =>
      cmd("admin_simulate", { competition_id: round.competition_id, seed: 8 }),
    /unscored/,
  );
  await assert.rejects(
    () =>
      q("update fantasy.results set score=99999 where competition_id=$1", [
        round.competition_id,
      ]),
    /Immutable/,
  );
  assert.equal(
    Number((await q("select count(*) n from fantasy.ledger"))[0].n),
    0,
  );
  const next = await cmd("admin_free_round", { ...payload, round: 3 });
  await cmd("save_lineup", { competition_id: next.competition_id, cards });
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.results where competition_id=$1",
          [round.competition_id],
        )
      )[0].n,
    ),
    1,
  );
});

test("starter catalog rollover preserves old unopened packs, one lifetime claim and edition caps", async () => {
  await actor(0, "aal2");
  await assert.rejects(
    () => cmd("admin_starter_stock", { quantity: 1000 }),
    /exhausted/,
  );
  const caps = await q(
    "select id,max_supply from fantasy.editions order by id",
  );
  // Fixture models an exhausted allocation without minting thousands of cards.
  await q(
    "update fantasy.pack_definitions set sold=max_quantity where id=(select starter_definition from fantasy.production_catalog)",
  );
  await cmd("admin_starter_stock", { quantity: 1000 });
  assert.deepEqual(
    await q("select id,max_supply from fantasy.editions order by id"),
    caps,
  );
  await actor(3);
  const original = (
    await q("select pack_id from fantasy.starter_claims where user_id=$1", [
      users[3],
    ])
  )[0].pack_id;
  assert.equal((await cmd("claim_starter")).pack_id, original);
  assert.equal(
    (await cmd("open_pack", { pack_id: original })).cards.length,
    11,
  );
  await actor(1);
  await q(
    "insert into private.consent_events(actor,user_id,purpose,granted,version) values('test-fixture',$1,'privacy',true,'2026-10-v1')",
    [users[1]],
  );
  const fresh = await cmd("claim_starter");
  assert.ok(fresh.pack_id);
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.starter_claims where user_id=$1",
          [users[1]],
        )
      )[0].n,
    ),
    1,
  );
});

test("old daily request replay never consumes a new UTC period", async () => {
  await actor(6);
  const key = randomUUID();
  const v = (await q("select max(version) v from fantasy.production_policy"))[0]
    .v;
  const old = (
    await q(
      "insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values($1,(clock_timestamp() at time zone 'UTC')::date-1,10,$2,'not_due') returning jsonb_build_object('claim_id',id,'period',period,'points',points,'pack_id',pack_id,'card_outcome',card_outcome) result",
      [users[6], v],
    )
  )[0].result;
  await q(
    "insert into fantasy.requests values($1,$2,'claim_daily','{}',$3::jsonb)",
    [users[6], key, JSON.stringify(old)],
  );
  assert.deepEqual(await cmd("claim_daily", {}, key), old);
  const today = await cmd("claim_daily");
  assert.notEqual(today.period, old.period);
  assert.deepEqual(await cmd("claim_daily"), today);
});

test("unexpected optional-card issuance failure rolls back points, receipt and stock", async () => {
  await actor(7);
  const v = (await q("select max(version) v from fantasy.production_policy"))[0]
    .v;
  for (let i = 1; i <= 6; i++)
    await q(
      "insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values($1,(clock_timestamp() at time zone 'UTC')::date-$2::integer,10,$3,'not_due')",
      [users[7], i, v],
    );
  const stock = (await q("select sum(issued) n from fantasy.editions"))[0].n;
  await pg.exec(
    "create function fantasy.fail_reward() returns trigger language plpgsql as $$begin raise exception 'injected reward failure';end$$;create trigger fail_reward before insert on fantasy.pack_items for each row execute function fantasy.fail_reward()",
  );
  try {
    await assert.rejects(() => cmd("claim_daily"), /injected reward/);
  } finally {
    await pg.exec(
      "drop trigger fail_reward on fantasy.pack_items;drop function fantasy.fail_reward()",
    );
  }
  assert.equal(
    (await q("select sum(issued) n from fantasy.editions"))[0].n,
    stock,
  );
  assert.equal(
    Number(
      (
        await q(
          "select count(*) n from fantasy.daily_claims where user_id=$1",
          [users[7]],
        )
      )[0].n,
    ),
    6,
  );
  assert.equal((await cmd("claim_daily")).card_outcome, "awarded");
});

async function state() {
  return (await q("select fantasy.production_read_state() result"))[0].result;
}

async function rejectedWithinTransaction(
  action: () => Promise<unknown>,
  pattern: RegExp,
) {
  await pg.exec("savepoint expected_rejection");
  try {
    await assert.rejects(action, pattern);
  } finally {
    await pg.exec(
      "rollback to savepoint expected_rejection; release savepoint expected_rejection",
    );
  }
}

test("shared standings respect profile privacy, bilateral blocks and active membership without exposing auth identities", async () => {
  await pg.exec("begin");
  try {
    await actor(0);
    await q(
      "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('AU','NSW','isolated-beta-test',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social'],'Disposable local test only')",
    );
    const ids: string[] = [];
    for (let n = 0; n < 4; n++) {
      await q(
        "insert into fantasy.members(user_id,expires_at) values($1,now()+interval '1 day') on conflict(user_id) do update set revoked_at=null,expires_at=excluded.expires_at",
        [users[n]],
      );
      ids.push(
        (
          await q(
            "insert into private.social_profiles(user_id,handle,display_name) values($1,$2,$3) returning id",
            [users[n], `beta_test_${n}`, `Member ${n}`],
          )
        )[0].id,
      );
    }
    assert.equal(
      (await state()).leaderboard.rows.length,
      1,
      "Social permission alone must not grant shared rankings",
    );
    await q(
      "update private.region_policies set features=array['community_social','leaderboards'] where version='isolated-beta-test'",
    );
    assert.equal(
      (await state()).leaderboard.rows.length,
      1,
      "Rankings without public-profile permission must remain self-only",
    );
    await q(
      "update private.region_policies set features=array['community_social','leaderboards','public_profiles'] where version='isolated-beta-test'",
    );
    let result = await state();
    assert.equal(result.leaderboard.rows.length, 4);
    assert.equal(result.leaderboard.scope, "visible_members_current_release");
    for (let n = 1; n < 4; n++) {
      assert.ok(
        result.leaderboard.rows.some((r: { id: string }) => r.id === ids[n]),
      );
      assert.ok(!JSON.stringify(result).includes(users[n]));
    }
    await q(
      "update private.social_profiles set visibility='private' where id=$1",
      [ids[1]],
    );
    await q(
      "insert into private.social_blocks(actor_id,target_id) values($1,$2)",
      [ids[2], ids[0]],
    );
    await q("update fantasy.members set revoked_at=now() where user_id=$1", [
      users[3],
    ]);
    result = await state();
    assert.deepEqual(
      result.leaderboard.rows.map((r: { name: string }) => r.name),
      ["You"],
    );
    await q("delete from private.social_blocks where actor_id=$1", [ids[2]]);
    await q(
      "insert into private.social_blocks(actor_id,target_id) values($1,$2)",
      [ids[0], ids[2]],
    );
    assert.equal((await state()).leaderboard.rows.length, 1);
  } finally {
    await pg.exec("rollback");
  }
});

test("stable release excludes beta rounds and points without resetting permanent cards or permitting a second daily claim", async () => {
  await pg.exec("begin");
  try {
    await actor(0, "aal2");
    const before = await state();
    const receipt = await cmd("claim_daily");
    const betaRound = before.competitions[0].id;
    const saved = (
      await q(
        "select request_id,action,payload,result from fantasy.requests where user_id=$1 and action='save_lineup' limit 1",
        [users[0]],
      )
    )[0];
    assert.ok(saved, "Existing committed beta lineup receipt is required");
    assert.equal(before.release_channel, "beta");
    assert.ok(before.my_championship_points > 0);
    await q(
      "insert into fantasy.production_releases(channel) values('stable')",
    );
    await rejectedWithinTransaction(() => state(), /channel mismatch/);
    await rejectedWithinTransaction(
      () => cmd("claim_daily"),
      /channel mismatch/,
    );
    await q("select set_config('docked.fantasy_channel','stable',false)");
    const after = await state();
    assert.equal(after.release_channel, "stable");
    assert.equal(after.my_championship_points, 0);
    assert.equal(after.rewards.points, 0);
    assert.equal(after.rewards.claimed_today, true);
    assert.ok(
      after.rewards.history.some(
        (r: { release_channel: string }) => r.release_channel === "beta",
      ),
    );
    assert.deepEqual(after.competitions, []);
    assert.deepEqual(after.entries, []);
    assert.deepEqual(after.results, []);
    assert.deepEqual(after.cards, before.cards);
    assert.deepEqual(await cmd("claim_daily"), receipt);
    assert.deepEqual(
      await cmd(saved.action, saved.payload, saved.request_id),
      saved.result,
    );
    await rejectedWithinTransaction(
      () =>
        cmd(saved.action, { ...saved.payload, cards: [] }, saved.request_id),
      /Request ID reused/,
    );
    await rejectedWithinTransaction(
      () => cmd(saved.action, saved.payload),
      /Current release round/,
    );
    await rejectedWithinTransaction(
      () => cmd("save_lineup", { competition_id: betaRound, cards: [] }),
      /Current release round/,
    );
    const next = await cmd("admin_free_round", {
      name: "Stable test round",
      season: "2028",
      round: 1,
      locks_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal((await state()).competitions[0].id, next.competition_id);
    assert.equal(
      (
        await q(
          "select release_channel from fantasy.production_rounds where competition_id=$1",
          [next.competition_id],
        )
      )[0].release_channel,
      "stable",
    );
  } finally {
    await pg.exec("rollback");
  }
});

test("release history is immutable and runtime cannot invoke legacy bypasses or edit channel records", async () => {
  await actor(0);
  for (const role of ["anon", "authenticated", "docked_app"]) {
    for (const fn of [
      "production_command_v1(text,jsonb,uuid)",
      "production_read_state_v1()",
      "production_eligible_v1()",
      "production_channel()",
    ])
      assert.equal(
        (
          await q("select has_function_privilege($1,$2,'execute') allowed", [
            role,
            `fantasy.${fn}`,
          ])
        )[0].allowed,
        false,
      );
    for (const table of [
      "production_releases",
      "production_rounds",
      "daily_claims",
    ])
      assert.equal(
        (
          await q(
            "select has_table_privilege($1,$2,'insert,update,delete,truncate') allowed",
            [role, `fantasy.${table}`],
          )
        )[0].allowed,
        false,
      );
  }
  await assert.rejects(
    () => q("update fantasy.production_releases set channel='stable'"),
    /Immutable/,
  );
  await assert.rejects(
    () => q("delete from fantasy.production_releases"),
    /Immutable/,
  );
  await assert.rejects(
    () => q("update fantasy.production_rounds set release_channel='stable'"),
    /Immutable/,
  );
  await assert.rejects(
    () => q("update fantasy.daily_claims set release_channel='stable'"),
    /Immutable/,
  );
});
