// Opt-in real PostgreSQL races. Never accepts cloud/Preview/production connections.
// Supply a new EMPTY local database named docked_free_play_test_<suffix>.
import postgres from "postgres";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";

async function main() {
  const value = process.env.FANTASY_TEST_DATABASE_URL;
  if (!value) throw Error("An explicit empty local test database is required");
  const target = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.hostname !== "127.0.0.1" ||
    !/^\/docked_free_play_test_[a-z0-9_]+$/.test(target.pathname) ||
    target.search ||
    target.hash
  )
    throw Error("Only an explicitly named loopback test database is allowed");
  const sql = postgres(value, { max: 8, ssl: false, connect_timeout: 10 });
  const ref = "abcdefghijklmnopqrst";
  const users = Array.from({ length: 5 }, () => randomUUID());
  const sessions = users.map(() => randomUUID());
  const results: string[] = [];
  try {
    const database = (
      await sql`select version() version, current_setting('server_encoding') encoding`
    )[0];
    assert.equal(
      database.encoding,
      "UTF8",
      "Use an isolated UTF-8 test database",
    );
    const existing =
      await sql`select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in('pg_catalog','information_schema') and n.nspname not like 'pg_toast%' and c.relkind in('r','v','m','S') limit 1`;
    assert.equal(existing.length, 0, "Test database must be empty");
    await sql.unsafe(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end$$;
create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await sql.unsafe(await readFile("supabase/migrations/" + f, "utf8"));
    await sql`select fantasy.initialize_production(${ref},'2026-10-v1','2026-10-v1')`;
    for (let n = 0; n < users.length; n++) {
      await sql`insert into auth.users(id,email_confirmed_at) values(${users[n]},clock_timestamp())`;
      await sql`insert into auth.sessions values(${sessions[n]},${users[n]},null)`;
      await sql`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${users[n]},'AU','NSW',true,'2026-10-v1')`;
      await sql`insert into private.consent_events(actor,user_id,purpose,granted,version) values('local-concurrency-fixture',${users[n]},'privacy',true,'2026-10-v1')`;
    }
    async function command(
      n: number,
      action: string,
      payload: Record<string, postgres.JSONValue> = {},
    ) {
      const output = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${users[n]},true),set_config('request.jwt.claims',${JSON.stringify({ sub: users[n], session_id: sessions[n], aal: "aal1" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
        await tx`set local role docked_app`;
        return await tx`select fantasy.production_command(${action},${tx.json(payload)}::jsonb,${randomUUID()}::uuid) result`;
      });
      return output[0].result;
    }
    const packs = await Promise.all(
      Array.from({ length: 20 }, () => command(0, "claim_starter")),
    );
    assert.equal(new Set(packs.map((p) => p.pack_id)).size, 1);
    const opens = await Promise.all(
      Array.from({ length: 20 }, () =>
        command(0, "open_pack", { pack_id: packs[0].pack_id }),
      ),
    );
    for (const p of opens) assert.deepEqual(p.cards, opens[0].cards);
    assert.equal(opens[0].cards.length, 11);
    results.push(
      "20 simultaneous starter claims and pack opens: one allocation",
    );
    const daily = await Promise.all(
      Array.from({ length: 20 }, () => command(0, "claim_daily")),
    );
    assert.equal(new Set(daily.map((p) => p.claim_id)).size, 1);
    assert.equal(
      Number((await sql`select sum(points) n from fantasy.daily_claims`)[0].n),
      10,
    );
    results.push("20 simultaneous daily claims: one award");
    await assert.rejects(() =>
      command(1, "open_pack", { pack_id: packs[0].pack_id }),
    );
    results.push("Cross-account opening denied");
    await command(4, "claim_starter");
    const policy = (
      await sql`select max(version) version from fantasy.production_policy`
    )[0].version;
    // Backdated receipts are fixtures only, inserted into this disposable database.
    for (let day = 1; day <= 6; day++)
      await sql`insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values(${users[4]},(clock_timestamp() at time zone 'UTC')::date-${day}::integer,10,${policy},'not_due')`;
    const rewards = await Promise.all(
      Array.from({ length: 20 }, () => command(4, "claim_daily")),
    );
    assert.equal(new Set(rewards.map((r) => r.claim_id)).size, 1);
    assert.equal(new Set(rewards.map((r) => r.pack_id)).size, 1);
    assert.equal(rewards[0].card_outcome, "awarded");
    assert.equal(
      (await command(4, "open_pack", { pack_id: rewards[0].pack_id })).cards
        .length,
      1,
    );
    assert.equal(
      Number(
        (
          await sql`select count(*) n from fantasy.daily_claims where user_id=${users[4]}`
        )[0].n,
      ),
      7,
    );
    assert.equal(
      Number((await sql`select count(*) n from fantasy.ledger`)[0].n),
      0,
    );
    results.push(
      "20 simultaneous seventh claims: one controlled card reward; no financial ledger entries",
    );
    for (const action of [
      "buy_pack",
      "list",
      "buy",
      "admin_credit",
      "offer_trade",
      "accept_trade",
    ])
      await assert.rejects(() => command(0, action), /unavailable/);
    for (const role of ["anon", "authenticated", "docked_app"])
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx`select * from fantasy.daily_claims`;
          }),
        /permission denied/,
      );
    assert.equal(
      (
        await sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fantasy' and c.relkind='r' and not c.relrowsecurity`
      ).length,
      0,
    );
    results.push(
      "Marketplace commands denied; private reward tables denied to all runtime roles; Fantasy RLS enabled",
    );
    await sql`insert into private.roles(user_id,role) values(${users[0]},'owner')`;
    await assert.rejects(
      () =>
        command(0, "admin_reward_policy", {
          daily_points: 10,
          card_every: 7,
          daily_card_limit: 100,
        }),
      /MFA/,
    );
    await assert.rejects(
      () =>
        sql`update fantasy.daily_claims set points=50 where user_id=${users[4]}`,
      /Immutable/,
    );
    await assert.rejects(
      () => sql`delete from fantasy.starter_claims where user_id=${users[0]}`,
      /Immutable/,
    );
    await assert.rejects(
      () => sql`update fantasy.editions set max_supply=max_supply+1`,
      /locked/,
    );
    results.push(
      "MFA required for owner policy changes; receipts and permanent supply cannot be rewritten",
    );
    let announce: () => void = () => {};
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820341)`;
      announce();
      await gate;
    });
    await held;
    await sql`update auth.sessions set not_after=clock_timestamp()+interval '300 milliseconds' where id=${sessions[1]}`;
    const waiting = command(1, "claim_starter").then(
      () => false,
      () => true,
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    release();
    await blocker;
    assert.equal(await waiting, true);
    assert.equal(
      (await sql`select 1 from fantasy.members where user_id=${users[1]}`)
        .length,
      0,
    );
    results.push(
      "Session expiry while waiting for transaction lock denies issuance",
    );
    await sql`update fantasy.pack_definitions set sold=max_quantity-1 where id=(select starter_definition from fantasy.production_catalog)`;
    const last = await Promise.allSettled([
      command(2, "claim_starter"),
      command(3, "claim_starter"),
    ]);
    assert.equal(last.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await sql`select 1 from fantasy.editions where issued>max_supply`)
        .length,
      0,
    );
    assert.equal(
      (
        await sql`select 1 from fantasy.cards c where not exists(select 1 from fantasy.ownership_events e where e.card_id=c.id and e.to_user=c.owner_id)`
      ).length,
      0,
    );
    results.push(
      "Two users race for final pack allocation: one success; provenance and supply intact",
    );
    const claimsBeforeTransition = Number(
      (await sql`select count(*) n from fantasy.daily_claims`)[0].n,
    );
    let transitionReady: () => void = () => {};
    let finishTransition: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      transitionReady = resolve;
    });
    const finish = new Promise<void>((resolve) => {
      finishTransition = resolve;
    });
    const transition = sql.begin(async (tx) => {
      await tx`insert into fantasy.production_releases(channel) values('stable')`;
      transitionReady();
      await finish;
    });
    await ready;
    const crossingClaim = command(0, "claim_daily").then(
      () => false,
      (error: Error) => /channel mismatch/.test(error.message),
    );
    try {
      let waitingForLock = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        waitingForLock =
          (
            await sql`select 1 from pg_locks where locktype='advisory' and not granted`
          ).length > 0;
        if (waitingForLock) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(
        waitingForLock,
        true,
        "Beta claim must actually wait behind the release transition",
      );
    } finally {
      finishTransition();
      await transition;
    }
    assert.equal(await crossingClaim, true);
    assert.equal(
      Number((await sql`select count(*) n from fantasy.daily_claims`)[0].n),
      claimsBeforeTransition,
    );
    results.push(
      "Release transition serializes against beta claim; waiting stale client denied without duplicate points",
    );
    await mkdir("docs/qa/fantasy-production", { recursive: true });
    await writeFile(
      "docs/qa/fantasy-production/real-postgres-races.json",
      JSON.stringify(
        {
          scope: "Disposable loopback PostgreSQL only; not production",
          checkedAt: new Date().toISOString(),
          database,
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ passed: results.length, scope: "local PostgreSQL" }),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    "Local PostgreSQL race verification failed or is unavailable. No success report produced; credentials omitted.",
  );
  process.exitCode = 1;
});
