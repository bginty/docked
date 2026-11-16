/** Disconnected clone of the authenticated restore. Real SQL/RLS and handlers;
 * simulated sessions, no hosted Auth/SMS/customer transactions. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { batch1Database, batch1Target } from "./lib/batch1-isolated-db";
import { batch1RouteFixture } from "./lib/batch1-route-fixture";
import { localEnvironment } from "./batch1-route-smoke";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
import { wallet } from "../src/core/credits-sandbox";

const dir = "docs/qa/batch1-pack-phone-20261116";
const migrations = [
  "20261115113306_batch_private_pack_issuance_validation.sql",
  "20261115211545_batch1_pack_guard_batching.sql",
  "20261115235000_batch1_persistence_subdocuments.sql",
];
const checks: string[] = [];
const digest = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
async function main() {
  localEnvironment();
  mkdirSync(dir, { recursive: true });
  // Constructor verifies network=none and no host ports before any command.
  const probe = batch1Database("postgres");
  await probe`select 1`;
  await probe.end({ timeout: 5 });
  const psql = (query: string) =>
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        batch1Target,
        "psql",
        "-X",
        "-q",
        "-h",
        "/restore",
        "-U",
        "postgres",
        "-d",
        "template1",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      {
        input: query,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  assert.equal(
    psql("select count(*) from pg_database where datname='batch1';").trim(),
    "0",
    "A prior test database exists; do not interrupt/restart it",
  );
  assert.equal(
    psql(
      "select count(*) from pg_stat_activity where datname='postgres' and backend_type='client backend';",
    ).trim(),
    "0",
    "An isolated test is still active; do not interrupt it",
  );
  // The disabled pg_cron scheduler still holds a database connection. Briefly
  // prevent reconnects in this network-isolated restore while PostgreSQL clones
  // it. No job definition/data changes; restore the connection flag on failure.
  try {
    psql(
      "alter database postgres allow_connections false;\nselect pg_terminate_backend(pid) from pg_stat_activity where datname='postgres' and backend_type='pg_cron launcher';\ncreate database batch1 template postgres;",
    );
  } finally {
    psql("alter database postgres allow_connections true;");
  }
  const observer = batch1Database("batch1");
  const runtime = batch1Database("batch1", 24, true);
  const checksum = async () => {
    const [{ value: tables }] = await observer.unsafe(tableListQuery);
    const result = [];
    for (const table of tables)
      result.push((await observer.unsafe(checksumQuery(table)))[0].value);
    return result;
  };
  const state = async () =>
    (await observer`select document from credits_sandbox.state where id`)[0]
      .document;
  const stateDigest = async () => digest(await state());
  const metadata = async () =>
    await observer`select p.oid::text,p.proowner,p.proacl,p.prosecdef,p.proconfig from pg_proc p where p.oid in('credits_sandbox.guard_economy_state()'::regprocedure,'credits_sandbox.project_fixture_inventory()'::regprocedure,'commercial_billing.prevent_parallel_inventory()'::regprocedure,'sports_feed.rarity_transfer_guard()'::regprocedure) order by p.oid`;
  let completed = false;
  try {
    const before = await checksum(),
      security = await metadata();
    const [oldProject] =
      await observer`select pg_get_functiondef('credits_sandbox.project_fixture_inventory()'::regprocedure) body`;
    const [{ value: custody }] = await observer.unsafe(custodyQuery);
    assert.equal(custody.length, 908);
    await observer.begin(async (tx) => {
      for (const name of migrations)
        await tx.unsafe(readFileSync(`supabase/migrations/${name}`, "utf8"));
    });
    assert.deepEqual(await checksum(), before);
    assert.deepEqual(await metadata(), security);
    checks.push(
      `${before.length} protected tables unchanged by migrations; function owners/ACLs/security/search paths unchanged; 908 custody records preserved`,
    );
    const [owner] =
      await observer`select a.user_id,(select s.id from auth.sessions s where s.user_id=a.user_id and s.aal='aal2' order by updated_at desc limit 1) session_id from credits_sandbox.access a where a.kind='owner' and a.enabled`;
    const founder = {
      user: { id: String(owner.user_id) },
      aal: "aal2",
      sessionId: owner.session_id,
    };
    let [tester] =
      await observer`select s.user_id,s.id from auth.sessions s where s.user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid order by updated_at desc limit 1`;
    if (!tester)
      [tester] =
        await observer`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(${randomUUID()}::uuid,'d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid,now(),now(),'aal1') returning user_id,id`;
    const other = {
      user: { id: String(tester.user_id) },
      aal: "aal1",
      sessionId: tester.id,
    };
    let route = await batch1RouteFixture();
    const send = async (body: any, who = founder) => {
      const errors: any[] = [];
      const start = performance.now();
      const response = await route.run({ sql: runtime, who, errors }, () =>
        route.POST(
          new Request(
            "http://127.0.0.1:3033/api/test-wallet?view=packs&result=receipt",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Origin: "http://127.0.0.1:3033",
              },
              body: JSON.stringify(body),
            },
          ),
        ),
      );
      return {
        status: response.status,
        body: await response.json(),
        durationMs: Math.round(performance.now() - start),
        errors,
      };
    };
    const initial = await state();
    const product = Object.values(
      initial.economy.products as Record<string, any>,
    ).find(
      (p) =>
        p.sport === "nfl" &&
        p.type === "STANDARD" &&
        p.cards === 9 &&
        p.cataloguePolicy === "founder-credit-season-v1",
    )!;
    assert(product);
    const request = randomUUID();
    const buy = {
      request,
      command: {
        kind: "buy-pack",
        product: product.id,
        configuration: product.version,
        confirmed: true,
        policy: initial.policy.version,
        expectedPrice: product.priceCredits,
      },
    };
    // Warm the 24 restricted connections before measuring contention.
    const reserved = await Promise.all(
      Array.from({ length: 24 }, () => runtime.reserve()),
    );
    for (const connection of reserved) connection.release();
    const raced = await Promise.all(
      Array.from({ length: 24 }, () => send(buy)),
    );
    assert(
      raced.every((r) => r.status === 200),
      JSON.stringify(
        raced.filter((r) => r.status !== 200).map((r) => r.errors),
      ),
    );
    assert(
      raced.every(
        (r) =>
          r.body.packUpdate.pack.id === request &&
          r.body.packUpdate.pack.cardCount === 9,
      ),
    );
    const bought = await state();
    const cardIds = bought.economy.packs[request].cards;
    assert.equal(new Set(cardIds).size, 9);
    assert.equal(bought.journal.length, initial.journal.length + 1);
    assert.equal(
      wallet(bought, founder.user.id).available,
      wallet(initial, founder.user.id).available - product.priceCredits,
    );
    for (const r of raced)
      assert.deepEqual(
        r.body.packUpdate.wallet,
        wallet(bought, founder.user.id),
      );
    assert.equal(
      Number(
        (
          await observer`select count(*) n from beta_packs.issued where pack=${request}`
        )[0].n,
      ),
      9,
    );
    assert.equal(
      Number(
        (
          await observer`select sum(issued) n from commercial_billing.definitions`
        )[0].n,
      ),
      899,
    );
    checks.push(
      "24 simultaneous duplicate purchases: one debit, one entitlement, nine unique allocations; lifetime total 890 → 899 only inside disposable clone",
    );
    let saved = await stateDigest();
    assert.equal(
      (
        await send({
          ...buy,
          command: { ...buy.command, expectedPrice: product.priceCredits + 1 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(
          {
            request: randomUUID(),
            command: { kind: "open-pack", entitlement: request },
          },
          other,
        )
      ).status,
      400,
    );
    assert.notEqual((await send(buy, { ...founder, aal: "aal1" })).status, 200);
    assert.equal(await stateDigest(), saved);
    await observer`update credits_sandbox.access set enabled=false where user_id=${founder.user.id}::uuid`;
    assert.notEqual((await send(buy)).status, 200);
    await observer`update credits_sandbox.access set enabled=true where user_id=${founder.user.id}::uuid`;
    checks.push(
      "Conflicting request bytes, another member's entitlement, missing founder MFA and revoked admission denied without wallet or issuance changes",
    );
    // Drop the process/module memory: only the committed request is reusable.
    route = await batch1RouteFixture();
    const recovered = await send(buy);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.packUpdate.pack.id, request);
    assert.equal(await stateDigest(), saved);
    checks.push(
      "Discarded response and handler restart recover the same committed entitlement with no new debit or cards",
    );
    const historical = Object.entries(
      initial.requests as Record<string, any>,
    ).find(([key, value]) => {
      if (!key.startsWith(founder.user.id + ":")) return false;
      const command = JSON.parse(value.fingerprint).c;
      return (
        command.kind === "buy-pack" &&
        initial.economy.packs[value.result?.entitlement]?.product.cards === 1
      );
    });
    assert(
      historical,
      "Expected existing one-card request in restored evidence",
    );
    const historic = await send({
      request: historical[0].slice(founder.user.id.length + 1),
      command: JSON.parse(historical[1].fingerprint).c,
    });
    assert.equal(historic.status, 200);
    assert.equal(historic.body.packUpdate.pack.cardCount, 1);
    assert.equal(await stateDigest(), saved);
    checks.push(
      "Existing saved one-card purchase remains one card; it is not reinterpreted as a nine-card offer",
    );
    await observer`insert into season_catalogue.decisions(rights_id,blocked,reason,authority_reference) select id,true,'Isolated retained-use withdrawal fixture','Batch 1 disconnected acceptance only' from season_catalogue.rights where sport='nfl'`;
    const denied = await send({ ...buy, request: randomUUID() });
    assert.notEqual(denied.status, 200);
    assert.equal(await stateDigest(), saved);
    checks.push(
      "Explicit source-rights withdrawal blocks new purchase atomically",
    );
    // Reset ONLY the disposable rate-limit fixture between independent scenarios.
    await observer`update beta_private.rate_limits set reset_at=now()-interval '1 second' where key=${`test-wallet:${founder.user.id}`}`;
    const open = {
      request: randomUUID(),
      command: { kind: "open-pack", entitlement: request },
    };
    const openings = await Promise.all(
      Array.from({ length: 24 }, () => send(open)),
    );
    assert(
      openings.every((r) => r.status === 200),
      JSON.stringify(
        openings.filter((r) => r.status !== 200).map((r) => r.errors),
      ),
    );
    for (const r of openings)
      assert.deepEqual(
        r.body.result.cards.map((c: any) => c.id),
        cardIds,
      );
    const opened = await state();
    assert.equal(opened.journal.length, bought.journal.length);
    assert.equal(
      wallet(opened, founder.user.id).available,
      wallet(bought, founder.user.id).available,
    );
    assert.equal(
      Number(
        (
          await observer`select count(*) n from beta_packs.issued where pack=${request}`
        )[0].n,
      ),
      9,
    );
    checks.push(
      "24 concurrent opening retries reveal the original nine cards after source withdrawal; no new issuance/debit; original earned entitlement preserved",
    );
    const [fullBefore] =
      await observer`select md5(string_agg(user_id::text||sport||cards::text,',' order by user_id,sport)) hash from sports_feed.sport_sandbox_inventory`;
    const rollback = Error("expected test rollback");
    await observer
      .begin(async (tx) => {
        await tx.unsafe(oldProject.body);
        await tx`select set_config('request.jwt.claim.sub',${founder.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: founder.user.id, aal: "aal2", session_id: founder.sessionId })},true)`;
        await tx`update credits_sandbox.state set document=document where id`;
        const [fullAfter] =
          await tx`select md5(string_agg(user_id::text||sport||cards::text,',' order by user_id,sport)) hash from sports_feed.sport_sandbox_inventory`;
        assert.deepEqual(fullAfter, fullBefore);
        throw rollback;
      })
      .catch((e) => {
        if (e !== rollback) throw e;
      });
    checks.push(
      "Affected-member projection matches the original full inventory repair exactly",
    );
    await assert.rejects(
      () =>
        observer`update beta_packs.issued set serial=serial+1 where pack=${request}`,
      /immutable/i,
    );
    await assert.rejects(
      () => observer`delete from beta_packs.issued where pack=${request}`,
      /immutable/i,
    );
    await assert.rejects(
      () =>
        observer`update commercial_billing.definitions set issued=issued+1 where id=(select definition from beta_packs.issued where pack=${request} limit 1)`,
      /Lifetime counter|supply/i,
    );
    await assert.rejects(
      () =>
        observer`insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards) values(${founder.user.id}::uuid,'afl',${observer.json([{ id: randomUUID(), player_id: "unrecorded-player", rarity: "RARE" }])})`,
      /unrecorded inventory denied/i,
    );
    checks.push(
      "Immutable serials/deletions, unbacked lifetime-counter advances and unrecorded parallel limited inventory rejected",
    );
    // Use AFL, whose retained-use rights are unchanged, for a mid-fulfilment fault.
    await observer`update beta_private.rate_limits set reset_at=now()-interval '1 second' where key=${`test-wallet:${founder.user.id}`}`;
    const afl = Object.values(
      opened.economy.products as Record<string, any>,
    ).find(
      (p) =>
        p.sport === "afl" &&
        p.type === "STANDARD" &&
        p.cards === 9 &&
        p.cataloguePolicy === "founder-credit-season-v1",
    )!;
    saved = await stateDigest();
    const priorCount = Number(
      (await observer`select count(*) n from beta_packs.issued`)[0].n,
    );
    await observer.unsafe(
      `create function public.batch1_injected_failure() returns trigger language plpgsql as $$begin if (select count(*) from beta_packs.issued where pack=new.pack)=2 then raise exception 'Isolated third-card persistence failure';end if;return new;end$$;create trigger batch1_injected_failure before insert on beta_packs.issued for each row execute function public.batch1_injected_failure();`,
    );
    const failed = await send({
      request: randomUUID(),
      command: {
        ...buy.command,
        product: afl.id,
        configuration: afl.version,
        expectedPrice: afl.priceCredits,
      },
    });
    assert.equal(failed.status, 400);
    assert.match(failed.body.error, /Isolated third-card persistence failure/);
    assert.equal(await stateDigest(), saved);
    assert.equal(
      Number((await observer`select count(*) n from beta_packs.issued`)[0].n),
      priorCount,
    );
    await observer.unsafe(
      "drop trigger batch1_injected_failure on beta_packs.issued;drop function public.batch1_injected_failure();",
    );
    checks.push(
      "Injected third-card persistence failure rolls back the debit, entitlement, prior allocations and supply counters together",
    );
    completed = true;
    writeFileSync(
      `${dir}/postgres-acceptance.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          scope:
            "Disconnected restored PostgreSQL clone; actual restricted role/API handlers; simulated authenticated sessions",
          productionWrites: 0,
          checks,
          migrations: migrations.map((file) => ({
            file,
            sha256: createHash("sha256")
              .update(readFileSync(`supabase/migrations/${file}`))
              .digest("hex"),
          })),
          purchaseDuplicateRequests: raced.length,
          openingDuplicateRequests: openings.length,
          duplicateDurationsMs: raced.map((r) => r.durationMs),
          restartRecoveryMs: recovered.durationMs,
          originalCustodyDigest: digest(custody),
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await runtime.end({ timeout: 5 });
    await observer.end({ timeout: 5 });
    // Only a clone created by this invocation is removed; never the base restore.
    if (completed) psql("drop database batch1;");
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
