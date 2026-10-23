/** Exact-target release operations; no member impersonation or test purchases. */
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  prepareSportTestProducts,
  validateCardEconomy,
  type NinePackProduct,
} from "../src/core/card-economy";
import {
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";
const root = process.cwd(),
  mode = process.argv[2];
assert(
  ["inspect", "rehearse", "migrate", "configure", "verify"].includes(mode),
);
const evidence = root + "/docs/qa/three-sport-parity/release";
await fs.mkdir(evidence, { recursive: true });
const migration = "20261023092404_sport_social_and_pack_entitlements.sql";
const body = await fs.readFile(
  root + "/supabase/migrations/" + migration,
  "utf8",
);
const hash = (v: unknown) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : JSON.stringify(v))
    .digest("hex");
const planHash = hash(body);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const privateDir = "private-data/three-sport-release";
await fs.mkdir(privateDir, { recursive: true });
const sql = ownerDatabase();
const protectedTables = [
  "beta_fantasy.cards",
  "beta_fantasy.editions",
  "beta_fantasy.players",
  "beta_fantasy.entries",
  "beta_fantasy.results",
  "beta_fantasy.ownership_events",
  "beta_fantasy.sales",
  "beta_fantasy.packs",
  "beta_fantasy.pack_items",
  "beta_fantasy.ledger",
  "credits_sandbox.permanent_players",
  "credits_sandbox.card_definitions",
  "credits_sandbox.card_instances",
  "credits_sandbox.pack_receipts",
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_control",
  "sports_feed.sport_rounds",
];
const authority =
  "Owner deploy approval in this chat: reviewed three-sport parity release, eight additional AFL/NRL test-credit pack variants and independent free four-Core weekly programmes. No permanent issuance, commercial funds, prizes or new competitions.";
async function fingerprints(tx: TransactionSql) {
  const result: Record<string, unknown> = {};
  for (const table of protectedTables)
    result[table] = (
      await tx.unsafe(
        `select count(*) n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
      )
    )[0];
  return result;
}
async function weeklyBaseline(tx: TransactionSql) {
  return {
    schedules: await tx.unsafe(
      "select to_jsonb(s)-'sport' row from sports_feed.weekly_core_schedules s where policy='weekly-core-nfl-v1' order by user_id",
    ),
    packs: await tx.unsafe(
      "select to_jsonb(p) row from sports_feed.weekly_core_packs p where sport='nfl' order by id",
    ),
  };
}
try {
  if (mode === "inspect") {
    const snapshot = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const tables: Record<string, unknown> = {};
        const extra =
          await tx`select schemaname||'.'||tablename name from pg_tables where (schemaname in ('private','beta_private') and (tablename like 'social_%' or tablename like 'community_%' or tablename like '%announcement%')) or (schemaname='sports_feed' and tablename like 'weekly_%')`;
        for (const table of [
          ...new Set([
            ...protectedTables,
            ...extra.map((r) => r.name),
            "credits_sandbox.state",
            "credits_sandbox.pack_configuration",
            "sports_feed.private_beta_sports",
            "sports_feed.nba_beta_control",
            "sports_feed.sport_sandbox_inventory",
            "supabase_migrations.schema_migrations",
          ]),
        ]) {
          assert(/^[a-z_]+\.[a-z_]+$/.test(table));
          tables[table] = await tx.unsafe(
            `select to_jsonb(t) row from ${table} t`,
          );
        }
        const functions =
          await tx`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','beta_private','beta_fantasy','sports_feed','credits_sandbox') and p.prokind='f'`;
        const constraints =
          await tx`select conrelid::regclass::text table_name,conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid in ('sports_feed.weekly_core_schedules'::regclass,'sports_feed.weekly_core_packs'::regclass,'sports_feed.weekly_core_job_failures'::regclass)`;
        return {
          at: new Date().toISOString(),
          projectRef,
          tables,
          functions,
          constraints,
          protected: await fingerprints(tx),
          weekly: await weeklyBaseline(tx),
        };
      },
    );
    const bytes = JSON.stringify(snapshot),
      file = privateDir + `/recovery-${Date.now()}.private.json`;
    await fs.writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    assert.equal(await fs.readFile(file, "utf8"), bytes);
    await fs.writeFile(
      privateDir + "/latest.json",
      JSON.stringify({ file, sha256: hash(bytes) }),
      { mode: 0o600 },
    );
    const receipt = {
      projectRef,
      planHash,
      at: snapshot.at,
      bytes: Buffer.byteLength(bytes),
      sha256: hash(bytes),
      tables: Object.keys(snapshot.tables),
      readbackVerified: true,
      fullDisasterRecoveryTested: false,
      scope:
        "Application data and prior function/constraint definitions; no Auth secrets or Storage objects",
      protected: snapshot.protected,
    };
    await fs.writeFile(
      evidence + "/recovery.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log({
      mode,
      passed: true,
      bytes: receipt.bytes,
      tables: receipt.tables.length,
    });
  } else if (mode === "rehearse" || mode === "migrate") {
    const backup = JSON.parse(
      await fs.readFile(evidence + "/recovery.json", "utf8"),
    );
    assert.equal(backup.planHash, planHash);
    if (mode === "migrate")
      assert(
        JSON.parse(await fs.readFile(evidence + "/rehearse.json", "utf8"))
          .passed,
      );
    let receipt: unknown;
    try {
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='8s'`;
        await tx`set local statement_timeout='120s'`;
        await tx`select pg_advisory_xact_lock(71820342)`;
        const before = await fingerprints(tx),
          weekly = await weeklyBaseline(tx);
        const [credits] =
          await tx`select document from credits_sandbox.state where id`;
        assert.equal(
          (
            await tx`select version from supabase_migrations.schema_migrations where version='20261023092404'`
          ).length,
          0,
          "Migration already applied; inspect instead of replay",
        );
        await tx.unsafe(body);
        assert.deepEqual(
          await fingerprints(tx),
          before,
          "Protected records changed",
        );
        assert.deepEqual(
          await weeklyBaseline(tx),
          weekly,
          "NFL entitlements changed",
        );
        assert.deepEqual(
          (await tx`select document from credits_sandbox.state where id`)[0]
            .document,
          credits.document,
          "Credits changed",
        );
        assert.equal(
          (
            await tx`select count(*)::int n from sports_feed.weekly_sport_programmes where enabled`
          )[0].n,
          0,
        );
        const social =
          await tx`select 'private' namespace,count(*)::int review from private.social_sport_review union all select 'beta_private',count(*)::int from beta_private.social_sport_review`;
        const acl =
          await tx`select has_function_privilege('docked_beta_app','sports_feed.my_weekly_core(text)','execute') app_weekly,has_function_privilege('anon','sports_feed.my_weekly_core(text)','execute') anon_weekly,has_function_privilege('docked_nfl_worker','sports_feed.weekly_core_job()','execute') worker,has_function_privilege('docked_beta_app','sports_feed.sport_sandbox_state_before_parity(text)','execute') bypass`;
        assert(
          acl[0].app_weekly &&
            acl[0].worker &&
            !acl[0].anon_weekly &&
            !acl[0].bypass,
        );
        if (mode === "migrate")
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values('20261023092404','sport_social_and_pack_entitlements',${[body]})`;
        receipt = {
          mode,
          passed: true,
          planHash,
          projectRef,
          at: new Date().toISOString(),
          protectedRecordsUnchanged: true,
          nflEntitlementsUnchanged: true,
          creditsUnchanged: true,
          programmesEnabled: false,
          social,
          acl,
        };
        if (mode === "rehearse") throw Error("ROLLBACK_REHEARSAL");
      });
    } catch (e) {
      if (!(
        mode === "rehearse" &&
        e instanceof Error &&
        e.message === "ROLLBACK_REHEARSAL"
      ))
        throw e;
    }
    if (mode === "rehearse")
      assert.equal(
        (
          await sql`select version from supabase_migrations.schema_migrations where version='20261023092404'`
        ).length,
        0,
      );
    await fs.writeFile(
      evidence + `/${mode}.json`,
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  } else if (mode === "configure") {
    assert(
      JSON.parse(await fs.readFile(evidence + "/migrate.json", "utf8")).passed,
    );
    const promoted = JSON.parse(
      await fs.readFile(evidence + "/deployment-promoted.json", "utf8"),
    );
    const live = await fetch("https://docked.com.au/api/beta-release", {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    assert(
      live.ok && (await live.json()).commit === promoted.commit,
      "Compatible application must be live",
    );
    const receipt = await sql.begin(async (tx) => {
      await tx`set local lock_timeout='8s'`;
      await tx`set local statement_timeout='120s'`;
      await tx`select pg_advisory_xact_lock(71022026)`;
      await tx`select pg_advisory_xact_lock(71820342)`;
      const before = await fingerprints(tx),
        weekly = await weeklyBaseline(tx);
      const [row] =
        await tx`select document from credits_sandbox.state where id for update`;
      const original = row.document as CreditsState;
      validateCredits(original);
      assert(original.economy?.enabled);
      const next = structuredClone(original),
        e = next.economy!,
        added: string[] = [];
      for (const sport of ["afl", "nrl"] as const) {
        const staging = structuredClone(e);
        for (const base of prepareSportTestProducts(
          staging,
          sport,
          Date.now(),
        )) {
          const id = base.id.replace("isolated-v1", "real-roster-beta-v1");
          const product: NinePackProduct = {
            ...base,
            id,
            version: id,
            name: base.name.replace("· Test", "· Real-player beta"),
            inventoryScope: "real-roster-beta-v1",
          };
          const nfl = Object.values(e.products).find(
            (p) =>
              p.sport === "nfl" &&
              p.type === base.type &&
              p.cards === base.cards &&
              e.activeProductVersions?.includes(p.id),
          );
          assert(nfl);
          assert.equal(product.priceCredits, nfl.priceCredits);
          assert.deepEqual(product.weights, nfl.weights);
          assert.equal(product.exhaustion, nfl.exhaustion);
          if (e.products[id]) {
            assert.deepEqual(
              { ...e.products[id], effectiveAt: product.effectiveAt },
              product,
            );
          } else {
            e.products[id] = product;
            added.push(id);
            await tx`insert into credits_sandbox.pack_configuration(version,document)values(${id},${tx.json(product)})`;
          }
          e.activeProductVersions ??= [];
          if (!e.activeProductVersions.includes(id))
            e.activeProductVersions.push(id);
        }
      }
      const strip = (s: CreditsState) => {
        const c = structuredClone(s);
        const { products, activeProductVersions, ...economy } = c.economy!;
        void products;
        void activeProductVersions;
        return { ...c, economy };
      };
      assert.deepEqual(strip(next), strip(original));
      for (const [id, p] of Object.entries(original.economy!.products))
        assert.deepEqual(e.products[id], p);
      validateCardEconomy(e);
      validateCredits(next);
      await tx`update credits_sandbox.state set document=${tx.json(next)},revision=revision+1 where id`;
      const activated =
        await tx`update sports_feed.weekly_sport_programmes set enabled=true,enabled_at=coalesce(enabled_at,clock_timestamp()),authority_note=${authority} where sport in ('afl','nrl') and not enabled returning sport`;
      assert.deepEqual(await fingerprints(tx), before);
      assert.deepEqual(await weeklyBaseline(tx), weekly);
      const details = {
        authority,
        planHash,
        addedProducts: added,
        activatedProgrammes: activated.map((r) => r.sport),
        creditChanges: 0,
        permanentIssuance: 0,
        existingAssetsUnchanged: true,
      };
      await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-private-beta','three_sport_pack_configuration','afl,nrl',${tx.json(details)})`;
      return { passed: true, at: new Date().toISOString(), ...details };
    });
    await fs.writeFile(
      evidence + "/configuration.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  } else {
    const receipt = {
      projectRef,
      at: new Date().toISOString(),
      programmes:
        await sql`select sport,enabled,enabled_at from sports_feed.weekly_sport_programmes order by sport`,
      packs:
        await sql`select sport,count(*)::int issued,count(opened_at)::int opened from sports_feed.weekly_core_packs group by sport order by sport`,
      jobs: await sql`select j.jobname,j.active,j.schedule,d.status,d.start_time,d.end_time from cron.job j left join lateral(select status,start_time,end_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1)d on true where j.jobname='docked-weekly-core-entitlements'`,
      failures:
        await sql`select sport,sqlstate,count(*)::int n from sports_feed.weekly_core_job_failures where run_id in(select id from sports_feed.weekly_core_job_runs where started_at>clock_timestamp()-interval '1 hour')group by sport,sqlstate`,
      products:
        await sql`select p.value->>'sport' sport,count(*)::int n from credits_sandbox.state s,jsonb_each(s.document->'economy'->'products')p where s.id and s.document->'economy'->'activeProductVersions' ? p.key group by 1 order by 1`,
      authenticatedHosted: false,
    };
    await fs.writeFile(
      evidence + "/verify.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  }
} catch (e) {
  await fs.writeFile(privateDir + `/${mode}-error.private.txt`, String(e), {
    mode: 0o600,
  });
  console.error({
    failed: true,
    mode,
    code: (e as { code?: string }).code ?? "FAILED",
    message:
      e instanceof Error
        ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
        : "Failed",
  });
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
