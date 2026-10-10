// Disposable loopback PostgreSQL only. No cloud credentials/accounts/email.
import postgres from "postgres";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { betaSql } from "../src/server/beta-sql";
const url = new URL(process.env.FANTASY_TEST_DATABASE_URL ?? "https://invalid");
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  url.hostname !== "127.0.0.1" ||
  !/^\/docked_free_play_test_[a-z0-9_]+$/.test(url.pathname) ||
  url.search ||
  url.hash
)
  throw Error("Isolated loopback database required");
const sql = postgres(url.href, { max: 24, ssl: false });
const beta = betaSql(sql);
const evidence: string[] = [];
const ref = "abcdefghijklmnopqrst";
const versions = {
  terms: "local-reviewed-v1",
  privacy: "local-reviewed-v1",
  beta: "local-reviewed-v1",
  community: "local-reviewed-v1",
  fantasy: "local-reviewed-v1",
  competition: "local-reviewed-v1",
  responsible_gambling: "local-reviewed-v1",
};
const digest = "a".repeat(64);
const users = Array.from({ length: 26 }, (_, n) => ({
  id: randomUUID(),
  session: randomUUID(),
  email: `isolated-${n}@example.invalid`,
  token: randomBytes(32).toString("hex"),
  request: randomUUID(),
}));
type User = (typeof users)[number];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const t of await sql`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy') order by 1,2`) {
    result[`${t.schemaname}.${t.tablename}`] = await sql.unsafe(
      `select to_jsonb(t)::text row from ${t.schemaname}.${t.tablename} t order by to_jsonb(t)::text`,
    );
  }
  return JSON.stringify(result);
}
async function reserve(u: User, expires = new Date(Date.now() + 3600000)) {
  return (
    await sql`select beta_private.reserve_admission(${u.email},${u.id},${hash(u.token)},${u.request},${expires},'local-fixture-operator') id`
  )[0].id;
}
async function accept(
  u: User,
  country = "AU",
  state = "VIC",
  adult = true,
  token = u.token,
  session = u.session,
) {
  return beta.begin(async (tx) => {
    await tx`set local role docked_beta_app`;
    return tx`select private.accept_admission(${token},${u.id},${session},${country},${state},${adult},${tx.json(versions)}) id`;
  });
}
async function command(
  u: User,
  action: string,
  payload: Record<string, postgres.JSONValue> = {},
  betaMode = true,
  request = randomUUID(),
  aal = "aal1",
) {
  return (betaMode ? beta : sql).begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
    await tx.unsafe(
      `set local role ${betaMode ? "docked_beta_app" : "docked_app"}`,
    );
    return (
      await tx`select fantasy.production_command(${action},${tx.json(payload)},${request}) result`
    )[0].result;
  });
}
async function profile(u: User, betaMode = true) {
  const q = betaMode ? beta : sql;
  await q`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${u.id},'AU','VIC',true,${versions.terms})`;
  await q`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${u.id},'privacy',true,${versions.privacy},'local-fixture')`;
}
async function main() {
  try {
    assert.equal(
      (await sql`select 1 from pg_tables where schemaname='public'`).length,
      0,
    );
    await sql.unsafe(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}');
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
    const migrations = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const betaMigrations = migrations.filter(
      (f) => f >= "20261008224142_beta_namespace_isolation.sql",
    );
    for (const f of migrations.filter((f) => !betaMigrations.includes(f)))
      await sql.unsafe(await readFile("supabase/migrations/" + f, "utf8"));
    await sql`select fantasy.initialize_production(${ref},${versions.terms},${versions.privacy})`;
    for (const u of users) {
      await sql`insert into auth.users(id,email,email_confirmed_at) values(${u.id},${u.email},clock_timestamp())`;
      await sql`insert into auth.sessions values(${u.session},${u.id},null)`;
    }
    await profile(users[0], false);
    const officialPack = await command(users[0], "claim_starter", {}, false);
    await command(
      users[0],
      "open_pack",
      { pack_id: officialPack.pack_id },
      false,
    );
    const before = await snapshot();
    for (const f of betaMigrations)
      await sql.unsafe(await readFile("supabase/migrations/" + f, "utf8"));
    assert.equal(await snapshot(), before);
    evidence.push(
      "Additive migrations preserve every official table, including existing cards and permanent starter entitlement",
    );
    await assert.rejects(() => reserve(users[0]), /policies/);
    await assert.rejects(() => profile(users[0]), /admission/);
    evidence.push(
      "Dormant control denies reservation and alternate profile creation",
    );
    await sql`update beta_private.admission_control set enabled=true,policy_digest=${digest},policy_versions=${sql.json(versions)},approved_by='local-test-only',approved_at=clock_timestamp()`;
    // Local-only operator fixture; not a policy approval in any hosted system.
    await beta`select fantasy.initialize_production(${ref},${versions.terms},${versions.privacy})`;

    const owner = users[0],
      tester = users[1],
      outsider = users[2];
    await sql`insert into beta_private.designated_administrators(user_id,designated_by) values(${owner.id},'local-only')`;
    await reserve(owner);
    await accept(owner);
    await profile(owner);
    await sql`insert into beta_private.roles(user_id,role) values(${owner.id},'owner')`;
    await sql`create table auth.mfa_factors(user_id uuid,status text)`;
    await sql`insert into auth.mfa_factors values(${owner.id},'verified')`;
    await sql`insert into beta_private.owner_gameplay_control(owner_id,enabled,authority) values(${owner.id},true,'Local two-person fixture only; not hosted activation')`;
    await sql`insert into beta_private.two_person_control(owner_id,tester_id,tester_enabled,authority) values(${owner.id},${tester.id},true,'Local two-person fixture only; not hosted activation')`;
    await sql`update beta_private.admission_control set testers_enabled=true`;
    const reserved = await Promise.all(
      Array.from({ length: 20 }, () => reserve(tester)),
    );
    assert.equal(new Set(reserved).size, 1);
    await assert.rejects(() => reserve(outsider), /designated tester/);
    await assert.rejects(
      () =>
        sql`update beta_private.two_person_control set tester_id=${outsider.id}`,
      /permanent/,
    );
    await Promise.all(Array.from({ length: 20 }, () => accept(tester)));
    await profile(tester);
    assert.equal(
      Number(
        (
          await sql`select count(*) n from beta_private.admissions where not administrator`
        )[0].n,
      ),
      1,
    );
    evidence.push(
      "20 concurrent invitation reservations and acceptances yield one tester; other identities and roster replacement denied",
    );
    async function memberSession(u: User, aal: string) {
      return beta.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal })},true)`;
        return (await tx`select private.active_member_session() allowed`)[0]
          .allowed;
      });
    }
    assert.equal(await memberSession(owner, "aal1"), false);
    assert.equal(await memberSession(owner, "aal2"), true);
    assert.equal(await memberSession(tester, "aal1"), true);
    evidence.push(
      "Shared member-session gate denies owner AAL1, permits owner AAL2 and ordinary tester AAL1",
    );
    await assert.rejects(() => command(owner, "claim_starter"), /MFA/);
    for (const u of [owner, tester]) {
      const pack = await command(
        u,
        "claim_starter",
        {},
        true,
        randomUUID(),
        u === owner ? "aal2" : "aal1",
      );
      await command(
        u,
        "open_pack",
        { pack_id: pack.pack_id },
        true,
        randomUUID(),
        u === owner ? "aal2" : "aal1",
      );
    }
    await assert.rejects(
      () => command(tester, "admin_free_round", {}, true, randomUUID(), "aal1"),
      /MFA|denied|privileged/i,
    );
    await assert.rejects(
      () => command(outsider, "claim_starter", {}, true, randomUUID(), "aal2"),
      /MFA|admitted/i,
    );
    evidence.push(
      "Ordinary tester without any MFA factor claims and opens 11 cards at AAL1; owner at AAL1 and tester admin operation denied",
    );
    async function swap(
      u: User,
      a: string,
      p: Record<string, postgres.JSONValue> = {},
      req = randomUUID(),
      aal = u === owner ? "aal2" : "aal1",
    ) {
      return beta.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
        await tx`set local role docked_beta_app`;
        return (
          await tx`select fantasy.swap_command(${a},${tx.json(p)},${req}) result`
        )[0].result;
      });
    }
    async function read(u: User) {
      return beta.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal: u === owner ? "aal2" : "aal1" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
        await tx`set local role docked_beta_app`;
        return (await tx`select fantasy.swap_read_state() state`)[0].state;
      });
    }
    await assert.rejects(() => read(tester), /unavailable/);
    await sql`update beta_fantasy.swap_policy set enabled=true`;
    for (const u of [owner, tester]) {
      await swap(u, "practice_credit");
      await swap(u, "practice_credit");
      const reserves = await Promise.all(
        Array.from({ length: 10 }, () => swap(u, "reserve_pack")),
      );
      assert.equal(new Set(reserves.map((r) => r.pack_id)).size, 1);
      await command(
        u,
        "open_pack",
        { pack_id: reserves[0].pack_id },
        true,
        randomUUID(),
        u === owner ? "aal2" : "aal1",
      );
    }
    assert.equal(
      Number((await sql`select count(*) n from beta_fantasy.cards`)[0].n),
      44,
    );
    await assert.rejects(
      () => swap(tester, "fee_mode", { mode: "paid" }),
      /Owner MFA/,
    );
    await assert.rejects(
      () => swap(owner, "fee_mode", { mode: "paid" }, randomUUID(), "aal1"),
      /MFA/,
    );
    await swap(owner, "fee_mode", { mode: "paid" });
    const state = await read(owner);
    const give = state.cards.find(
      (c: any) => c.owner_id === owner.id && c.position === "GK",
    ).id;
    const take = state.cards.find(
      (c: any) => c.owner_id === tester.id && c.position === "GK",
    ).id;
    const offer = await swap(owner, "offer", {
      give_card: give,
      take_card: take,
      fee_cents: 250,
      policy_revision: state.window.revision,
    });
    const receiptReq = randomUUID();
    const payload = { swap_id: offer.swap_id, fee_cents: 250 };
    const accepted = await Promise.all(
      Array.from({ length: 20 }, () =>
        swap(tester, "accept", payload, receiptReq),
      ),
    );
    assert.equal(new Set(accepted.map((r) => r.swap_id)).size, 1);
    await assert.rejects(() => swap(tester, "accept", payload), /completed/);
    assert.equal((await read(owner)).balance_cents, 9750);
    assert.equal((await read(tester)).balance_cents, 9750);
    assert.equal(
      (await sql`select owner_id from beta_fantasy.cards where id=${give}`)[0]
        .owner_id,
      tester.id,
    );
    assert.equal(
      (await sql`select owner_id from beta_fantasy.cards where id=${take}`)[0]
        .owner_id,
      owner.id,
    );
    assert.equal(
      Number(
        (
          await sql`select count(*) n from beta_fantasy.ownership_events where reason='two-person-sandbox-swap'`
        )[0].n,
      ),
      2,
    );
    evidence.push(
      "Reserve pack 10-way races allocate once per participant; 20 acceptance retries transfer both cards once and charge exactly 250 simulated cents each",
    );
    const offerPayload = {
      give_card: take,
      take_card: give,
      fee_cents: 250,
      policy_revision: state.window.revision,
    };
    const stale = await swap(owner, "offer", offerPayload);
    await swap(owner, "fee_mode", { mode: "free" });
    await assert.rejects(
      () => swap(tester, "accept", { swap_id: stale.swap_id, fee_cents: 250 }),
      /expired/,
    );
    await swap(owner, "cancel", { swap_id: stale.swap_id });
    const freeState = await read(owner);
    const freeOffer = await swap(owner, "offer", {
      ...offerPayload,
      fee_cents: 0,
      policy_revision: freeState.window.revision,
    });
    await assert.rejects(
      () => swap(owner, "accept", { swap_id: freeOffer.swap_id, fee_cents: 0 }),
      /permission/,
    );
    await assert.rejects(
      () =>
        swap(outsider, "accept", { swap_id: freeOffer.swap_id, fee_cents: 0 }),
      /MFA|admitted/,
    );
    await swap(tester, "reject", { swap_id: freeOffer.swap_id });
    const free = await swap(owner, "offer", {
      ...offerPayload,
      fee_cents: 0,
      policy_revision: freeState.window.revision,
    });
    await swap(tester, "accept", { swap_id: free.swap_id, fee_cents: 0 });
    assert.equal((await read(owner)).balance_cents, 9750);
    evidence.push(
      "Owner-only paid/free controls; stale fee quote rejected; sender self-accept and outsider denied; reject/cancel do not transfer; free acceptance charges zero",
    );

    // Two pending offers compete for the same card: only one can commit.
    const current = await read(owner);
    const payloadOffer = {
      give_card: give,
      take_card: take,
      fee_cents: 0,
      policy_revision: current.window.revision,
    };
    const a = await swap(owner, "offer", payloadOffer),
      b = await swap(owner, "offer", payloadOffer);
    const raced = await Promise.allSettled(
      [a, b].map((o) =>
        swap(tester, "accept", { swap_id: o.swap_id, fee_cents: 0 }),
      ),
    );
    assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
    // Force an insert failure after ownership updates: the whole trade must roll back.
    const returnOffer = await swap(owner, "offer", {
      ...payloadOffer,
      give_card: take,
      take_card: give,
    });
    await sql.unsafe(
      `create function beta_fantasy.local_test_fail_fee() returns trigger language plpgsql as $$begin if new.kind='swap_fee' then raise exception 'Local injected ledger failure';end if;return new;end$$;create trigger local_test_fail_fee before insert on beta_fantasy.swap_ledger for each row execute function beta_fantasy.local_test_fail_fee();`,
    );
    const preFailure = JSON.stringify(await read(owner));
    await assert.rejects(
      () =>
        swap(tester, "accept", { swap_id: returnOffer.swap_id, fee_cents: 0 }),
      /injected/,
    );
    const afterFailure = await read(owner),
      beforeFailure = JSON.parse(preFailure);
    for (const key of [
      "cards",
      "swaps",
      "balance_cents",
      "ownership_history",
      "ledger",
    ])
      assert.deepEqual(afterFailure[key], beforeFailure[key]);
    await sql.unsafe(
      "drop trigger local_test_fail_fee on beta_fantasy.swap_ledger;drop function beta_fantasy.local_test_fail_fee()",
    );
    await swap(tester, "accept", {
      swap_id: returnOffer.swap_id,
      fee_cents: 0,
    });
    // An unsettled saved team keeps its cards even though they are beta-swap eligible.
    const comp = await command(
      owner,
      "admin_free_round",
      {
        name: "Local lineup restriction",
        season: "2026",
        round: 77,
        locks_at: new Date(Date.now() + 3600000).toISOString(),
      },
      true,
      randomUUID(),
      "aal2",
    );
    const lineup = (
      await sql`select i.card_id from beta_fantasy.pack_items i join beta_fantasy.starter_claims s on s.pack_id=i.pack_id where s.user_id=${owner.id} order by i.slot`
    ).map((r) => r.card_id);
    await command(
      owner,
      "save_lineup",
      { competition_id: comp.competition_id, cards: lineup },
      true,
      randomUUID(),
      "aal2",
    );
    await assert.rejects(
      () => swap(owner, "offer", { ...payloadOffer, give_card: lineup[0] }),
      /lineup/,
    );
    evidence.push(
      "Competing offers cannot double-trade; injected fee-ledger failure rolls back both ownership changes; saved unsettled lineup blocks swapping",
    );
    const officialBefore = before;
    assert.equal(await snapshot(), officialBefore);
    for (const text of [
      "select * from beta_private.two_person_control",
      "update beta_fantasy.cards set owner_id=owner_id",
      "select * from fantasy.cards",
      "update beta_fantasy.swap_ledger set amount_cents=10000",
    ]) {
      await assert.rejects(() =>
        sql.begin(async (tx) => {
          await tx`set local role docked_beta_app`;
          return tx.unsafe(text);
        }),
      );
    }
    await assert.rejects(
      () => sql`update beta_fantasy.swap_ledger set amount_cents=10000`,
      /immutable/,
    );
    await sql`update beta_private.admissions set status='suspended' where user_id=${tester.id}`;
    await assert.rejects(
      () => read(tester),
      /eligible|admission|session|current-consent/i,
    );
    evidence.push(
      "Runtime cannot read official assets or directly edit sandbox cards, balances or control; ledger immutable; suspension immediately denies tester",
    );
    assert.equal(await snapshot(), before);
    const output = process.argv.includes("--friends") ? "docs/qa/friends-release" : "docs/qa/two-person-beta";
    if(process.argv.includes("--friends")) {
      await sql`update beta_private.friends_control set enabled=true,readiness_evidence='Synthetic local acceptance only; not hosted policy approval',approved_by='local-test',approved_at=clock_timestamp()`;
      await sql`insert into beta_private.friends_roster(user_id,email,enabled,authority) values(${tester.id},${tester.email},true,'Synthetic roster only; preserves suspended admission')`;
      const rosters=await Promise.allSettled(users.slice(2,20).map(u=>sql`insert into beta_private.friends_roster(user_id,email,enabled,authority) values(${u.id},${u.email},true,'Synthetic named ordinary tester; local tests only')`));
      assert.equal(rosters.filter(r=>r.status==='fulfilled').length,9);
      const roster=await sql`select user_id from beta_private.friends_roster where user_id<>${tester.id}`;
      for(const r of roster){const u=users.find(u=>u.id===r.user_id)!;await reserve(u);await accept(u);await profile(u);assert.equal(await memberSession(u,'aal1'),true);}
      assert.equal(Number((await sql`select count(*) n from beta_private.admissions where not administrator`)[0].n),10);
      assert.equal(await memberSession(tester,'aal1'),false);
      const reportRead=(u:User,aal:string,staff=false)=>sql.begin(async tx=>{await tx`set local role docked_beta_app`;await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({sub:u.id,session_id:u.session,aal})},true)`;return (await tx`select beta_private.owner_operations(clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days',null,${staff}) value`)[0].value;});
      await assert.rejects(()=>reportRead(owner,'aal1'),/MFA/);
      const ordinary=users.find(u=>u.id===roster[0].user_id)!;await assert.rejects(()=>reportRead(ordinary,'aal1'),/MFA/);await assert.rejects(()=>reportRead(ordinary,'aal2'),/MFA/);
      const dashboard=await reportRead(owner,'aal2');assert.equal(dashboard.metrics.admitted,9);assert.equal((await reportRead(owner,'aal2',true)).metrics.admitted,10);
      const friendA=ordinary,friendB=users.find(u=>u.id===roster[1].user_id)!;
      for(const u of [friendA,friendB]){const pack=await command(u,'claim_starter',{},true,randomUUID(),'aal1');await command(u,'open_pack',{pack_id:pack.pack_id},true,randomUUID(),'aal1');}
      const friendState=await read(friendA);assert.equal(friendState.mode,'FRIENDS_CARD_SWAP');assert.equal(friendState.window.fee_cents,0);
      const friendGive=friendState.cards.find((c:any)=>c.owner_id===friendA.id).id,friendTake=friendState.cards.find((c:any)=>c.owner_id===friendB.id).id;
      const proposed=await swap(friendA,'offer',{give_card:friendGive,take_card:friendTake,fee_cents:0,policy_revision:friendState.window.revision});
      const acceptKey=randomUUID();const accepted=await Promise.all(Array.from({length:20},()=>swap(friendB,'accept',{swap_id:proposed.swap_id,fee_cents:0},acceptKey)));
      assert.ok(accepted.every(r=>r.state==='accepted'));
      assert.equal(Number((await sql`select count(*) n from beta_fantasy.ownership_events where reference=${proposed.swap_id}`)[0].n),2);
      assert.equal(Number((await sql`select coalesce(sum(amount_cents),0) n from beta_fantasy.swap_ledger where reference=${proposed.swap_id}`)[0].n),0);
      await assert.rejects(()=>swap(owner,'fee_mode',{mode:'paid'}),/no fees/);
      await assert.rejects(()=>swap(friendA,'practice_credit'),/no fees/);
      evidence.push('Two ordinary roster members swap free at AAL1; twenty acceptance retries produce exactly two ownership entries, no fees; paid fee modes and balance credits rejected');
      assert.equal((await reportRead(owner,'aal2')).inventory.reduce((n:number,e:any)=>n+e.cards,0),Number((await sql`select count(*) n from beta_fantasy.cards`)[0].n));
      assert.equal(await snapshot(),before);
      evidence.push('Friends roster concurrency admits exactly ten lifetime slots; revoked/suspended slot is not recycled; ordinary AAL1 succeeds, owner MFA persists; owner reports reconcile source counts and deny member/AAL1');
    }
    await mkdir(output, { recursive: true });
    const report = {
      passed: true,
      scope:
        "Disposable real loopback PostgreSQL, synthetic accounts; not hosted or physical-device acceptance",
      version: (await sql`select version() v`)[0].v,
      checkedAt: new Date().toISOString(),
      migrationHashes: Object.fromEntries(
        await Promise.all(
          betaMigrations.map(async (f) => [
            f,
            hash(
              (await readFile("supabase/migrations/" + f, "utf8")).replaceAll(
                "\r\n",
                "\n",
              ),
            ),
          ]),
        ),
      ),
      scenarios: evidence,
    };
    await writeFile(
      output + "/real-postgres.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
