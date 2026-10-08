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
  "20261008224142_beta_namespace_isolation.sql",
  "20261008224144_beta_atomic_admission.sql",
  "20261008225828_beta_owner_acceptance_boundary.sql",
  "20261008232200_beta_admission_snapshot_serialization.sql",
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
async function officialSnapshot(tx) {
  const rows = [];
  for (const table of await tx`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy') order by 1,2`) {
    const name = table.schemaname + "." + table.tablename;
    assert.match(name, /^[a-z_]+\.[a-z0-9_]+$/);
    // Only irreversible digests leave the process, never member/provider records.
    const row = (
      await tx.unsafe(
        `select md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest,count(*)::int n from ${name} t`,
      )
    )[0];
    rows.push({ name, ...row });
  }
  return hash(JSON.stringify(rows));
}
try {
  const identity = (
    await sql`select current_user role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) tls,has_table_privilege(current_user,'auth.users','REFERENCES') refs`
  )[0];
  assert.equal(identity.role, "postgres");
  assert.equal(identity.tls, true);
  assert.equal(identity.refs, true);
  report.existingBetaSchemas = (
    await sql`select nspname from pg_namespace where nspname in('beta_public','beta_private','beta_fantasy')`
  ).map((r) => r.nspname);
  report.authUserCount = Number(
    (await sql`select count(*) n from auth.users`)[0].n,
  );
  report.beforeOfficialDigest = await officialSnapshot(sql);
  if (mode === "--apply") {
    const evidence = JSON.parse(
      readFileSync("docs/qa/beta-isolation/real-postgres.json", "utf8"),
    );
    assert.equal(evidence.passed, true);
    for (const s of statements)
      assert.equal(
        evidence.migrationHashes[s.file],
        hash(s.sql),
        "Exact migration must pass real PostgreSQL first",
      );
    const applied =
      await sql`select version,statements from supabase_migrations.schema_migrations where version=any(${files.map((f) => f.slice(0, 14))})`;
    for (const row of applied) {
      const source = statements.find((s) => s.file.startsWith(row.version));
      assert.equal(row.statements?.length, 1);
      assert.equal(
        hash(row.statements[0].replaceAll("\r\n", "\n")),
        hash(source.sql),
        "Applied migration differs; never overwrite",
      );
    }
    if (report.existingBetaSchemas.length)
      assert.ok(
        applied.some((r) => r.version === files[0].slice(0, 14)),
        "Existing beta schema is not tracked",
      );
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820343)`;
      for (const s of statements) {
        const version = s.file.slice(0, 14),
          name = s.file.slice(15, -4);
        if (applied.some((r) => r.version === version)) continue;
        assert.equal(
          (
            await tx`select 1 from supabase_migrations.schema_migrations where version=${version}`
          ).length,
          0,
        );
        await tx.unsafe(s.sql);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${name},${[s.sql]})`;
      }
      assert.equal(
        await officialSnapshot(tx),
        report.beforeOfficialDigest,
        "Official rows changed; rolling back",
      );
      assert.equal(
        (await tx`select enabled from beta_private.admission_control`)[0]
          .enabled,
        false,
      );
      assert.equal(
        (await tx`select enabled from beta_fantasy.settings`)[0].enabled,
        false,
      );
    });
    report.applied = true;
  }
  report.afterOfficialDigest = await officialSnapshot(sql);
  assert.equal(report.afterOfficialDigest, report.beforeOfficialDigest);
  report.officialRecordsUnchanged = true;
  report.migrationHashes = Object.fromEntries(
    statements.map((s) => [s.file, hash(s.sql)]),
  );
  mkdirSync("docs/qa/beta-isolation", { recursive: true });
  writeFileSync(
    `docs/qa/beta-isolation/hosted-${report.existingBetaSchemas.length && mode === "--apply" ? "forward" : mode.slice(2)}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(
    JSON.stringify({
      error:
        "Beta migration operation failed; inspect locally before any retry",
      code: error.code ?? null,
      message:
        error instanceof assert.AssertionError ? error.message : undefined,
    }),
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
