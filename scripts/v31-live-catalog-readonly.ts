/** Exact hosted project, read-only transaction. Outputs catalogue hashes/counts,
 * never function bodies, customer rows, phone values or credentials. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
const root = process.cwd();
const output = root + "/docs/qa/v31-prelaunch-execution-20261111/database";
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const value = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='60s'`;
        assert.equal(
          (await tx`show transaction_read_only`)[0].transaction_read_only,
          "on",
        );
        const catalogue = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        const gates = (
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`
        )[0];
        const counts = (
          await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.packs) packs,(select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from public_gameplay.rounds where enabled) enabled_public_rounds`
        )[0];
        const pendingApplied =
          await tx`select version from supabase_migrations.schema_migrations where version in ('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050') order by version`;
        const outbox = (
          await tx`select to_regprocedure('public.docked_billing_ops_queue(text,jsonb)') is not null present`
        )[0];
        const operations = (
          await tx`select to_regnamespace('operations') is not null present`
        )[0];
        const phones = (
          await tx`select count(*)::int confirmed,count(distinct regexp_replace(phone,'^\\+',''))::int canonical_distinct from auth.users where phone_confirmed_at is not null and phone is not null`
        )[0];
        return {
          catalogue,
          gates,
          counts,
          pendingApplied: pendingApplied.map((r) => r.version),
          outboxPresent: outbox.present,
          operationsPresent: operations.present,
          confirmedPhoneCount: phones.confirmed,
          canonicalPhoneDistinct: phones.canonical_distinct,
        };
      },
    );
    const report = {
      at: new Date().toISOString(),
      sourceProject: "pojoymtniryarxxunyvz",
      ...value,
      readOnly: true,
      productionWrites: 0,
    };
    await mkdir(output, { recursive: true });
    await writeFile(
      output + "/live-catalog.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } catch (error) {
    await mkdir(root + "/private-data/v31-prelaunch-execution-20261111", {
      recursive: true,
    });
    await writeFile(
      root +
        "/private-data/v31-prelaunch-execution-20261111/catalogue-error.private.log",
      String(error),
      { mode: 0o600 },
    );
    console.error(
      "Read-only catalogue inspection failed; no private response emitted.",
    );
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main();
