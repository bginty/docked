/** Four approved dependencies in the existing isolated Preview only. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  authority,
  blob,
  hash,
  root,
  privateDir,
  readJson,
  writePrivate,
  writeEvidence,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const p = authority("four-preview-dependencies");
assert.deepEqual(process.argv.slice(2), ["apply"]);
const prior = readJson(
  root + "/docs/qa/v31-revenue-launch-20261113/preview-schema-rehearsal.json",
);
assert.equal(prior.projectRef, p.previewProject);
const files = prior.files.map((f: any) => ({
  file: "supabase/migrations/" + f.file,
  sha256: f.sha256,
}));
for (const f of files) assert.equal(hash(blob(f.file)), f.sha256);
const c = readJson(
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
);
assert.equal(c.projectRef, p.previewProject);
assert.equal(new URL(c.databaseUrl).username, "postgres." + p.previewProject);
async function sums(tx: any) {
  const names = (await tx.unsafe(tableListQuery))[0].value;
  const result: Record<string, unknown> = {};
  for (let n = 0; n < names.length; n += 25)
    for (const r of await tx.unsafe(
      names
        .slice(n, n + 25)
        .map(checksumQuery)
        .join(" union all "),
    ))
      result[r.value.table] = r.value;
  return result;
}
async function main() {
  const sql = postgres(c.databaseUrl, {
    ...databaseConnectionOptions(c.databaseUrl, {
      DATABASE_SSL_CA_FILE: root + "/certs/supabase-prod-ca-2021.crt",
    }),
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  try {
    const result = await sql.begin(
      "isolation level repeatable read",
      async (tx: any) => {
        authority("four-preview-dependencies");
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='60s'`;
        const before = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        assert.deepEqual(before, prior.before, "Preview schema drift");
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id for update`;
        assert.deepEqual(control, {
          environment: "acceptance",
          sales_enabled: false,
          issuance_enabled: false,
          transfers_enabled: false,
          gameplay_enabled: false,
        });
        const versions = files.map((f: any) =>
          f.file.split("/").at(-1).slice(0, 14),
        );
        assert.equal(
          (
            await tx`select count(*)::int n from supabase_migrations.schema_migrations where version=any(${versions})`
          )[0].n,
          0,
          "Dependency already recorded: inspect instead of reapply",
        );
        const beforeSums = await sums(tx);
        const catalogue =
          await tx`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public_gameplay','commercial_billing') and p.prokind='f' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`;
        writePrivate("preview-before.private.json", {
          at: new Date().toISOString(),
          project: c.projectRef,
          schema: before,
          sums: beforeSums,
          catalogue,
          control,
        });
        for (const f of files) await tx.unsafe(blob(f.file).toString());
        const afterSums = await sums(tx);
        for (const t of Object.keys(beforeSums))
          assert.deepEqual(
            afterSums[t],
            beforeSums[t],
            "Existing Preview records changed: " + t,
          );
        assert.deepEqual(
          Object.keys(afterSums).filter((t) => !Object.hasOwn(beforeSums, t)),
          ["private.verified_phone_claims"],
        );
        const [phone] =
          await tx`select (select count(*)::int from private.verified_phone_claims) claims,(select count(*)::int from auth.users where phone_confirmed_at is not null and phone ~ '^\\+?[1-9][0-9]{7,14}$') verified`;
        assert.equal(phone.claims, phone.verified);
        for (const [i, f] of files.entries())
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${versions[i]},${f.file.split("/").at(-1).slice(15, -4)},${[blob(f.file).toString()]})`;
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          project: c.projectRef,
          files,
          schemaBefore: before,
          schemaAfter: (await tx.unsafe(v31SchemaFingerprintSql))[0],
          priorTablesUnchanged: Object.keys(beforeSums).length,
          phoneClaimsSeeded: phone.claims,
          migrationHistoryRowsAdded: 4,
          control,
          productionConnections: 0,
          smsSent: 0,
          customerTransactions: 0,
        };
      },
    );
    writeEvidence("preview-dependencies-applied.json", result);
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e: any) => {
  writeFileSync(
    privateDir + "/preview-dependencies-error.private.txt",
    String(e),
    { mode: 0o600 },
  );
  console.error(
    "Preview dependency operator stopped; inspect private diagnostic before any retry.",
  );
  process.exitCode = 1;
});
