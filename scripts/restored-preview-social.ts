/** Apply only the tested additive commercial Profile projection to restored Preview. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(process.argv[2], "--isolated-only");
const passed = JSON.parse(
  readFileSync(
    "docs/qa/launch-resolution-20261102/commercial-social-postgres.json",
    "utf8",
  ),
);
assert.equal(passed.passed, true);
const file = "20261102023100_commercial_social_inventory.sql",
  version = file.slice(0, 14),
  source = readFileSync("supabase/migrations/" + file, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function main() {
  const evidence = await sql.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    const [previous] =
      await tx`select statements from supabase_migrations.schema_migrations where version=${version}`;
    if (previous) {
      assert.equal(
        createHash("sha256").update(previous.statements[0]).digest("hex"),
        sha256,
      );
      return { alreadyApplied: true };
    }
    const tables = [
      "auth.users",
      "public.profiles",
      "commercial_billing.control",
      "commercial_billing.cards",
      "commercial_billing.packs",
      "commercial_billing.receipts",
      "commercial_billing.lots",
      "commercial_billing.journals",
      "beta_fantasy.entries",
    ];
    const fingerprint = async () => {
      const rows = [];
      for (const table of tables) {
        const [r] = await tx.unsafe(
          `select count(*)::int count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),',' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
        );
        rows.push({ table, ...r });
      }
      return rows;
    };
    const before = await fingerprint();
    await tx.unsafe(source);
    assert.deepEqual(await fingerprint(), before);
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values(${version},${file.slice(15, -4)},${[source]})`;
    return { alreadyApplied: false, protectedRecordsUnchanged: true, tables };
  });
  const result = {
    at: new Date().toISOString(),
    project: c.projectRef,
    file,
    sha256,
    ...evidence,
    productionWrites: 0,
  };
  writeFileSync(
    "docs/qa/launch-resolution-20261102/preview-social-migration.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
