import { readFile, writeFile, mkdir } from "node:fs/promises";
import postgres from "postgres";
import assert from "node:assert/strict";
// Explicit existing isolated Preview target only. No Production fallback.
const root = process.env.DOCKED_OPERATOR_ROOT;
if (!root) throw Error("Private operator directory required");
const c = JSON.parse(
  await readFile(root + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
const url = new URL(c.databaseUrl);
assert(
  decodeURIComponent(url.username).endsWith("." + c.projectRef) ||
    url.hostname.includes(c.projectRef),
);
const sql = postgres(c.databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 12,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(root + "/certs/supabase-prod-ca-2021.crt", "utf8"),
  },
});
const files = [
  "20261022010531_multi_sport_readiness_registry.sql",
  "20261022023942_multi_sport_delivery_checkpoint.sql",
];
const report = {
  at: new Date().toISOString(),
  project: c.projectRef,
  production: false,
  migrations: [],
  restrictedRole: null,
  memberMutations: 0,
};
try {
  for (const file of files) {
    const version = file.split("_")[0];
    const [prior] =
      await sql`select version from supabase_migrations.schema_migrations where version=${version}`;
    if (prior) {
      report.migrations.push({ file, alreadyApplied: true });
      continue;
    }
    const ddl = await readFile("supabase/migrations/" + file, "utf8");
    assert(!/\bcommit\s*;/i.test(ddl));
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${file.slice(15, -4)},${[ddl]})`;
    });
    report.migrations.push({ file, applied: true });
  }
  // A NOLOGIN role rehearses least-privilege host setup inside a rolled-back
  // transaction. No persistent credential or test records are created.
  const rollback = new Error("acceptance rollback");
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(
        "create role docked_multi_acceptance nologin; grant usage on schema sports_feed to docked_multi_acceptance;",
      );
      for (const table of [
        "delivery_checkpoints",
        "delivery_records",
        "delivery_recalculations",
        "delivery_receipts",
      ]) {
        await tx.unsafe(
          `grant select,insert,update on sports_feed.${table} to docked_multi_acceptance; create policy acceptance on sports_feed.${table} to docked_multi_acceptance using(true) with check(true);`,
        );
      }
      // Supabase's postgres operator is not a superuser; explicit temporary
      // membership is required even for a role it created. Rolled back below.
      const [denials] =
        await tx`select has_table_privilege('docked_multi_acceptance','beta_fantasy.cards','UPDATE') card_write,has_table_privilege('docked_multi_acceptance','credits_sandbox.state','UPDATE') wallet_write,has_table_privilege('docked_multi_acceptance','sports_feed.activation_decisions','INSERT') approval_write,has_table_privilege('docked_multi_acceptance','sports_feed.journal','INSERT') scoring_write`;
      assert(Object.values(denials).every((x) => x === false));
      await tx.unsafe(
        "grant docked_multi_acceptance to current_user; set local role docked_multi_acceptance",
      );
      await tx`insert into sports_feed.delivery_checkpoints values('isolated-hosted-acceptance','nba','00000000-0000-4000-8000-000000000001',0,'00000000-0000-4000-8000-000000000001:nba:0',clock_timestamp())`;
      const [read] =
        await tx`select count(*)::int n from sports_feed.delivery_checkpoints where source='isolated-hosted-acceptance'`;
      assert.equal(read.n, 1);
      report.restrictedRole = {
        rawDeliveryReadWrite: true,
        ...denials,
        rolledBack: true,
      };
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
  const [clean] =
    await sql`select count(*)::int n from sports_feed.delivery_checkpoints where source='isolated-hosted-acceptance'`;
  assert.equal(clean.n, 0);
  report.result = "passed";
  await mkdir("docs/qa/multi-sport/integration", { recursive: true });
  await writeFile(
    "docs/qa/multi-sport/integration/hosted-database.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end({ timeout: 2 });
}
