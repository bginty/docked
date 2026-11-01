/** Exact migrations authorised by owner on 1 November 2026. No activation. */
import assert from "node:assert/strict";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  mode = process.argv[2];
const queueOnly = process.argv.includes("--queue-approved-20261101");
const rosterOnly = process.argv.includes("--roster-adapter-approved-20261101");
assert(!(queueOnly && rosterOnly), "Select one approved migration scope");
assert(["--inspect", "--apply"].includes(mode));
if (mode === "--apply")
  assert(
    rosterOnly ||
      queueOnly ||
      process.argv.includes("--owner-approved-20261101"),
  );
const files = rosterOnly
  ? ["20261101090955_free_core_verified_roster_adapter.sql"]
  : queueOnly
    ? ["20261031234304_google_test_reconciliation_queue.sql"]
    : [
        "20261031123611_free_core_gameplay_eligibility.sql",
        "20261031123931_member_google_test_receipts.sql",
      ];
const out = resolve(
  rosterOnly
    ? "docs/qa/final-play-acceptance-20261101/roster-adapter"
    : "docs/qa/customer-billing-20261101",
);
const vault = resolve("private-data/launch-migration-backups");
mkdirSync(out, { recursive: true });
mkdirSync(vault, { recursive: true });
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const keyPath = join(
  process.env.USERPROFILE!,
  ".docked-secrets",
  "launch-migration-backup-key.hex",
);
if (!existsSync(keyPath))
  writeFileSync(keyPath, randomBytes(32).toString("hex"), {
    flag: "wx",
    mode: 0o600,
  });
const key = Buffer.from(readFileSync(keyPath, "utf8"), "hex");
assert.equal(key.length, 32);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
const protectedTables = [
  "credits_sandbox.state",
  "credits_sandbox.journal",
  "credits_sandbox.lines",
  "credits_sandbox.history",
  "credits_sandbox.card_instances",
  "credits_sandbox.card_definitions",
  "beta_fantasy.cards",
  "beta_fantasy.entries",
  "beta_fantasy.entry_revisions",
  "beta_fantasy.slot_locks",
  "beta_fantasy.competitions",
  "beta_fantasy.players",
  ...(rosterOnly
    ? [
        "sports_feed.free_core_programmes",
        "sports_feed.free_core_roster",
        "credits_sandbox.nba_fixture_players",
      ]
    : []),
];
async function main() {
  try {
    console.log("Checking connection and migration prerequisites");
    await sql`select 1`;
    const result = await sql.begin(
      "isolation level repeatable read",
      async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='90s'`;
        await tx`select pg_advisory_xact_lock(71820342)`;
        const snapshot: Record<string, unknown> = {};
        const fingerprints: Record<string, unknown> = {};
        for (const table of protectedTables) {
          console.log(`Backing up ${table}`);
          const [fingerprint] = await tx.unsafe(
            `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          );
          fingerprints[table] = fingerprint;
          // The append-only history is 313 MB of JSON and is untouched by this DDL.
          // Fingerprint it in PostgreSQL; don't transfer it as one oversized row.
          if (table !== "credits_sandbox.history") {
            const [row] = await tx.unsafe(
              `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from ${table} t`,
            );
            snapshot[table] = row.value;
          }
        }
        const functions =
          await tx`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
        pg_get_functiondef(p.oid) definition,p.proacl::text grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where (n.nspname='sports_feed' and p.proname in ('lineup_inventory','sport_sandbox_state'))
        or (n.nspname='beta_fantasy' and p.proname='production_read_state')
        or (${rosterOnly} and n.nspname='sports_feed' and p.proname='free_core_inventory') order by 1,2`;
        assert.equal(functions.length, rosterOnly ? 4 : 3);
        const plain = JSON.stringify({
          projectRef,
          at: new Date().toISOString(),
          snapshot,
          fingerprints,
          functions,
        });
        const digest = hash(plain),
          iv = randomBytes(12),
          cipher = createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        const backup = join(vault, `${digest}.enc`);
        writeFileSync(
          backup,
          Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
          { flag: "wx", mode: 0o600 },
        );
        const saved = readFileSync(backup),
          decipher = createDecipheriv(
            "aes-256-gcm",
            key,
            saved.subarray(0, 12),
          );
        decipher.setAuthTag(saved.subarray(12, 28));
        assert.equal(
          hash(
            Buffer.concat([
              decipher.update(saved.subarray(28)),
              decipher.final(),
            ]).toString(),
          ),
          digest,
        );
        const migrations = [];
        if (queueOnly || rosterOnly) {
          const prerequisites =
            await tx`select version from supabase_migrations.schema_migrations
            where version in ('20261031123611','20261031123931')`;
          assert.equal(
            prerequisites.length,
            2,
            "Approved predecessor migrations required",
          );
        }
        for (const file of files) {
          const source = readFileSync(
            resolve(root, "supabase/migrations", file),
            "utf8",
          ).replaceAll("\r\n", "\n");
          const version = file.slice(0, 14);
          const [prior] =
            await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
          if (prior)
            assert.equal(
              prior.statements.join("\n").replaceAll("\r\n", "\n"),
              source,
              "Migration drift requires review",
            );
          if (!prior && mode === "--apply") {
            await tx.unsafe(source);
            await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${file.slice(15, -4)},${[source]})`;
          }
          migrations.push({
            file,
            sha256: hash(source),
            alreadyApplied: !!prior,
            appliedNow: !prior && mode === "--apply",
          });
        }
        for (const table of protectedTables) {
          const [row] = await tx.unsafe(
            `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          );
          assert.deepEqual(
            row,
            fingerprints[table],
            `Changed protected data: ${table}`,
          );
        }
        if (mode === "--apply") {
          assert.equal(
            (
              await tx`select count(*)::int n from sports_feed.free_core_programmes where enabled`
            )[0].n,
            0,
          );
          if (!rosterOnly)
            assert.equal(
              (
                await tx`select count(*)::int n from credits_sandbox.store_test_admissions`
              )[0].n,
              0,
            );
          for (const role of [
            "anon",
            "authenticated",
            "service_role",
            "docked_app",
          ])
            assert.equal(
              (
                await tx`select has_table_privilege(${role},'credits_sandbox.store_receipts','SELECT') allowed`
              )[0].allowed,
              false,
            );
          if (rosterOnly) {
            const [adapter] =
              await tx`select relrowsecurity enabled from pg_class
              where oid='sports_feed.free_core_roster_beta'::regclass`;
            assert.equal(adapter.enabled, true);
            assert.equal(
              (
                await tx`select count(*)::int n from sports_feed.free_core_roster_beta`
              )[0].n,
              0,
            );
            assert.ok(
              (
                await tx`select to_regprocedure('sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)') preserved`
              )[0].preserved,
            );
            for (const role of [
              "anon",
              "authenticated",
              "service_role",
              "docked_app",
              "docked_beta_app",
            ]) {
              for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"])
                assert.equal(
                  (
                    await tx`select has_table_privilege(${role},'sports_feed.free_core_roster_beta',${privilege}) allowed`
                  )[0].allowed,
                  false,
                );
              for (const signature of [
                "sports_feed.free_core_inventory(uuid,uuid)",
                "sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)",
              ])
                assert.equal(
                  (
                    await tx`select has_function_privilege(${role},${signature},'EXECUTE') allowed`
                  )[0].allowed,
                  false,
                );
            }
            if (migrations.some((migration) => migration.appliedNow)) {
              const [preserved] =
                await tx`select pg_get_functiondef('sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)'::regprocedure) definition`;
              const original = functions.find(
                (fn) => fn.proname === "free_core_inventory",
              )!;
              assert.equal(
                preserved.definition.replace(
                  "free_core_inventory_before_roster_beta(",
                  "free_core_inventory(",
                ),
                original.definition,
              );
            }
          }
          if (queueOnly) {
            const [queue] = await tx`select relrowsecurity enabled from pg_class
              where oid='credits_sandbox.store_notifications'::regclass`;
            assert.equal(queue.enabled, true);
            for (const role of [
              "anon",
              "authenticated",
              "service_role",
              "docked_app",
            ])
              for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"])
                assert.equal(
                  (
                    await tx`select has_table_privilege(${role},
                  'credits_sandbox.store_notifications',${privilege}) allowed`
                  )[0].allowed,
                  false,
                );
            // A new queue must be empty. A later exact-history replay must
            // preserve legitimate deliveries instead of treating them as drift.
            if (migrations.some((migration) => migration.appliedNow))
              assert.equal(
                (
                  await tx`select count(*)::int n from credits_sandbox.store_notifications`
                )[0].n,
                0,
              );
          }
        }
        return {
          at: new Date().toISOString(),
          projectRef,
          applied: mode === "--apply",
          migrations,
          backup: {
            file: backup,
            sha256: digest,
            encrypted: true,
            authenticatedReadback: true,
            tables: Object.keys(snapshot).length,
            fingerprintedTables: protectedTables.length,
            excludedAppendOnlyHistory:
              "credits_sandbox.history (fingerprinted; not changed by migration)",
            functionDefinitions: functions.length,
            fullDisasterRecovery: false,
          },
          protectedDataUnchanged: true,
          activation: "none",
          transaction: "repeatable-read; atomic DDL + history; 5s lock timeout",
        };
      },
    );
    writeFileSync(
      join(
        out,
        queueOnly
          ? mode === "--apply"
            ? "queue-applied.json"
            : "queue-inspected.json"
          : mode === "--apply"
            ? "migrations-applied.json"
            : "migrations-inspected.json",
      ),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 2 });
  }
}
void main().catch((error: unknown) => {
  console.error(
    "Migration not confirmed; inspect history before retry.",
    error instanceof Error ? error.name : "Unknown error",
    typeof error === "object" && error && "code" in error ? error.code : "",
  );
  process.exitCode = 1;
});
