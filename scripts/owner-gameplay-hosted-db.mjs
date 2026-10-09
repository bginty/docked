// Hosted BACKEND operator acceptance, not an authenticated HTTP/browser session.
// Uses the existing verified owner's active AAL2 session ID as normal DB context.
// No JWT is minted, password/factor secret read, account invited or Auth row changed.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
const app = ownerRuntimeDatabase();
const owner = JSON.parse(
  readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
).id;
const report = {
  at: new Date().toISOString(),
  projectRef,
  scope:
    "Hosted beta backend operator tests; real restricted SQL role and existing owner session context. Not HTTP session acceptance. Only isolated fictional QA data.",
  checks: [],
  failures: [],
};
const check = async (name, fn) => {
  try {
    await fn();
    report.checks.push({ name, pass: true });
  } catch (e) {
    report.checks.push({ name, pass: false });
    report.failures.push({
      name,
      code: e.code ?? "ASSERTION",
      message: String(e.message).slice(0, 220),
    });
    throw e;
  }
};
let session;
const context = async (tx, id = owner, aal = "aal2") => {
  await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: id, session_id: session, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
};
const command = (
  action,
  p = {},
  key = randomUUID(),
  id = owner,
  aal = "aal2",
) =>
  app.begin(async (tx) => {
    await context(tx, id, aal);
    return (
      await tx`select beta_fantasy.production_command(${action},${tx.json(p)},${key}) result`
    )[0].result;
  });
const state = () =>
  app.begin(async (tx) => {
    await context(tx);
    return (await tx`select beta_fantasy.production_read_state() state`)[0]
      .state;
  });
const counts = async () =>
  JSON.stringify(
    await sql`select (select count(*) from beta_fantasy.cards) cards,(select count(*) from beta_fantasy.ownership_events) ownership,(select sum(issued) from beta_fantasy.editions) issued,(select count(*) from beta_fantasy.requests) requests`,
  );
const snapshot = async () => {
  const rows = [];
  for (const t of await sql`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy') order by 1,2`) {
    assert.match(t.tablename, /^[a-z0-9_]+$/);
    rows.push({
      table: t.schemaname + "." + t.tablename,
      ...(
        await sql.unsafe(
          `select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${t.schemaname}.${t.tablename} t`,
        )
      )[0],
    });
  }
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
};
try {
  session = (
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>now()) order by created_at desc limit 1`
  )[0]?.id;
  assert.ok(
    session,
    "Existing owner AAL2 session required; no reset or setup permitted",
  );
  const before = await snapshot();
  const supply = JSON.stringify(
    await sql`select id,max_supply from beta_fantasy.editions order by id`,
  );
  await check("Exact owner, AAL2 and accepted admission required", async () => {
    await state();
    await assert.rejects(
      () => command("claim_starter", {}, randomUUID(), owner, "aal1"),
      /MFA/,
    );
    await assert.rejects(
      () => command("claim_starter", {}, randomUUID(), randomUUID()),
      /owner|MFA/i,
    );
  });
  await check(
    "Atomic rollback leaves issuance, ownership and receipts unchanged",
    async () => {
      const start = await counts();
      await assert.rejects(
        () =>
          app.begin(async (tx) => {
            await context(tx);
            await tx`select beta_fantasy.production_command('claim_starter','{}',${randomUUID()})`;
            throw Error("QA_ROLLBACK");
          }),
        /QA_ROLLBACK/,
      );
      assert.equal(await counts(), start);
    },
  );
  let pack;
  await check(
    "Eight concurrent starter requests allocate one permanent entitlement",
    async () => {
      const claims = await Promise.all(
        Array.from({ length: 8 }, () => command("claim_starter")),
      );
      assert.equal(new Set(claims.map((x) => x.pack_id)).size, 1);
      pack = claims[0].pack_id;
      assert.equal(
        Number(
          (
            await sql`select count(*) n from beta_fantasy.cards where owner_id=${owner}`
          )[0].n,
        ),
        11,
      );
    },
  );
  await check(
    "Open pack idempotency, collection details and complete provenance",
    async () => {
      const key = randomUUID(),
        first = await command("open_pack", { pack_id: pack }, key);
      assert.deepEqual(
        await command("open_pack", { pack_id: pack }, key),
        first,
      );
      const s = await state();
      assert.equal(s.cards.length, 11);
      assert.equal(s.provenance.length, 11);
      assert.equal(new Set(s.cards.map((c) => c.id)).size, 11);
      assert.ok(
        s.cards.every(
          (c) => c.serial > 0 && c.serial <= c.max_supply && !c.tradeable,
        ),
      );
    },
  );
  await check(
    "Market purchase, listing and trades denied in owner free play",
    async () => {
      for (const action of [
        "buy_pack",
        "list_card",
        "buy_listing",
        "offer_trade",
      ])
        await assert.rejects(() => command(action, {}), /unavailable/);
      const s = await state();
      assert.equal(s.market.length, 0);
      assert.equal(s.trades.length, 0);
      assert.equal(s.credits, 0);
    },
  );
  await check(
    "Runtime cannot edit cards, supply, owner gate, roles or audit history",
    async () => {
      for (const table of [
        "beta_fantasy.cards",
        "beta_fantasy.editions",
        "beta_fantasy.ownership_events",
        "beta_private.owner_gameplay_control",
        "beta_private.roles",
      ])
        await assert.rejects(
          () =>
            app.begin(async (tx) => {
              await context(tx);
              await tx.unsafe(`delete from ${table} where false`);
            }),
          /permission|denied/,
        );
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx`update beta_fantasy.editions set max_supply=max_supply+1 where status='launched'`;
          }),
        /immutable|supply/i,
      );
    },
  );
  const newRound = await command("admin_free_round", {
    name: "OWNER QA — simulated acceptance",
    season: "QA-2026",
    round: 99,
    locks_at: new Date(Date.now() + 15000).toISOString(),
  });
  const round = newRound.competition_id;
  const cards = (await state()).cards.map((c) => c.id);
  await check(
    "Lineup and competition entry persist atomically with duplicate retry",
    async () => {
      const key = randomUUID(),
        p = { competition_id: round, cards };
      const first = await command("save_lineup", p, key);
      assert.deepEqual(await command("save_lineup", p, key), first);
      assert.ok(
        (await state()).entries.some(
          (e) => e.competition_id === round && e.cards.length === 11,
        ),
      );
      await assert.rejects(
        () =>
          command("save_lineup", {
            competition_id: round,
            cards: [...cards.slice(1), randomUUID()],
          }),
        /owned|eligible|card/i,
      );
    },
  );
  await check(
    "Social profile, QA post, comment, reaction and save persist under owner role",
    async () => {
      await app.begin(async (tx) => {
        await context(tx);
        const sid = (
          await tx`select beta_private.community_actor(${owner},'community_social',true) id`
        )[0].id;
        const post = (
          await tx`insert into beta_private.social_posts(author_id,kind,body,sport) values(${sid},'discussion','OWNER QA — isolated fantasy gameplay acceptance. Fictional cards and simulated results only.','football') returning id`
        )[0].id;
        await tx`insert into beta_private.social_comments(post_id,author_id,body,idempotency_key) values(${post},${sid},'OWNER QA comment: interaction persistence check.',${randomUUID()})`;
        await tx`insert into beta_private.social_reactions(profile_id,post_id) values(${sid},${post})`;
        await tx`insert into beta_private.social_saved(profile_id,post_id) values(${sid},${post})`;
        assert.equal(
          Number(
            (
              await tx`select count(*) n from beta_private.social_reactions where post_id=${post}`
            )[0].n,
          ),
          1,
        );
      });
    },
  );
  const delay =
    Number(
      (
        await sql`select greatest(0,extract(epoch from (locks_at-clock_timestamp()))*1000) remaining from beta_fantasy.competitions where id=${round}`
      )[0].remaining,
    ) + 500;
  assert.ok(
    delay <= 60000,
    "Server clock difference exceeds bounded QA window",
  );
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  await check(
    "Deterministic simulated scoring, rankings and immutable settled results",
    async () => {
      await command("admin_simulate", { competition_id: round, seed: 42 });
      const s = await state(),
        r = s.results.find((r) => r.competition_id === round);
      assert.ok(r);
      assert.ok(Number.isFinite(Number(r.score)));
      assert.equal(r.rank, 1);
      await assert.rejects(
        () => command("admin_simulate", { competition_id: round, seed: 43 }),
        /unscored|locked|settled/i,
      );
      await assert.rejects(
        () => command("save_lineup", { competition_id: round, cards }),
        /lock|settled/i,
      );
      writeFileSync(
        "private-data/owner-gameplay/hosted-state.json",
        JSON.stringify(s),
      );
    },
  );
  await check(
    "Official records, real holdings and permanent supply limits unchanged",
    async () => {
      assert.equal(await snapshot(), before);
      assert.equal(
        JSON.stringify(
          await sql`select id,max_supply from beta_fantasy.editions order by id`,
        ),
        supply,
      );
      assert.ok(
        (
          await sql`select bool_and(issued<=max_supply) ok from beta_fantasy.editions`
        )[0].ok,
      );
      await sql`insert into beta_private.audit_events(actor,action,subject,details) values(${owner},'owner_gameplay_hosted_qa',${round},'{"scope":"fictional beta only","testers":false,"realMoney":false,"httpSessionTest":false}')`;
    },
  );
  report.passed = true;
} catch {
  report.passed = false;
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
  await app.end({ timeout: 5 });
  writeFileSync(
    "docs/qa/owner-gameplay/hosted-backend.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
