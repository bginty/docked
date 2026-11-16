/** Exact three approved function migrations, or read-only pre/postflight. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  captureInventoryScheduler,
  verifyInventorySchedulerDrift,
  inventorySchedulerTables,
} from "./lib/inventory-scheduler-drift";
import { assertOnlyRoundTelemetryChanged } from "./lib/round-backup-compare";
import { authenticateDatabaseBackup } from "./lib/authenticated-database-backup";
import { validateCredits } from "../src/core/credits-sandbox";
import { digest } from "../src/core/scoring-engine";
import { persistedSnapshot } from "./lib/batch1-production-snapshot.mjs";
import {
  readAuthEvidence,
  verifyFounderReadActivity,
} from "./lib/batch1-founder-auth-evidence";
import {
  authority,
  packet,
  source,
  packageSha,
  addendumSha,
  priv,
  docs,
  root,
  json,
  save,
  sha,
  sourceBlob,
} from "./lib/batch1-production-execution.mjs";
const mode = process.argv[2];
assert(["preflight", "apply", "postflight"].includes(mode));
authority();
const p = packet();
const versions = p.migrations.map((m: any) =>
  m.file.split("/").at(-1).slice(0, 14),
);
const schedulerTables = [
  ...inventorySchedulerTables,
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_worker_runs",
];
const fields =
  v31SchemaFingerprintSql.slice(
    0,
    v31SchemaFingerprintSql.lastIndexOf("\nselect md5"),
  ) + "\nselect kind,identity,definition from entries order by kind,identity";
const checksum = (v: any) => sha(JSON.stringify(v));
const readManifest = () => {
  const key = Buffer.from(
      readFileSync(
        "C:/Users/61412/.docked-secrets/launch-migration-backup-key.hex",
        "utf8",
      ).trim(),
      "hex",
    ),
    b = readFileSync("private-data/commercial-restore-20261116c/manifest.aes"),
    c = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  c.setAuthTag(b.subarray(12, 28));
  const m = JSON.parse(
    Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(),
  );
  key.fill(0);
  return m;
};
async function capture(tx: any) {
  const started = performance.now(),
    names = (await tx.unsafe(tableListQuery))[0].value as string[],
    tables: Record<string, any> = {};
  for (let i = 0; i < names.length; i += 25) {
    const rows = await tx.unsafe(
      names
        .slice(i, i + 25)
        .map(checksumQuery)
        .join(" union all "),
    );
    for (const { value: v } of rows)
      tables[v.table] = { count: v.count, hash: v.hash };
  }
  const objects = await tx.unsafe(fields),
    schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
  const functions =
    await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\r',''),'UTF8')),'hex') hash,pg_get_userbyid(p.proowner) owner,p.proacl,p.prosecdef,p.proconfig,p.provolatile,p.proleakproof,p.proparallel from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1`;
  const roles =
    await tx`select rolname,rolsuper,rolinherit,rolcanlogin,rolreplication,rolbypassrls,rolcreaterole,rolcreatedb,rolconnlimit,rolvaliduntil,rolconfig from pg_roles where rolname!~'^pg_' order by rolname`;
  const memberships =
    await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by 1,2,3`;
  const [counts] =
    await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select sum(issued)::int from commercial_billing.definitions) lifetime,(select count(*)::int from beta_packs.issued) beta_allocations,(select count(*)::int from commercial_billing.cards) commercial_cards,(select count(*)::int from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) open_controls,(select count(*)::int from private.feature_flags where enabled) public_flags,(select count(*)::int from public_gameplay.rounds where enabled or fixture_kind<>'practice') active_or_scored,(select count(*)::int from operations.retention_policy where enabled) deletion_schedules`;
  for (const k of [
    "commercial_cards",
    "open_controls",
    "public_flags",
    "active_or_scored",
    "deletion_schedules",
  ])
    assert.equal(counts[k], 0, k);
  const [integrity] =
    await tx`select (select count(*)::int from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from beta_packs.issued b where b.definition=d.id)+(select count(*) from commercial_billing.cards c where c.definition=d.id)) lifetime_mismatches,(select count(*)::int from (select definition,serial,count(*) from (select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards)a group by 1,2 having count(*)>1)b) duplicate_serials,(select count(*)::int from (select journal,sum(amount) from commercial_billing.lines group by journal having sum(amount)<>0)j) unbalanced_journals`;
  assert(Object.values(integrity).every((v) => v === 0));
  const [wallet] =
    await tx`select document from credits_sandbox.state where id`;
  validateCredits(wallet.document);
  const custody = (await tx.unsafe(custodyQuery))[0].value;
  const scheduler = {
    bookkeeping: await captureInventoryScheduler(tx),
    rounds: (
      await tx`select coalesce(jsonb_agg(to_jsonb(t) order by competition_id),'[]') value from sports_feed.nfl_rounds t`
    )[0].value,
    runs: (
      await tx`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from sports_feed.nfl_worker_runs t`
    )[0].value,
  };
  const migrations =
    await tx`select version,name,statements from supabase_migrations.schema_migrations where version=any(${versions}::text[]) order by version`;
  return persistedSnapshot({
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - started),
    tables,
    objects,
    schema,
    functions,
    roles,
    memberships,
    counts,
    integrity,
    custodyRecords: custody.length,
    custodyDigest: digest(custody),
    walletDigest: checksum(wallet.document),
    scheduler,
    migrations,
  });
}
async function drift(tx: any, a: any, b: any, withLedger = false) {
  assert.deepEqual(Object.keys(b.tables), Object.keys(a.tables));
  const sessionTables = [
    "auth.users",
    "auth.sessions",
    "auth.refresh_tokens",
    "beta_private.rate_limits",
  ];
  let founderSessionActivity: any = null;
  const sessionChanged = sessionTables.some(
    (t) => checksum(a.tables[t]) !== checksum(b.tables[t]),
  );
  if (sessionChanged) {
    assert.equal(
      mode,
      "postflight",
      "Founder activity reconciliation is postflight-only",
    );
    const proof = json(priv + "/founder-auth-backup-proof.private.json");
    assert.equal(
      sha(readFileSync(priv + "/founder-auth-before.private.json")),
      proof.beforeFileSha256,
    );
    for (const [table, expected] of Object.entries(proof.tableHashes))
      assert.deepEqual(a.tables[table], expected, "Auth baseline mismatch");
    const current = await readAuthEvidence(
      async (q) => (await tx.unsafe(q))[0].value,
    );
    const verified = verifyFounderReadActivity(
      json(priv + "/founder-auth-before.private.json"),
      current,
    );
    // This is a complete row comparison, not an exclusion of Auth tables.
    // The before-image is independently matched to the encrypted backup.
    for (const table of sessionTables) {
      const v = (await tx.unsafe(checksumQuery(table)))[0].value;
      assert.deepEqual(b.tables[table], { count: v.count, hash: v.hash });
    }
    save(priv + "/founder-browser-auth-reconciliation.private.json", {
      at: new Date().toISOString(),
      ...verified,
    });
    founderSessionActivity = {
      founderSessionOnly: true,
      unchangedCredentialsMfaAndAuthority: true,
      refreshRotations: verified.refreshRotations,
      collectionRateRows: verified.collectionRateRows,
      baselineVerifiedAgainstEncryptedBackup: true,
    };
  }
  for (const t of Object.keys(b.tables))
    if (
      !schedulerTables.includes(t) &&
      !(sessionChanged && sessionTables.includes(t)) &&
      !(withLedger && t === "supabase_migrations.schema_migrations")
    )
      assert.deepEqual(
        b.tables[t],
        a.tables[t],
        "Unexplained data drift: " + t,
      );
  assert.deepEqual(b.roles, a.roles);
  assert.deepEqual(b.memberships, a.memberships);
  assertOnlyRoundTelemetryChanged(a.scheduler.rounds, b.scheduler.rounds);
  for (const old of a.scheduler.rounds) {
    const now = b.scheduler.rounds.find(
      (r: any) => r.competition_id === old.competition_id,
    );
    for (const k of ["last_checked", "next_check"])
      if (now[k] !== old[k])
        assert(
          Date.parse(now[k]) >= (old[k] ? Date.parse(old[k]) : 0) &&
            Date.parse(now[k]) <= Date.now() + 3600000,
        );
    if (now.lease_until !== null)
      assert(Date.parse(now.lease_until) <= Date.now() + 3600000);
  }
  const ids = new Set(a.scheduler.runs.map((r: any) => r.id));
  for (const r of a.scheduler.runs)
    assert.deepEqual(
      b.scheduler.runs.find((v: any) => v.id === r.id),
      r,
      "Prior NFL audit changed",
    );
  const extra = b.scheduler.runs.filter((r: any) => !ids.has(r.id)),
    max = Math.max(...a.scheduler.runs.map((r: any) => Number(r.id))),
    floor = Math.max(
      ...a.scheduler.runs.map((r: any) => Date.parse(r.started_at)),
    );
  assert(
    extra.every(
      (r: any) =>
        Number(r.id) > max &&
        r.status === "pending-review" &&
        r.detail?.task === "reconcile" &&
        Date.parse(r.started_at) >= floor &&
        Date.parse(r.finished_at) >= Date.parse(r.started_at) &&
        Date.parse(r.finished_at) <= Date.now() + 60000,
    ),
    "Unreviewed NFL worker outcome",
  );
  const bookkeeping = await verifyInventorySchedulerDrift(
    tx,
    a.scheduler.bookkeeping,
    b.scheduler.bookkeeping,
    a.tables,
  );
  return {
    ...bookkeeping,
    founderSessionActivity,
    appendedNflPendingReview: extra.length,
    immutableRoundRows: b.scheduler.rounds.length,
  };
}
const summarize = (r: any) => ({
  at: r.at,
  elapsedMs: r.elapsedMs,
  schema: r.schema,
  counts: r.counts,
  integrity: r.integrity,
  custodyRecords: r.custodyRecords,
  custodyDigest: r.custodyDigest,
  protectedTables: Object.keys(r.tables).length,
  securityDigest: checksum([r.roles, r.memberships]),
  migrations: r.migrations.map((m: any) => ({
    version: m.version,
    sha256: sha(m.statements.join("\n")),
  })),
});
let committed = false;
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    let backup: any;
    if (mode !== "postflight") {
      assert(
        Date.now() - Date.parse("2026-11-16T10:32:00Z") <= 3600000,
        "New backup required: conservative snapshot age exceeds60minutes",
      );
      backup = await authenticateDatabaseBackup({
        manifestPath: "private-data/commercial-restore-20261116c/manifest.aes",
        archivePath:
          "private-data/commercial-restore-20261116c/production.dump.aes",
        keyPath:
          "C:/Users/61412/.docked-secrets/launch-migration-backup-key.hex",
        projectRef: p.databaseProject,
        maxAgeMs: 3600000,
      });
      const restore = json(
        root +
          "/docs/qa/v31-prelaunch-execution-20261111/database/restore-20261116c/restore-only.json",
      );
      assert(
        restore.restored &&
          restore.protectedRecordsUnchanged &&
          restore.network === "none" &&
          restore.publishedPorts === 0,
      );
      assert.equal(restore.archiveSha256, backup.plaintextSha256);
    }
    if (mode === "preflight") {
      const r = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='60s'`;
          const snapshot = await capture(tx);
          if (existsSync(priv + "/database-preflight.private.json")) {
            const previous = json(priv + "/database-preflight.private.json");
            assert.deepEqual(snapshot.schema, previous.schema);
            await drift(tx, previous, snapshot);
          }
          return snapshot;
        },
      );
      const m = readManifest(),
        expected = json(docs + "/production-readonly.json");
      assert.deepEqual(r.schema, expected.schema);
      assert.equal(r.custodyDigest, expected.custodyDigest);
      assert.equal(r.migrations.length, 0);
      for (const f of p.changedFunctions)
        assert.equal(
          r.functions.find((v: any) => v.signature === f.signature)?.hash,
          f.beforeSha256,
          f.signature,
        );
      for (const [t, v] of Object.entries(m.sums))
        if (
          !schedulerTables.includes(t.replaceAll('"', "")) &&
          !['"net"."_http_response"', '"net"."http_request_queue"'].includes(t)
        )
          assert.deepEqual(
            r.tables[t.replaceAll('"', "")],
            v,
            "Drift from fresh backup: " + t,
          );
      save(priv + "/database-preflight.private.json", r);
      save(docs + "/database-preflight.json", {
        ...summarize(r),
        source,
        packageSha,
        addendumSha,
        backup,
        productionWrites: 0,
      });
      console.log(JSON.stringify({ ...summarize(r), preflight: true }));
      return;
    }
    if (mode === "postflight") {
      const prior = json(priv + "/database-applied.private.json");
      const result = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='60s'`;
          const r = await capture(tx);
          assert.deepEqual(r.schema, prior.schema);
          const d = await drift(tx, prior, r);
          return { r, d };
        },
      );
      save(priv + "/database-postflight.private.json", result.r);
      save(docs + "/database-postflight.json", {
        ...summarize(result.r),
        drift: result.d,
        source,
        packageSha,
        productionWrites: 0,
      });
      console.log(JSON.stringify({ ...summarize(result.r), postflight: true }));
      return;
    }
    const pre = json(priv + "/database-preflight.private.json");
    assert(Date.now() - Date.parse(pre.at) < 600000);
    assert(
      !existsSync(docs + "/database-applied.json"),
      "Already applied; never rerun",
    );
    const result = await sql.begin(
      "isolation level serializable",
      async (tx) => {
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='60s'`;
        const before = await capture(tx);
        assert.deepEqual(before.schema, pre.schema);
        const d = await drift(tx, pre, before);
        assert.equal(before.migrations.length, 0);
        await tx`select pg_advisory_xact_lock(71820342)`;
        const mutationStart = performance.now();
        const applied = [];
        for (const m of p.migrations) {
          const b = sourceBlob(m.file),
            start = performance.now();
          await tx.unsafe(b.toString());
          applied.push({
            file: m.file,
            sha256: sha(b),
            milliseconds: Math.round(performance.now() - start),
          });
        }
        const after = await capture(tx);
        assert.deepEqual(
          after.tables,
          before.tables,
          "Data changed inside migration",
        );
        assert.deepEqual(after.roles, before.roles);
        assert.deepEqual(after.memberships, before.memberships);
        assert.deepEqual(
          after.functions.map(({ hash: _hash, ...v }: any) => v),
          before.functions.map(({ hash: _hash, ...v }: any) => v),
        );
        const changed = after.functions.filter(
          (f: any, i: number) => f.hash !== before.functions[i].hash,
        );
        assert.equal(changed.length, 7);
        for (const f of p.changedFunctions)
          assert.equal(
            after.functions.find((v: any) => v.signature === f.signature)?.hash,
            f.afterSha256,
            f.signature,
          );
        const expectedChanges = new Set(
          p.changedFunctions.map((f: any) => "function:" + f.signature),
        );
        assert.equal(after.objects.length, before.objects.length);
        for (let i = 0; i < before.objects.length; i++) {
          const a = before.objects[i],
            b = after.objects[i];
          assert.equal(a.kind, b.kind);
          assert.equal(a.identity, b.identity);
          if (!expectedChanges.has(a.kind + ":" + a.identity))
            assert.deepEqual(b, a, "Unexpected schema-object change");
        }
        for (const m of p.migrations) {
          const filename = m.file.split("/").at(-1);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${filename.slice(0, 14)},${filename.slice(15, -4)},${[sourceBlob(m.file).toString()]})`;
        }
        await tx`set constraints all immediate`;
        assert(
          performance.now() - mutationStart < 115000,
          "Reviewed write-window exceeded; roll back",
        );
        const ledger =
          await tx`select version,name,statements from supabase_migrations.schema_migrations where version=any(${versions}::text[]) order by version`;
        assert.equal(ledger.length, 3);
        for (const m of p.migrations)
          assert.equal(
            sha(
              ledger
                .find(
                  (r: any) =>
                    r.version === m.file.split("/").at(-1).slice(0, 14),
                )!
                .statements.join("\n"),
            ),
            m.sha256,
          );
        after.migrations = ledger;
        after.tables["supabase_migrations.schema_migrations"] = (
          await tx.unsafe(
            checksumQuery("supabase_migrations.schema_migrations"),
          )
        )[0].value;
        delete after.tables["supabase_migrations.schema_migrations"].table;
        return {
          after,
          applied,
          drift: d,
          lockWindowMs: Math.round(performance.now() - mutationStart),
        };
      },
    );
    committed = true;
    save(priv + "/database-applied.private.json", result.after);
    save(docs + "/database-applied.json", {
      ...summarize(result.after),
      source,
      packageSha,
      addendumSha,
      backup,
      applied: result.applied,
      drift: result.drift,
      lockWindowMs: result.lockWindowMs,
      customerWrites: 0,
      functionsChanged: 7,
      protectedTablesUnchanged: 568,
      committed: true,
    });
    console.log(
      JSON.stringify({
        committed: true,
        ...summarize(result.after),
        lockWindowMs: result.lockWindowMs,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  writeFileSync(priv + "/database-error.private.txt", String(e));
  console.error(
    JSON.stringify({
      mode,
      committed,
      stopped: true,
      error: "Private diagnostic retained; no automatic retry",
    }),
  );
  process.exitCode = 1;
});
