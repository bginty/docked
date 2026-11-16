/** Read-only implicit PUBLIC privilege audit before creating any shared role. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
const u = new URL(c.databaseUrl);
assert.equal(decodeURIComponent(u.username), "postgres." + c.projectRef);
const sql = postgres(u.href, {
  max: 1,
  prepare: false,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function main() {
  try {
    const result = await sql.begin("read only", async (tx) => {
      const schemas =
        await tx`select n.nspname from pg_namespace n where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where a.grantee=0 and a.privilege_type='USAGE')`;
      const functions =
        await tx`select n.nspname,p.oid::regprocedure::text signature,p.prosecdef,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any(${schemas.map((s) => s.nspname)}) and p.prokind='f' and p.prosecdef and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')`;
      const tables =
        await tx`select n.nspname,c.relname,a.privilege_type from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where n.nspname=any(${schemas.map((s) => s.nspname)}) and c.relkind in('r','v','p') and a.grantee=0`;
      return { schemas, functions, tables };
    });
    writeFileSync(
      "docs/qa/batch1-hosted-20261116/preview-public-privileges.json",
      JSON.stringify(
        { at: new Date().toISOString(), readOnly: true, ...result },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        publicSchemas: result.schemas,
        publicDefinerFunctions: result.functions.map((f) => f.signature),
        publicTableGrants: result.tables,
      }),
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch(() => {
  console.error(
    "Read-only Preview privilege audit failed; no sensitive values emitted",
  );
  process.exitCode = 1;
});
