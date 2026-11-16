/** Catalog-only approval evidence on the disconnected restored database. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { batch1Database } from "./lib/batch1-isolated-db";
const sha = (x: unknown) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
async function main() {
  const sql = batch1Database("postgres");
  const rollback = Error("rollback");
  let report: unknown;
  try {
    await sql
      .begin(async (tx) => {
        const capture = async () => {
          const functions =
            await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,
    encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\r',''),'UTF8')),'hex') hash,
    p.proowner,p.proacl,p.prosecdef,p.proconfig,p.provolatile,p.proleakproof,p.proparallel
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind in('f','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1`;
          const tables =
            await tx`select n.nspname,c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1,2`;
          const policies =
            await tx`select * from pg_policies order by schemaname,tablename,policyname`;
          return { functions, tables, policies };
        };
        const before = await capture();
        const migrations = [];
        for (const file of [
          "20261115113306_batch_private_pack_issuance_validation.sql",
          "20261115211545_batch1_pack_guard_batching.sql",
          "20261115235000_batch1_persistence_subdocuments.sql",
        ]) {
          const bytes = readFileSync(`supabase/migrations/${file}`),
            started = performance.now();
          await tx.unsafe(bytes.toString());
          migrations.push({
            file,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            executionMs: Math.round(performance.now() - started),
          });
        }
        const after = await capture();
        assert.deepEqual(after.tables, before.tables);
        assert.deepEqual(after.policies, before.policies);
        assert.deepEqual(
          after.functions.map(({ hash: _hash, ...rest }) => rest),
          before.functions.map(({ hash: _hash, ...rest }) => rest),
        );
        const changed = after.functions.flatMap((f, index) =>
          f.hash === before.functions[index].hash
            ? []
            : [
                {
                  signature: f.signature,
                  beforeSha256: before.functions[index].hash,
                  afterSha256: f.hash,
                },
              ],
        );
        assert.deepEqual(
          changed.map((f) => f.signature).sort(),
          [
            "commercial_billing.prevent_parallel_inventory()",
            "credits_sandbox.guard_economy_state()",
            "credits_sandbox.project_fixture_inventory()",
            "sports_feed.rarity_transfer_guard()",
            "beta_packs.capture(before_document jsonb, after_document jsonb)",
            "credits_sandbox.marketplace_guard()",
            "credits_sandbox.guard_redemption()",
          ].sort(),
        );
        report = {
          at: new Date().toISOString(),
          scope: "Isolated restored PostgreSQL; transaction rolled back",
          productionWrites: 0,
          migrations,
          changedFunctions: changed,
          otherFunctionBodiesUnchanged: true,
          functionSecurityMetadataUnchanged: true,
          tablePrivilegesAndRlsUnchanged: true,
          policiesUnchanged: true,
          functionCount: after.functions.length,
          tableSecurityDigest: sha(after.tables),
          policyDigest: sha(after.policies),
        };
        throw rollback;
      })
      .catch((e) => {
        if (e !== rollback) throw e;
      });
    writeFileSync(
      "docs/qa/batch1-pack-phone-20261116/database-schema.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
