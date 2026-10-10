// Exact-project, additive migration executor. --inspect is read-only; --apply
// requires matching real-PostgreSQL evidence. Never prints connection material.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import postgres from "postgres";
import assert from "node:assert/strict";
import { databaseConnectionOptions } from "../src/server/database-tls.ts";
const mode = process.argv[2];
assert.ok(["--inspect", "--apply"].includes(mode));
const ref = "pojoymtniryarxxunyvz",
  org = "otldyeunbqabbcjydjpe";
const base = "private-data/production/";
const provision = JSON.parse(
  readFileSync(base + "provision-request.json", "utf8"),
);
assert.equal(provision.organizationId, org);
assert.equal(
  readFileSync(
    base + "provider-config/supabase/.temp/project-ref",
    "utf8",
  ).trim(),
  ref,
);
const url = new URL(
  readFileSync(
    base + "provider-config/supabase/.temp/pooler-url",
    "utf8",
  ).trim(),
);
assert.equal(url.username, `postgres.${ref}`);
assert.match(url.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
url.password = provision.databasePassword;
const sql = postgres(url.href, {
  ...databaseConnectionOptions(url.href, {
    DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
  }),
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});

const files = [
  "20261010083630_two_person_beta_access.sql",
  "20261010083836_two_person_sandbox_swaps.sql",
];
const hash = (s) => createHash("sha256").update(s).digest("hex");
const statements = files.map((file) => ({
  file,
  sql: readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
    "\r\n",
    "\n",
  ),
}));
const report = {
  project: ref,
  organization: org,
  mode,
  checkedAt: new Date().toISOString(),
  applied: false,
};
async function snapshot(tx, tables) {
  const values = [];
  for (const t of tables) {
    const name = t.schemaname + "." + t.tablename;
    assert.match(name, /^[a-z_]+\.[a-z0-9_]+$/);
    const row = (
      await tx.unsafe(
        `select md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest,count(*)::int n from ${name} t`,
      )
    )[0];
    values.push({ name, ...row });
  }
  return hash(JSON.stringify(values));
}
try {
  assert.equal((await sql`select current_user u`)[0].u, "postgres");
  assert.equal(
    (await sql`select ssl from pg_stat_ssl where pid=pg_backend_pid()`)[0].ssl,
    true,
  );
  const existing =
    await sql`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy','beta_fantasy') and tablename not like 'swap_%' and tablename<>'swaps' order by 1,2`;
  const before = await snapshot(sql, existing);
  const factors =
    await sql`select f.id,f.user_id,f.status,f.factor_type from auth.mfa_factors f join beta_private.owner_gameplay_control c on c.owner_id=f.user_id order by f.id`;
  const owner =
    await sql`select owner_id from beta_private.owner_gameplay_control where enabled`;
  assert.equal(owner.length, 1);
  assert.equal(
    (
      await sql`select testers_enabled from beta_private.admission_control where id`
    )[0].testers_enabled,
    false,
  );
  assert.equal(
    Number(
      (
        await sql`select count(*) n from beta_private.admissions where not administrator`
      )[0].n,
    ),
    0,
  );
  if (mode === "--apply") {
    const evidence = JSON.parse(
      readFileSync("docs/qa/two-person-beta/real-postgres.json", "utf8"),
    );
    assert.equal(evidence.passed, true);
    for (const s of statements)
      assert.equal(
        evidence.migrationHashes[s.file],
        hash(s.sql),
        "Exact migration not tested",
      );
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820341),pg_advisory_xact_lock(71820343)`;
      for (const s of statements) {
        const version = s.file.slice(0, 14);
        const prior =
          await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
        if (prior.length) {
          assert.equal(
            hash(prior[0].statements[0].replaceAll("\r\n", "\n")),
            hash(s.sql),
          );
          continue;
        }
        await tx.unsafe(s.sql);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${s.file.slice(15, -4)},${[s.sql]})`;
      }
      assert.equal(
        await snapshot(tx, existing),
        before,
        "Existing gameplay or official records changed; rolling back",
      );
      assert.deepEqual(
        await tx`select f.id,f.user_id,f.status,f.factor_type from auth.mfa_factors f join beta_private.owner_gameplay_control c on c.owner_id=f.user_id order by f.id`,
        factors,
      );
      const pair = (
        await tx`select * from beta_private.two_person_control where id`
      )[0];
      assert.equal(pair.owner_id, owner[0].owner_id);
      assert.equal(pair.tester_id, null);
      assert.equal(pair.tester_enabled, false);
      assert.equal(
        (await tx`select enabled from beta_fantasy.swap_policy where id`)[0]
          .enabled,
        false,
      );
      const sessions =
        await tx`select id from auth.sessions where user_id=${owner[0].owner_id} and (not_after is null or not_after>now()) order by created_at desc limit 1`;
      assert.equal(sessions.length, 1);
      await tx`select set_config('request.jwt.claim.sub',${owner[0].owner_id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner[0].owner_id, session_id: sessions[0].id, aal: "aal2" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${ref},true)`;
      assert.equal((await tx`select has_function_privilege('docked_beta_app','beta_fantasy.production_read_state()','EXECUTE') ok`)[0].ok,true);
      const state = (
        await tx`select beta_fantasy.production_read_state() state`
      )[0].state;
      assert.equal(state.user_id, owner[0].owner_id);
      report.ownerCards = state.cards.length;
      report.ownerReadVerified =
        "Database-only read using existing session identity; not a browser sign-in or MFA ceremony";
    });
    report.applied = true;
  }
  assert.equal(await snapshot(sql, existing), before);
  report.existingRecordsUnchanged = true;
  report.ownerMfaEnrollmentUnchanged = true;
  report.externalAdmissionEnabled = false;
  report.swapsEnabled = false;
  report.migrationHashes = Object.fromEntries(
    statements.map((s) => [s.file, hash(s.sql)]),
  );
  mkdirSync("docs/qa/two-person-beta", { recursive: true });
  writeFileSync(
    "docs/qa/two-person-beta/hosted-" + mode.slice(2) + ".json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      error: "Two-person preparation failed safely",
      code: e.code ?? null,
      message: e instanceof assert.AssertionError || e.code === "42501" ? e.message : undefined,
    }),
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
