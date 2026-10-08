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
    for (const u of users.slice(0, 4)) await reserve(u);
    let arrivals = 0;
    let release!: () => void;
    const snapshotsReady = new Promise<void>((resolve) => { release = resolve; });
    const repeatable = await Promise.allSettled(users.slice(4, 24).map((u) =>
      sql.begin('isolation level repeatable read', async (tx) => {
        await tx`select count(*) from beta_private.admissions`;
        if (++arrivals === 20) release();
        await snapshotsReady;
        return tx`select beta_private.reserve_admission(${u.email},${u.id},${hash(u.token)},${u.request},${new Date(Date.now()+3600000)},'local-repeatable-read')`;
      })
    ));
    assert.equal(repeatable.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(repeatable.filter(r => r.status === 'rejected').every(r => r.reason.code === '40001'));
    assert.equal(Number((await sql`select count(*) n from beta_private.admissions`)[0].n), 5);
    evidence.push('20 REPEATABLE READ snapshots: one reservation commits, nineteen serialize safely without exceeding capacity; fresh transactions can retry');
    const race = await Promise.allSettled(
      users.slice(4, 24).map((u) => reserve(u)),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 6);
    assert.equal(
      Number((await sql`select count(*) n from beta_private.admissions`)[0].n),
      10,
    );
    evidence.push(
      "20 fresh reservation/retry transactions fill remaining capacity: exactly ten lifetime testers",
    );
    const owner = users[24];
    await assert.rejects(() => reserve(owner), /limit/);
    await sql`insert into beta_private.designated_administrators(user_id,designated_by) values(${owner.id},'local-test-only')`;
    await reserve(owner);
    evidence.push(
      "Only an explicitly designated owner is excluded from the ten-tester cap",
    );
    await assert.rejects(() => accept(users[0]), /External tester/);
    await sql`update beta_private.admission_control set testers_enabled=true`;
    evidence.push(
      "Owner acceptance does not authorize external testers: separate database activation gate denies acceptance",
    );
    await assert.rejects(() => accept(users[0], "NZ"), /Australian/);
    await assert.rejects(
      () => accept(users[0], "AU", "VIC", false),
      /Australian/,
    );
    await assert.rejects(
      () => accept(users[0], "AU", "VIC", true, users[1].token),
      /Invalid/,
    );
    await assert.rejects(
      () =>
        accept(users[0], "AU", "VIC", true, users[0].token, users[1].session),
      /session/,
    );
    await sql`update auth.users set email_confirmed_at=null where id=${users[0].id}`;
    await assert.rejects(() => accept(users[0]), /session/);
    await sql`update auth.users set email_confirmed_at=clock_timestamp() where id=${users[0].id}`;
    const accepted = await Promise.all(
      Array.from({ length: 20 }, () => accept(users[0])),
    );
    assert.equal(new Set(accepted.map((r) => r[0].id)).size, 1);
    assert.equal(
      Number(
        (
          await sql`select count(*) n from beta_private.admission_events where action='accepted'`
        )[0].n,
      ),
      1,
    );
    for (const u of [...users.slice(1, 4), owner]) await accept(u);
    for (const u of [...users.slice(0, 4), owner]) await profile(u);
    evidence.push(
      "Single-use admission: twenty retries produce one receipt; wrong token, session, country, age and unverified email denied",
    );
    for (const u of users.slice(0, 3)) {
      const packs = await Promise.all(
        Array.from({ length: 20 }, () => command(u, "claim_starter")),
      );
      assert.equal(new Set(packs.map((p) => p.pack_id)).size, 1);
      const opened = await Promise.all(
        Array.from({ length: 20 }, () =>
          command(u, "open_pack", { pack_id: packs[0].pack_id }),
        ),
      );
      assert.equal(opened[0].cards.length, 11);
      for (const r of opened) assert.deepEqual(r.cards, opened[0].cards);
    }
    await assert.rejects(() =>
      command(users[0], "open_pack", { pack_id: officialPack.pack_id }),
    );
    const betaPack = (
      await beta`select pack_id from fantasy.starter_claims where user_id=${users[0].id}`
    )[0].pack_id;
    await assert.rejects(() =>
      command(users[0], "open_pack", { pack_id: betaPack }, false),
    );
    evidence.push(
      "Independent lifetime starter entitlements: same identity owns separate official and beta packs; cross-environment pack IDs rejected",
    );
    assert.equal(
      Number((await beta`select count(*) n from fantasy.cards`)[0].n),
      33,
    );
    assert.equal(
      (await beta`select 1 from fantasy.editions where issued>max_supply`)
        .length,
      0,
    );
    const day = await Promise.all(
      Array.from({ length: 20 }, () => command(users[0], "claim_daily")),
    );
    assert.equal(new Set(day.map((d) => d.claim_id)).size, 1);
    assert.equal(
      Number((await beta`select sum(points) n from fantasy.daily_claims`)[0].n),
      10,
    );
    evidence.push(
      "Sixty concurrent starter/open requests allocate exactly 33 cards; scarcity and twenty-way daily idempotency hold",
    );
    const rewardPolicy=(await beta`select max(version) version from fantasy.production_policy`)[0].version;
    // Six historic receipts are fixtures in this disposable loopback DB only.
    for(let priorDay=1;priorDay<=6;priorDay++) await beta`insert into fantasy.daily_claims(user_id,period,points,policy_version,card_outcome) values(${users[1].id},(clock_timestamp() at time zone 'UTC')::date-${priorDay}::integer,10,${rewardPolicy},'not_due')`;
    const seventh=await Promise.all(Array.from({length:20},()=>command(users[1],'claim_daily')));
    assert.equal(new Set(seventh.map(r=>r.claim_id)).size,1);
    assert.equal(new Set(seventh.map(r=>r.pack_id)).size,1);
    assert.equal(seventh[0].card_outcome,'awarded');
    assert.equal((await command(users[1],'open_pack',{pack_id:seventh[0].pack_id})).cards.length,1);
    assert.equal(Number((await beta`select count(*) n from fantasy.daily_claims where user_id=${users[1].id}`)[0].n),7);
    assert.equal(Number((await beta`select count(*) n from fantasy.ledger`)[0].n),0);
    assert.equal((await beta`select 1 from fantasy.editions where issued>max_supply`).length,0);
    evidence.push('Twenty simultaneous beta seventh claims allocate exactly one controlled card from beta supply; no money ledger entries or official changes');
    const rid = randomUUID();
    const response = await command(users[0], "claim_daily", {}, true, rid);
    assert.deepEqual(
      await command(users[0], "claim_daily", {}, true, rid),
      response,
    );
    await assert.rejects(
      () => command(users[0], "open_pack", { pack_id: betaPack }, true, rid),
      /reuse|request|Request/i,
    );
    evidence.push(
      "Lost-response receipt recovery is deterministic; request ID payload substitution rejected",
    );
    for (const role of ["anon", "authenticated", "docked_app"]) {
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            return tx`select beta_fantasy.production_command('claim_starter','{}',gen_random_uuid())`;
          }),
        /permission denied/,
      );
    }
    for (const query of [
      "select * from fantasy.cards",
      "select fantasy.production_command('claim_starter','{}',gen_random_uuid())",
      "select * from private.leaderboard_snapshots",
      "insert into beta_private.roles(user_id,role) values(gen_random_uuid(),'owner')",
      "update beta_private.admission_control set enabled=true",
    ])
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx`set local role docked_beta_app`;
            return tx.unsafe(query);
          }),
        /permission denied/,
      );
    assert.equal(
      (
        await sql`select 1 from pg_tables where schemaname in('beta_public','beta_private','beta_fantasy') and not rowsecurity`
      ).length,
      0,
    );
    const fks =
      await sql`select c.oid from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace join pg_class r on r.oid=c.confrelid join pg_namespace rn on rn.oid=r.relnamespace where c.contype='f' and n.nspname like 'beta_%' and rn.nspname in('public','private','fantasy')`;
    assert.equal(fks.length, 0);
    evidence.push(
      "All beta tables use RLS; browser/official roles denied beta commands; beta role denied official reads, writes and commands; no cross-gameplay foreign keys",
    );
    // Real persisted community data follows the same schema routing as cards.
    await beta`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('AU','VIC','local',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social','public_profiles','community_edges','leaderboards'],'Local isolation fixture only')`;
    for (let n = 0; n < 2; n++)
      await beta`insert into private.social_profiles(user_id,handle,display_name) values(${users[n].id},${"isolated_" + n},${"Isolated " + n})`;
    const social =
      await beta`select id,user_id from private.social_profiles where user_id=any(${users.slice(0, 2).map((u) => u.id)}) order by handle`;
    await beta.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${users[0].id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: users[0].id, session_id: users[0].session, aal: "aal1" })},true)`;
      await tx`set local role docked_beta_app`;
      await tx`select private.community_actor(${users[0].id},'community_social',true)`;
      await tx`insert into private.social_posts(author_id,kind,body,sport) values(${social[0].id},'discussion','Isolated NFL discussion','nfl')`;
      await tx`insert into private.social_follows(actor_id,target_id) values(${social[0].id},${social[1].id})`;
    });
    assert.equal(
      Number(
        (
          await beta`select count(*) n from private.social_posts where sport='nfl'`
        )[0].n,
      ),
      1,
    );
    assert.equal(
      (
        await beta`select enabled from private.competitions where id='americanfootball_nfl'`
      )[0].enabled,
      false,
    );
    evidence.push(
      "Persisted NFL community posting and following use beta tables; unverified NFL provider markets remain disabled",
    );
    const ownAdmission = (
      await sql`select id from beta_private.admissions where user_id=${users[1].id}`
    )[0].id;
    const manage = (u: User, aal: string) =>
      beta.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal })},true)`;
        await tx`set local role docked_beta_app`;
        return tx`select private.manage_admission(${ownAdmission},'suspended')`;
      });
    await assert.rejects(() => manage(users[0], "aal2"), /administrator/);
    await beta`insert into private.roles(user_id,role) values(${owner.id},'owner')`;
    // Commit a real beta fantasy result. Every stat is an authored local fixture;
    // no provider data, published prediction or official result is fabricated.
    const round = (
      await beta`insert into fantasy.competitions(name,sport,season,round,opens_at,locks_at,rules,scoring_id,prize) select 'Local isolated scored round',sport,season,99,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '15 seconds',rules,scoring_id,'No cash prize' from fantasy.competitions where id=(select competition_id from fantasy.production_rounds limit 1) returning id`
    )[0].id;
    await beta`insert into fantasy.production_rounds(competition_id) values(${round})`;
    const cards = (
      await beta`select id from fantasy.cards where owner_id=${users[0].id}`
    ).map((r) => r.id);
    await command(users[0], "save_lineup", { competition_id: round, cards });
    await sql`select pg_sleep(16)`;
    await assert.rejects(
      () => command(users[0], "save_lineup", { competition_id: round, cards }),
      /locked/,
    );
    await command(
      owner,
      "admin_simulate",
      { competition_id: round, seed: 7 },
      true,
      randomUUID(),
      "aal2",
    );
    assert.equal(
      Number(
        (
          await beta`select count(*) n from fantasy.results where competition_id=${round}`
        )[0].n,
      ),
      1,
    );
    assert.ok(
      Number(
        (await beta`select sum(championship_points) n from fantasy.results`)[0]
          .n,
      ) > 0,
    );
    await assert.rejects(
      () =>
        command(
          owner,
          "admin_simulate",
          { competition_id: round, seed: 7 },
          true,
          randomUUID(),
          "aal2",
        ),
      /unscored/,
    );
    // Monthly and lifetime snapshots exercise the same immutable community schema.
    await beta.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${owner.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.id, session_id: owner.session, aal: "aal2" })},true)`;
      for (const period of ["month", "all"])
        await tx`insert into private.leaderboard_snapshots(rule_version,period,as_of,source_hash,snapshot_hash,payload,actor,reason) values('top-docked-net-units-v1',${period},clock_timestamp(),${"b".repeat(64)},${"c".repeat(64)},'{"scope":"local-beta-fixture","rows":[]}',${owner.id},'Isolated namespace evidence fixture')`;
    });
    assert.equal(
      Number(
        (await beta`select count(*) n from private.leaderboard_snapshots`)[0].n,
      ),
      2,
    );
    evidence.push(
      "Persisted beta lineup, locked round, immutable scoring result and monthly/lifetime community snapshots remain outside official records",
    );
    // Failed transaction after a legitimate allocation must roll back all cards,
    // issuance counters, receipts and ownership events, without touching official.
    const counts = async () =>
      JSON.stringify(
        await beta`select (select count(*) from fantasy.cards) cards,(select count(*) from fantasy.ownership_events) history,(select sum(issued) from fantasy.editions) issued,(select count(*) from fantasy.requests) receipts`,
      );
    const beforeFailure = await counts();
    await assert.rejects(
      () =>
        beta.begin(async (tx) => {
          await tx`select set_config('request.jwt.claim.sub',${users[3].id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: users[3].id, session_id: users[3].session, aal: "aal1" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
          await tx`set local role docked_beta_app`;
          await tx`select fantasy.production_command('claim_starter','{}',${randomUUID()})`;
          throw Error("Authored rollback failure");
        }),
      /rollback/,
    );
    assert.equal(await counts(), beforeFailure);
    evidence.push(
      "Forced transaction failure rolls back card allocation, supply counters, ownership history and receipt together",
    );
    // Expiry and explicit renewal use a reserved existing slot, never a new slot.
    const pending = (
      await sql`select id,user_id from beta_private.admissions where status='reserved' limit 1`
    )[0];
    const pendingUser = users.find((u) => u.id === pending.user_id)!;
    async function adminReserve(actor: User, aal: string, candidate: User) {
      return beta.begin(async tx => {
        await tx`select set_config('request.jwt.claim.sub',${actor.id},true),set_config('request.jwt.claims',${JSON.stringify({sub:actor.id,session_id:actor.session,aal})},true)`;
        await tx`set local role docked_beta_app`;
        return tx`select private.admin_reserve_admission(${candidate.email},${candidate.id},${hash(candidate.token)},${candidate.request},${new Date(Date.now()+3600000)}) id`;
      });
    }
    assert.equal((await adminReserve(owner,'aal2',pendingUser))[0].id,pending.id);
    await assert.rejects(() => adminReserve(owner,'aal1',pendingUser), /MFA/);
    await assert.rejects(() => adminReserve(users[0],'aal2',pendingUser), /administrator|owner|role/i);
    await assert.rejects(() => adminReserve(owner,'aal2',users[25]), /limit/);
    evidence.push('Actual docked_beta_app administrator reservation RPC recovers an existing invitation, rejects non-MFA/member callers and refuses an eleventh tester');
    const newToken = randomBytes(32).toString("hex");
    await beta.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${owner.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.id, session_id: owner.session, aal: "aal2" })},true)`;
      await tx`set local role docked_beta_app`;
      await tx`select private.renew_admission(${pending.id},${hash(newToken)},clock_timestamp()+interval '100 milliseconds')`;
    });
    await sql`select pg_sleep(0.2)`;
    await assert.rejects(() => accept(pendingUser), /Invalid/);
    await assert.rejects(
      () => accept(pendingUser, "AU", "VIC", true, newToken),
      /expired/,
    );
    evidence.push(
      "Expired code denied; explicit MFA renewal invalidates the old code and preserves the original capacity reservation",
    );
    await assert.rejects(() => manage(owner, "aal1"), /MFA/);
    await manage(owner, "aal2");
    await assert.rejects(
      () => command(users[1], "claim_daily"),
      /account|consent|session/i,
    );
    await assert.rejects(() => accept(users[1]), /Invalid/);
    await assert.rejects(() => reserve(users[25]), /limit/);
    evidence.push(
      "Member cannot administer; designated owner requires MFA; suspension immediately denies existing sessions and cannot free a lifetime cap slot",
    );
    assert.equal(await snapshot(), before);
    evidence.push(
      "Byte-equivalent final snapshot of ALL official tables: cards, claims, competition points, monthly/lifetime rankings and member statistics unchanged",
    );
    const version = (await sql`select version() v`)[0].v;
    await mkdir("docs/qa/beta-isolation", { recursive: true });
    const migrationHashes: Record<string, string> = {};
    for (const f of betaMigrations)
      migrationHashes[f] = hash(
        (await readFile("supabase/migrations/" + f, "utf8")).replaceAll(
          "\r\n",
          "\n",
        ),
      );
    await writeFile(
      "docs/qa/beta-isolation/real-postgres.json",
      JSON.stringify(
        {
          scope: "disposable loopback PostgreSQL, not hosted",
          checkedAt: new Date().toISOString(),
          version,
          passed: true,
          migrationHashes,
          scenarios: evidence,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, scenarios: evidence }, null, 2));
  } finally {
    await sql.end();
  }
}
main().catch(async (error) => {
  await writeFile("docs/qa/beta-isolation/real-postgres.json", JSON.stringify({passed:false,checkedAt:new Date().toISOString(),scope:"disposable loopback PostgreSQL",completedScenarios:evidence,errorCode:error.code??null}));
  console.error(error);
  process.exitCode = 1;
});
