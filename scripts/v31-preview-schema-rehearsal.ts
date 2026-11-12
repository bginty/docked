/** Exact existing Preview, transactional DDL rehearsal that always rolls back.
 * Never enables Auth/providers, sends messages, or commits schema/data changes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import { checksumQuery } from "./lib/reviewed-inventory";
const files = [
  "20261109232000_public_practice_phone_guards.sql",
  "20261110010050_australian_verified_phone_uniqueness.sql",
  "20261113002000_preserved_commercial_collection_read.sql",
  "20261113003000_commercial_market_request_guards.sql",
];
let stage = "target check";
async function main() {
  assert.deepEqual(process.argv.slice(2), ["--rehearse-preview"]);
  const c = JSON.parse(
    readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
  assert.equal(new URL(c.databaseUrl).username, "postgres." + c.projectRef);
  const sql = postgres(c.databaseUrl, {
    ...databaseConnectionOptions(c.databaseUrl, {
      DATABASE_SSL_CA_FILE: path.resolve("certs/supabase-prod-ca-2021.crt"),
    }),
    max: 1,
    onnotice: () => {},
  });
  const rollback = new Error("Intentional rehearsal rollback");
  try {
    const before = (await sql.unsafe(v31SchemaFingerprintSql))[0];
    const checked: string[] = [];
    try {
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='45s'`;
        const [control] =
          await tx`select * from commercial_billing.control where id for update`;
        assert.equal(control.environment, "acceptance");
        assert(
          !control.sales_enabled &&
            !control.issuance_enabled &&
            !control.transfers_enabled &&
            !control.gameplay_enabled,
        );
        const tables = [
          "auth.users",
          "public.profiles",
          "private.consent_events",
          "credits_sandbox.state",
          ...(
            await tx`select schemaname||'.'||tablename name from pg_tables where schemaname='commercial_billing' order by tablename`
          ).map((r) => r.name),
        ];
        const hashes: Record<string, unknown> = {};
        for (const t of tables)
          hashes[t] = (await tx.unsafe(checksumQuery(t)))[0].value;
        for (const f of files) {
          stage = f;
          await tx.unsafe(readFileSync("supabase/migrations/" + f, "utf8"));
          checked.push(f);
        }
        for (const t of tables)
          assert.deepEqual(
            (await tx.unsafe(checksumQuery(t)))[0].value,
            hashes[t],
          );
        stage = "verified rollback";
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const after = (await sql.unsafe(v31SchemaFingerprintSql))[0];
    assert.deepEqual(after, before);
    const report = {
      at: new Date().toISOString(),
      projectRef: c.projectRef,
      mode: "rollback-only-rehearsal",
      files: checked.map((file) => ({
        file,
        sha256: createHash("sha256")
          .update(readFileSync("supabase/migrations/" + file))
          .digest("hex"),
      })),
      before,
      after,
      protectedAuthOwnershipFinancialRowsUnchanged: true,
      committedSchemaChanges: 0,
      committedDataChanges: 0,
      productionConnections: 0,
      smsSent: 0,
      providerEnabled: false,
    };
    writeFileSync(
      "docs/qa/v31-revenue-launch-20261113/preview-schema-rehearsal.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e: { code?: string }) => {
  console.error(
    JSON.stringify({
      stage,
      code: /^[A-Z0-9_]{3,32}$/.test(e.code ?? "") ? e.code : "redacted",
      committedChanges: 0,
    }),
  );
  process.exitCode = 1;
});
