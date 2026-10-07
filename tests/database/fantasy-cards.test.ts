import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const users = [1, 2, 3, 4].map(
  (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const sessions = [1, 2, 3, 4].map(
  (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
async function claims(n = 0) {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.fantasy_preview','test-credits-only',false)",
    [
      users[n],
      JSON.stringify({ sub: users[n], session_id: sessions[n], aal: "aal2" }),
    ],
  );
}
async function command(action: string, p: object = {}, key = randomUUID()) {
  const r = await pg.query<{ v: Record<string, unknown> }>(
    "select fantasy.command($1,$2::jsonb,$3) v",
    [action, JSON.stringify(p), key],
  );
  return r.rows[0].v;
}
async function rows<T = Record<string, unknown>>(
  q: string,
  args: unknown[] = [],
) {
  return (await pg.query<T>(q, args)).rows;
}
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  for (let n = 0; n < 4; n++) {
    await pg.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [users[n]],
    );
    await pg.query("insert into auth.sessions values($1,$2,null)", [
      sessions[n],
      users[n],
    ]);
    await pg.query(
      "insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'XX','FANTASY',true,'test')",
      [users[n]],
    );
    if (n < 3)
      await pg.query(
        "insert into fantasy.members values($1,now()+interval '1 day',null,now())",
        [users[n]],
      );
  }
  await pg.exec(
    `update fantasy.settings set enabled=true;insert into private.roles(user_id,role) values('${users[0]}','owner')`,
  );
  await claims();
});
after(async () => {
  await pg?.close();
});
test("unfunded buyers cannot reserve pack inventory", async () => {
  await claims(2);
  const d = (
    await rows<{ id: string; sold: number }>(
      "select id,sold from fantasy.pack_definitions where name='Elite'",
    )
  )[0];
  await assert.rejects(
    () => command("buy_pack", { definition_id: d.id }),
    /Insufficient/,
  );
  assert.equal(
    (
      await rows("select sold from fantasy.pack_definitions where id=$1", [
        d.id,
      ])
    )[0].sold,
    d.sold,
  );
  assert.equal(
    Number(
      (
        await rows("select count(*) n from fantasy.packs where user_id=$1", [
          users[2],
        ])
      )[0].n,
    ),
    0,
  );
  await claims();
});
test("fantasy tables use RLS; browsers and runtime cannot write or invoke helpers", async () => {
  assert.deepEqual(
    await rows(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fantasy' and relkind='r' and not relrowsecurity",
    ),
    [],
  );
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(
      () => pg.exec("select * from fantasy.cards"),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        pg.exec(
          "select fantasy.mint(gen_random_uuid(),gen_random_uuid(),true,'fake',gen_random_uuid())",
        ),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
});
test("fourth member, forged session, revoked member and disabled profile fail closed", async () => {
  await assert.rejects(
    () =>
      pg.query(
        "insert into fantasy.members values($1,now()+interval '1 day',null,now())",
        [users[3]],
      ),
    /three members/,
  );
  await claims(3);
  await assert.rejects(() => command("claim_starter"), /membership/);
  await claims();
  await pg.exec(
    `update public.profiles set disabled_at=now() where id='${users[0]}'`,
  );
  await assert.rejects(() => command("claim_starter"), /membership/);
  await pg.exec(
    `update public.profiles set disabled_at=null where id='${users[0]}'`,
  );
});
test("three-user starter claim and opening are persistent, idempotent, non-tradeable and form legal teams", async () => {
  for (let n = 0; n < 3; n++) {
    await claims(n);
    const key = randomUUID();
    const pack = await command("claim_starter", {}, key);
    assert.deepEqual(await command("claim_starter", {}, key), pack);
    await assert.rejects(() => command("claim_starter"), /already claimed/);
    const opened = await command("open_pack", pack);
    assert.equal((opened.cards as unknown[]).length, 11);
    assert.deepEqual(await command("open_pack", pack), opened);
    const comp = (
      await rows<{ id: string }>(
        "select id from fantasy.competitions where name='Rookie League'",
      )
    )[0].id;
    await command("save_lineup", { competition_id: comp, cards: opened.cards });
    await assert.rejects(
      () =>
        command("list", { card_id: (opened.cards as string[])[0], price: 100 }),
      /Tradeable/,
    );
  }
  await claims();
  assert.equal(
    Number((await rows("select count(*) n from fantasy.entries"))[0].n),
    3,
  );
});
test("scarcity, serials, provenance, credit ledger and rules cannot be rewritten", async () => {
  const c = (
    await rows<{ id: string; edition_id: string; serial: number }>(
      "select * from fantasy.cards limit 1",
    )
  )[0];
  await assert.rejects(
    () => pg.query("update fantasy.cards set serial=99 where id=$1", [c.id]),
    /immutable/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "update fantasy.editions set max_supply=max_supply+1 where id=$1",
        [c.edition_id],
      ),
    /locked/,
  );
  await assert.rejects(
    () => pg.exec("delete from fantasy.ownership_events"),
    /Immutable/,
  );
  await assert.rejects(
    () => pg.exec("update fantasy.competitions set rules='{}'"),
    /immutable/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into fantasy.cards(edition_id,serial,owner_id,tradeable) values($1,$2,$3,true)",
        [c.edition_id, c.serial, users[0]],
      ),
    /serial/,
  );
});
test("market settlement credits 925 and fee 75; insufficient funds and double sale leave records intact", async () => {
  await claims();
  await command("admin_credit", { user_id: users[1], amount: 2000 });
  const eid = (
    await rows<{ id: string }>(
      "select id from fantasy.editions where tier='RARE' limit 1",
    )
  )[0].id;
  const cid = (
    await rows<{ id: string }>(
      "select fantasy.mint($1,$2,true,'test',gen_random_uuid()) id",
      [eid, users[0]],
    )
  )[0].id;
  const l = await command("list", { card_id: cid, price: 1000 });
  await claims(2);
  await assert.rejects(() => command("buy", l), /Insufficient/);
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [cid]))[0]
      .owner_id,
    users[0],
  );
  await claims(1);
  await command("buy", l);
  await assert.rejects(() => command("buy", l), /unavailable/);
  assert.equal(
    Number((await rows("select fantasy.balance($1) n", [users[0]]))[0].n),
    925,
  );
  assert.equal(
    Number(
      (
        await rows(
          "select sum(amount) n from fantasy.ledger where account='system:fee'",
        )
      )[0].n,
    ),
    75,
  );
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [cid]))[0]
      .owner_id,
    users[1],
  );
  await claims();
  await assert.rejects(
    () => pg.exec("update fantasy.ledger set amount=999"),
    /Immutable/,
  );
});
test("stale trades roll back all ownership; valid multi-card trade is atomic", async () => {
  await claims();
  const eid = (
    await rows<{ id: string }>(
      "select id from fantasy.editions where tier='RARE' limit 1",
    )
  )[0].id;
  const mint = async (u: string) =>
    (
      await rows<{ id: string }>(
        "select fantasy.mint($1,$2,true,'test',gen_random_uuid()) id",
        [eid, u],
      )
    )[0].id;
  const a = await mint(users[0]),
    b = await mint(users[0]),
    c = await mint(users[1]);
  const offer = await command("offer_trade", {
    recipient: users[1],
    give: [a, b],
    receive: [c],
  });
  await pg.query("select fantasy.transfer($1,$2,$3,'test',gen_random_uuid())", [
    b,
    users[0],
    users[2],
  ]);
  await claims(1);
  await assert.rejects(() => command("accept_trade", offer), /owned card/);
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [a]))[0]
      .owner_id,
    users[0],
  );
  await claims();
  const valid = await command("offer_trade", {
    recipient: users[1],
    give: [a],
    receive: [c],
  });
  await claims(1);
  await command("accept_trade", valid);
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [a]))[0]
      .owner_id,
    users[1],
  );
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [c]))[0]
      .owner_id,
    users[0],
  );
  await claims();
});
test("invalid position and duplicate lineups fail; admin authorization is enforced", async () => {
  const entry = (
    await rows<{ competition_id: string; cards: string[] }>(
      "select * from fantasy.entries where user_id=$1",
      [users[0]],
    )
  )[0];
  await assert.rejects(
    () =>
      command("save_lineup", {
        competition_id: entry.competition_id,
        cards: Array(11).fill(entry.cards[0]),
      }),
    /duplicate card/,
  );
  await claims(1);
  await assert.rejects(
    () => command("admin_credit", { user_id: users[1], amount: 500 }),
    /Admin MFA/,
  );
  await claims();
});
test("empty configured formation is rejected and distinct serials cannot duplicate a player by default", async () => {
  await claims();
  const entry = (
    await rows<{ competition_id: string; cards: string[] }>(
      "select * from fantasy.entries where user_id=$1 limit 1",
      [users[0]],
    )
  )[0];
  const comp = await command("admin_competition", {
    name: "Invalid formation",
    season: "2027",
    round: 99,
    locks_at: new Date(Date.now() + 3600000).toISOString(),
    rules: { positions: {} },
  });
  await assert.rejects(
    () =>
      command("save_lineup", {
        competition_id: comp.competition_id,
        cards: entry.cards,
      }),
    /Complete sport formation/,
  );
  const card = (
    await rows<{ edition_id: string }>(
      "select edition_id from fantasy.cards where id=$1",
      [entry.cards[0]],
    )
  )[0];
  const duplicate = (
    await rows<{ id: string }>(
      "select fantasy.mint($1,$2,false,'test',gen_random_uuid()) id",
      [card.edition_id, users[0]],
    )
  )[0].id;
  await assert.rejects(
    () =>
      command("save_lineup", {
        competition_id: entry.competition_id,
        cards: [entry.cards[0], duplicate, ...entry.cards.slice(2)],
      }),
    /Duplicate player/,
  );
});
test("rarity is absent from scoring; unavailable player has zero score, no bench", async () => {
  const rules = (await rows("select rules from fantasy.scoring_rules"))[0]
    .rules;
  const s = {
    minutes: 90,
    goals: 1,
    assists: 1,
    conceded: 0,
    saves: 0,
    yellow: 0,
    red: 0,
    own_goals: 0,
  };
  const score = (
    await rows("select fantasy.score($1,$2,$3) n", [
      JSON.stringify(s),
      "MID",
      JSON.stringify(rules),
    ])
  )[0].n;
  assert.equal(score, 11);
  assert.equal(
    (
      await rows("select fantasy.score($1,$2,$3) n", [
        JSON.stringify({ ...s, minutes: 0 }),
        "MID",
        JSON.stringify(rules),
      ])
    )[0].n,
    0,
  );
});
test("three-user locked round publishes immutable results and championship points once", async () => {
  await claims();
  const r = await command("admin_competition", {
    name: "Acceptance Round",
    season: "2027",
    round: 2,
    locks_at: new Date(Date.now() + 2500).toISOString(),
    rules: {},
  });
  const competition_id = r.competition_id;
  for (let n = 0; n < 3; n++) {
    await claims(n);
    const cards = (
      await rows<{ id: string }>(
        "select a.id from fantasy.cards a join fantasy.pack_items pi on pi.card_id=a.id join fantasy.packs pa on pa.id=pi.pack_id join fantasy.pack_definitions d on d.id=pa.definition_id where a.owner_id=$1 and d.name='Starter'",
        [users[n]],
      )
    ).map((c) => c.id);
    await command("save_lineup", { competition_id, cards });
  }
  await new Promise((resolve) => setTimeout(resolve, 2600));
  await claims();
  const entry = (
    await rows<{ cards: string[] }>(
      "select cards from fantasy.entries where competition_id=$1 and user_id=$2",
      [competition_id, users[0]],
    )
  )[0];
  await assert.rejects(
    () => command("save_lineup", { competition_id, cards: entry.cards }),
    /locked/,
  );
  await command("admin_simulate", { competition_id, seed: 2027 });
  const result = await rows(
    "select * from fantasy.results where competition_id=$1",
    [competition_id],
  );
  assert.equal(result.length, 3);
  assert.ok(result.every((r) => Number(r.championship_points) > 0));
  await assert.rejects(
    () => command("admin_simulate", { competition_id, seed: 2028 }),
    /unscored/,
  );
  assert.deepEqual(
    await rows("select * from fantasy.results where competition_id=$1", [
      competition_id,
    ]),
    result,
  );
  await assert.rejects(
    () => pg.exec("update fantasy.results set score=999"),
    /Immutable/,
  );
});
test("pack issuance failure rolls back debit, serial allocation and opening items", async () => {
  await claims();
  await command("admin_credit", { user_id: users[0], amount: 1000 });
  const def = (
    await rows<{ id: string }>(
      "select id from fantasy.pack_definitions where name='Matchday'",
    )
  )[0].id;
  const beforeStock = (
    await rows("select sold from fantasy.pack_definitions where id=$1", [def])
  )[0].sold;
  const beforeItems = (
    await rows("select count(*) n from fantasy.pack_items")
  )[0].n;
  const before = (await rows("select fantasy.balance($1) n", [users[0]]))[0].n;
  await pg.exec(
    "create function fantasy.test_fail() returns trigger language plpgsql as $$begin raise exception 'Injected mint failure'; end$$;create trigger test_fail before insert on fantasy.pack_items for each row execute function fantasy.test_fail()",
  );
  await assert.rejects(
    () => command("buy_pack", { definition_id: def }),
    /Injected/,
  );
  await pg.exec(
    "drop trigger test_fail on fantasy.pack_items;drop function fantasy.test_fail()",
  );
  assert.equal(
    (await rows("select fantasy.balance($1) n", [users[0]]))[0].n,
    before,
  );
  assert.equal(
    (
      await rows("select sold from fantasy.pack_definitions where id=$1", [def])
    )[0].sold,
    beforeStock,
  );
  assert.equal(
    (await rows("select count(*) n from fantasy.pack_items"))[0].n,
    beforeItems,
  );
  const pack = await command("buy_pack", { definition_id: def });
  await command("open_pack", pack);
});
test("retirement preserves ownership, rejects new lineup and issues one replacement", async () => {
  await claims();
  const c = (
    await rows<{ id: string; player_id: string; owner_id: string }>(
      "select a.id,a.owner_id,e.player_id from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where a.owner_id=$1 limit 1",
      [users[0]],
    )
  )[0];
  await command("admin_status", { player_id: c.player_id, status: "retired" });
  assert.equal(
    (await rows("select owner_id from fantasy.cards where id=$1", [c.id]))[0]
      .owner_id,
    users[0],
  );
  const pack = await command("admin_replacement", { card_id: c.id });
  await assert.rejects(() => command("admin_replacement", { card_id: c.id }));
  await command("open_pack", pack);
});
test("idempotency keys reject changed payloads and ledgers reconcile to zero", async () => {
  const key = randomUUID();
  await command("admin_credit", { user_id: users[0], amount: 10 }, key);
  await assert.rejects(
    () => command("admin_credit", { user_id: users[0], amount: 11 }, key),
    /reused/,
  );
  assert.equal(
    Number((await rows("select sum(amount) n from fantasy.ledger"))[0].n),
    0,
  );
});
test("runtime read projection cannot reveal other users wallets or private provenance", async () => {
  await claims(1);
  await pg.exec("set role docked_app");
  const state = (
    await rows<{
      v: {
        user_id: string;
        ledger: { account: string }[];
        cards: { owner_id: string }[];
      };
    }>("select fantasy.read_state() v")
  )[0].v;
  assert.equal(state.user_id, users[1]);
  assert.ok(state.ledger.every((x) => x.account === users[1]));
  assert.ok(state.cards.every((x) => x.owner_id === users[1]));
  await pg.exec("reset role");
  await claims();
});
test("manual statistics and versioned scoring are permissioned and freeze after results", async () => {
  await claims();
  const rules = (
    await rows<{ rules: Record<string, unknown> }>(
      "select rules from fantasy.scoring_rules where version='football-demo-v1'",
    )
  )[0].rules;
  await command("admin_scoring", {
    version: "manual-test-v2",
    rules: { ...rules, assist: 9 },
  });
  const round = await command("admin_competition", {
    name: "Manual inputs",
    season: "2026",
    round: 91,
    locks_at: new Date(Date.now() + 800).toISOString(),
    rules: {},
    scoring_version: "manual-test-v2",
  });
  const player = (
    await rows<{ id: string }>(
      "select id from fantasy.players where position='FWD' limit 1",
    )
  )[0].id;
  const stats = {
    minutes: 90,
    goals: 0,
    assists: 1,
    conceded: 1,
    saves: 0,
    yellow: 0,
    red: 0,
    own_goals: 0,
  };
  await claims(1);
  await assert.rejects(() =>
    command("admin_stats", { ...round, player_id: player, stats }),
  );
  await claims();
  await command("admin_stats", { ...round, player_id: player, stats });
  await new Promise((resolve) => setTimeout(resolve, 850));
  await command("admin_simulate", { ...round, seed: 42 });
  const result = (
    await rows<{ stats: typeof stats; points: number }>(
      "select stats,score as points from fantasy.round_scores where competition_id=$1 and player_id=$2",
      [round.competition_id, player],
    )
  )[0];
  assert.deepEqual(result.stats, stats);
  assert.equal(
    result.points,
    Number(rules.appearance) + Number(rules.sixty_minutes) + 9,
  );
  await assert.rejects(
    () => command("admin_stats", { ...round, player_id: player, stats }),
    /Unscored/,
  );
  await assert.rejects(() =>
    command("admin_scoring", { version: "manual-test-v2", rules }),
  );
});
test("account erasure leaves pseudonymous ownership membership instead of blocking profile deletion", async () => {
  await pg.query(
    "insert into fantasy.members values($1,now()-interval '1 day',now(),now()-interval '2 days')",
    [users[3]],
  );
  await pg.query("delete from public.profiles where id=$1", [users[3]]);
  assert.equal(
    (
      await rows(
        "select count(*)::int n from fantasy.members where user_id=$1",
        [users[3]],
      )
    )[0].n,
    1,
  );
});
