/** Existing Preview only, read-only metadata. Never prints credentials or user rows. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import postgres from "postgres";
const dir = "docs/qa/batch1-hosted-20261116";
const ref = "bckkllmndoxzpzdqrevb";
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, ref);
const u = new URL(c.databaseUrl);
assert.equal(decodeURIComponent(u.username), "postgres." + ref);
assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
const sql = postgres(u.href, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function run() {
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const roles =
          await tx`select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname in('postgres','docked_beta_app','docked_pack_acceptance') order by 1`;
        const tables =
          await tx`select n.nspname schema,c.relname name,c.reltuples::bigint estimated_rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname in('credits_sandbox','beta_private','beta_public','beta_fantasy','sports_feed','nfl_roster','commercial_billing','season_catalogue','beta_packs') order by 1,2`;
        const functions =
          await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\r',''),'UTF8')),'hex') hash,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname in('credits_sandbox','beta_private','beta_public','beta_fantasy','sports_feed','nfl_roster','commercial_billing','season_catalogue','beta_packs') order by 1`;
        const databases =
          await tx`select datname from pg_database where datistemplate=false order by 1`;
        const migrations =
          await tx`select version from supabase_migrations.schema_migrations order by version`;
        return { roles, tables, functions, databases, migrations };
      },
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      dir + "/preview-dependencies.json",
      JSON.stringify(
        { at: new Date().toISOString(), ref, readOnly: true, ...report },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        schemas: [...new Set(report.tables.map((t) => t.schema))],
        tables: report.tables.length,
        functions: report.functions.length,
        roles: report.roles,
        databases: report.databases,
        productionConnections: 0,
        hostedWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
run().catch(() => {
  console.error(
    "Preview read-only metadata inspection failed; no values emitted",
  );
  process.exitCode = 1;
});
