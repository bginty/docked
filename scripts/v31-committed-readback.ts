/** Read-only post-commit custody, migration and dormant-gate evidence. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  custodyQuery,
  checksumQuery,
  validateReviewedInventory,
} from "./lib/reviewed-inventory";
import { digest } from "../src/core/scoring-engine";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";

async function main() {
  const root = process.cwd(),
    output =
      process.env.DOCKED_V31_READBACK_DIRECTORY ??
      "docs/qa/v31-overnight-20261112";
  assert(
    [
      "docs/qa/v31-overnight-20261112",
      "docs/qa/v31-prelaunch-execution-20261111/backend",
    ].includes(output),
  );
  const manifest = JSON.parse(
    readFileSync(
      "docs/qa/v31-prelaunch-execution-20261111/database/exact-package.json",
      "utf8",
    ),
  );
  const plan = JSON.parse(
    readFileSync(
      "private-data/v31-card-research-20261111/complete-proposal.private.json",
      "utf8",
    ),
  );
  validateReviewedInventory(plan);
  const key = Buffer.from(
    readFileSync(
      process.env.USERPROFILE +
        "/.docked-secrets/launch-migration-backup-key.hex",
      "utf8",
    ).trim(),
    "hex",
  );
  const encrypted = readFileSync(
    "private-data/commercial-restore-20261111/manifest.aes",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    encrypted.subarray(0, 12),
  );
  decipher.setAuthTag(encrypted.subarray(12, 28));
  const backup = JSON.parse(
    Buffer.concat([
      decipher.update(encrypted.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
  key.fill(0);
  assert.equal(backup.project, "pojoymtniryarxxunyvz");
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='60s'`;
        const migrationHashes = [];
        for (const file of manifest.files.filter(
          (f: any) => f.kind === "migration",
        )) {
          const [r] =
            await tx`select statements from supabase_migrations.schema_migrations where version=${file.version}`;
          assert(r && r.statements.length === 1);
          const hash = createHash("sha256")
            .update(r.statements[0])
            .digest("hex");
          assert.equal(hash, file.sha256);
          migrationHashes.push({ file: file.path, sha256: hash });
        }
        const [{ value: custody }] = await tx.unsafe(custodyQuery);
        assert.equal(digest(custody), plan.protectedCustodyDigest);
        const protectedTables = Object.keys(backup.sums).filter(
          (t) =>
            t.startsWith('"commercial_billing".') ||
            [
              '"credits_sandbox"."state"',
              '"credits_sandbox"."card_instances"',
              '"credits_sandbox"."nba_fixture_instances"',
              '"credits_sandbox"."nba_fixture_definitions"',
              '"credits_sandbox"."pack_receipts"',
              '"beta_fantasy"."cards"',
              '"beta_fantasy"."ownership_events"',
              '"cron"."job"',
            ].includes(t),
        );
        for (const table of protectedTables) {
          const [{ value: r }] = await tx.unsafe(checksumQuery(table));
          assert.deepEqual(
            { count: r.count, hash: r.hash },
            backup.sums[table],
            table,
          );
        }
        const [flags] = await tx`select
   (select enabled from private.feature_flags where key='registration') registration,
   (select enabled from private.feature_flags where key='billing_ops_alerts') alerts,
   (select enabled from operations.retention_policy) retention,
   (select routine_days from operations.retention_policy) retention_days,
   (select count(*)::int from operations.incidents i where operations.routine_expired(i.code)) retention_candidates,
   (select count(*)::int from operations.retention_receipts) deletion_receipts,
   (select count(*)::int from public_gameplay.rounds) practice_rounds,
   exists(select 1 from public_gameplay.rounds where enabled or fixture_kind<>'practice') active_or_scored_rounds,
   exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) commercial,
   (select count(*)::int from commercial_billing.definitions) commercial_definitions,
   (select count(*)::int from commercial_billing.cards) commercial_cards,
   (select count(*)::int from operations.incidents) incidents,
   (select count(*)::int from operations.events) incident_events,
   (select count(*)::int from private.outbox where payload->>'purpose'='billing_ops_health_v1') operational_emails,
   (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='operations'and c.relkind='r'and not c.relrowsecurity) operational_tables_without_rls`;
        for (const field of [
          "registration",
          "alerts",
          "retention",
          "active_or_scored_rounds",
          "commercial",
        ])
          assert.equal(flags[field], false, field);
        assert.equal(flags.retention_days, 90);
        assert.equal(flags.practice_rounds, 6);
        for (const field of [
          "retention_candidates",
          "deletion_receipts",
          "commercial_definitions",
          "commercial_cards",
          "operational_emails",
          "operational_tables_without_rls",
        ])
          assert.equal(flags[field], 0, field);
        const catalogue = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        const membership = (
          await tx`select md5(coalesce(jsonb_agg(jsonb_build_array(r.rolname,m.rolname,g.rolname,a.admin_option,a.inherit_option,a.set_option) order by r.rolname,m.rolname,g.rolname)::text,'[]')) fingerprint,count(*)::int memberships from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor`
        )[0];
        if (
          manifest.version === "v31-20261112-application-only-continuation" &&
          manifest.databaseStatus?.readbackBound
        ) {
          assert.deepEqual(
            { ...catalogue },
            manifest.sourceCatalogue,
            "Post-migration catalogue drift requires review",
          );
          assert.deepEqual(
            { ...membership },
            manifest.sourceMemberships,
            "Post-migration permissions drift requires review",
          );
        }
        const notifications =
          await tx`select kind,state,count(*)::int count,min(created_at) first_created,max(created_at) last_created,max(completed_at) last_completed,max(attempts)::int max_attempts,case when last_error ~ '^[a-zA-Z0-9_: -]{1,100}$' then last_error else 'private diagnostic withheld' end error_category from credits_sandbox.store_notifications where state='attention' group by kind,state,last_error order by kind,error_category`;
        return {
          at: new Date().toISOString(),
          project: backup.project,
          productionWrites: 0,
          migrationHashes,
          protectedTablesCompared: protectedTables.length,
          protectedRecordsUnchanged: true,
          protectedCustodyDigest: plan.protectedCustodyDigest,
          custodyRecords: custody.length,
          frozenLimitedCopies: 888,
          flags,
          catalogue,
          membership,
          legacyTestNotificationAttention: notifications,
          founderMfaAcceptance: false,
        };
      },
    );
    mkdirSync(output, { recursive: true });
    writeFileSync(
      output + "/committed-readback.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Read-only postflight failed",
  );
  process.exitCode = 1;
});
