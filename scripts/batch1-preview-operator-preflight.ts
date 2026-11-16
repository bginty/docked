/** Read-only checks of the existing hosted Preview operator. No user rows. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
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
const s = postgres(u.href, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function main() {
  try {
    const result = await s.begin("read only", async (tx) => {
      const [r] =
        await tx`select current_user,current_setting('server_version_num') version,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,has_database_privilege(current_user,current_database(),'CREATE') schema_create,has_schema_privilege(current_user,'auth','USAGE') auth_usage,has_table_privilege(current_user,'auth.users','SELECT') users_select,has_table_privilege(current_user,'auth.users','REFERENCES') users_references,has_table_privilege(current_user,'auth.sessions','SELECT') sessions_select,has_table_privilege(current_user,'auth.mfa_factors','SELECT') factors_select from pg_roles where rolname=current_user`;
      assert.equal(r.current_user, "postgres");
      assert.equal(r.rolsuper, false);
      assert.equal(r.rolbypassrls, true);
      assert.equal(r.rolcreaterole, true);
      for (const k of [
        "schema_create",
        "auth_usage",
        "users_select",
        "users_references",
        "sessions_select",
        "factors_select",
      ])
        assert.equal(r[k], true, k);
      assert(
        Number(r.version) >= 170000 && Number(r.version) < 180000,
        "Recheck local version compatibility",
      );
      const [absence] =
        await tx`select (select count(*)::int from pg_namespace where nspname like 'b1\_%' escape '\') schemas,(select count(*)::int from pg_roles where rolname in('docked_pack_acceptance','docked_pack_acceptance_owner')) roles`;
      assert.equal(absence.schemas, 0);
      assert.equal(absence.roles, 0);
      return { operator: r, absence };
    });
    writeFileSync(
      "docs/qa/batch1-beta-alignment-20261116/hosted-operator-preflight.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          projectRef: ref,
          readOnly: true,
          hostedWrites: 0,
          ...result,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        hostedOperatorPrerequisites: true,
        namespaceAndRoleAbsence: true,
        hostedWrites: 0,
      }),
    );
  } finally {
    await s.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    "Read-only Preview operator preflight failed; no credentials emitted",
  );
  process.exitCode = 1;
});
