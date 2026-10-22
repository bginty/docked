// Fixed isolated target; read-only metadata; credentials never enter the receipt.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import assert from "node:assert/strict";
const project = "bckkllmndoxzpzdqrevb";
const root = process.argv[2];
assert(root, "Private operator root required");
const report = {
  project,
  production: false,
  at: new Date().toISOString(),
  readOnly: true,
};
let sql;
try {
  const c = JSON.parse(
    await readFile(
      resolve(root, "private-data/hosted-preview/connection.json"),
      "utf8",
    ),
  );
  assert.equal(c.projectRef, project);
  assert.equal(c.organizationId, "ernfnkcbalhyqpsrzdwa");
  assert.equal(new URL(c.supabaseUrl).origin, `https://${project}.supabase.co`);
  const url = new URL(c.databaseUrl);
  assert(["postgres:", "postgresql:"].includes(url.protocol));
  assert(
    url.hostname === `db.${project}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(url.username) === `postgres.${project}` &&
        url.port === "5432"),
  );
  sql = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 12,
    onnotice: () => {},
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(
        resolve(root, "certs/supabase-prod-ca-2021.crt"),
        "utf8",
      ),
    },
  });
  await sql.begin("read only", async (tx) => {
    report.role = (await tx`select current_user as role`)[0].role;
    report.migrations =
      await tx`select version from supabase_migrations.schema_migrations order by version`;
    report.schemas =
      await tx`select nspname from pg_namespace where nspname in ('sports_feed','scoring_beta','beta_fantasy') order by nspname`;
    report.functions =
      await tx`select n.nspname as schema,p.proname as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sports_feed' and p.proname in ('sandbox_identity','sandbox_state','seven_command','sandbox_nba_journals') order by p.proname`;
    const owner = JSON.parse(
      await readFile(
        resolve(
          root,
          "private-data/private-preview-release/owner.private.json",
        ),
        "utf8",
      ),
    );
    assert.equal(owner.email, "support@docked.com.au");
    report.owner = (
      await tx`select exists(select 1 from auth.users where id=${owner.id} and email=${owner.email} and email_confirmed_at is not null) confirmed,exists(select 1 from auth.mfa_factors where user_id=${owner.id} and status='verified') mfa_enrolled,exists(select 1 from auth.sessions where user_id=${owner.id} and aal='aal2' and (not_after is null or not_after>clock_timestamp())) mfa_session,exists(select 1 from sports_feed.sport_sandbox_access where user_id=${owner.id}) sandbox_allowed`
    )[0];
    report.runtimeRole = (
      await tx`select rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname='docked_beta_app'`
    )[0];
  });
  report.status = "read-only preflight passed";
} catch (e) {
  report.status = "blocked";
  report.code =
    typeof e.code === "string" && /^[A-Z0-9_]+$/.test(e.code)
      ? e.code
      : "PREFLIGHT_UNAVAILABLE";
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 2 });
  await mkdir("docs/qa/multi-sport/nba-acceptance", { recursive: true });
  await writeFile(
    "docs/qa/multi-sport/nba-acceptance/preview-database.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
