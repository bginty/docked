/** Apply the exact restore-tested backlog only to the existing free Preview. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, createDecipheriv } from "node:crypto";
import postgres from "postgres";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const c = JSON.parse(
  readFileSync(main + "/private-data/hosted-preview/connection.json", "utf8"),
);
const u = new URL(c.databaseUrl),
  ref = "bckkllmndoxzpzdqrevb";
assert.equal(c.projectRef, ref);
assert.equal(u.username, `postgres.${ref}`);
assert.equal(u.port, "5432");
assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
assert.equal(process.argv[2], "--apply-reviewed-preview");
const out = "docs/qa/launch-resolution-20261102";
const drill = JSON.parse(
  readFileSync(out + "/restore/restore-drill.json", "utf8"),
);
assert.equal(drill.sourceProject, ref);
assert(
  drill.restored && drill.protectedRecordsUnchanged && drill.network === "none",
);
const key = Buffer.from(
  readFileSync(
    process.env.USERPROFILE +
      "/.docked-secrets/launch-migration-backup-key.hex",
    "utf8",
  ).trim(),
  "hex",
);
const b = readFileSync("private-data/preview-restore-20261102p/manifest.aes"),
  d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
d.setAuthTag(b.subarray(12, 28));
const manifest = JSON.parse(
  Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
);
assert.equal(manifest.project, ref);
assert.equal(manifest.sha256, drill.archiveSha256);
const files = drill.migrations.map((m: { file: string; sha256: string }) => {
  const source = readFileSync("supabase/migrations/" + m.file, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), m.sha256);
  return { ...m, source, version: m.file.split("_")[0] };
});
const sql = postgres(u.href, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const checksum = (table: string) =>
  `select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) value from(select md5(to_jsonb(t)::text) h from ${table} t)q`;
async function run() {
  const result = await sql.begin(async (tx) => {
    await tx`set local lock_timeout='10s'`;
    await tx`set local statement_timeout='120s'`;
    const known =
      await tx`select version from supabase_migrations.schema_migrations`;
    assert.equal(
      known.length,
      102,
      "Preview changed; review instead of replaying",
    );
    for (const [table, expected] of Object.entries(manifest.sums))
      assert.deepEqual(
        (await tx.unsafe(checksum(table)))[0].value,
        expected,
        table + " drift",
      );
    const rounds =
      await tx`select to_jsonb(c) value from beta_fantasy.competitions c order by id`;
    for (const m of files) {
      assert(!known.some((a) => a.version === m.version));
      await tx.unsafe(m.source);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${m.version},${m.file.slice(15, -4)},array[${m.source}])`;
    }
    const after =
      await tx`select to_jsonb(c) value from beta_fantasy.competitions c order by id`;
    assert.equal(rounds.length, after.length);
    for (let i = 0; i < rounds.length; i++) {
      const old = rounds[i].value,
        next = after[i].value,
        change = drill.approvedRoundChanges.find(
          (r: { id: string }) => r.id === old.id,
        );
      assert.deepEqual(
        next,
        change
          ? { ...old, rules: { ...old.rules, lineup_version: change.version } }
          : old,
      );
    }
    for (const [table, expected] of Object.entries(manifest.sums))
      if (
        ![
          "beta_fantasy.competitions",
          "supabase_migrations.schema_migrations",
        ].includes(table)
      )
        assert.deepEqual(
          (await tx.unsafe(checksum(table)))[0].value,
          expected,
          table + " preservation",
        );
    const [control] =
      await tx`select sales_enabled,issuance_enabled,transfers_enabled from commercial_billing.control where id`;
    assert.deepEqual(control, {
      sales_enabled: false,
      issuance_enabled: false,
      transfers_enabled: false,
    });
    assert.equal(
      (await tx`select enabled from public_gameplay.policy where id`)[0]
        .enabled,
      false,
    );
    assert.equal(
      (await tx`select enabled from billing_retention.policy where id`)[0]
        .enabled,
      false,
    );
    assert.equal(
      (await tx`select count(*)::int n from cron.job where active`)[0].n,
      0,
    );
    return {
      at: new Date().toISOString(),
      project: ref,
      applied: files.map((m: { file: string; sha256: string }) => ({
        file: m.file,
        sha256: m.sha256,
      })),
      preservedProtectedTables: Object.keys(manifest.sums).filter(
        (t) =>
          ![
            "beta_fantasy.competitions",
            "supabase_migrations.schema_migrations",
          ].includes(t),
      ),
      approvedEmptyFutureSalaryTransitions: drill.approvedRoundChanges,
      publicPolicyEnabled: false,
      paymentsEnabled: false,
      prizesActivated: false,
      retentionEnabled: false,
      productionWrites: 0,
    };
  });
  writeFileSync(
    out + "/preview-migrations.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      project: ref,
      applied: result.applied.length,
      integrityPassed: true,
      productionWrites: 0,
    }),
  );
}
run()
  .finally(() => sql.end())
  .catch((e) => {
    writeFileSync(
      "private-data/preview-restore-20261102p/apply-error.private.log",
      String(e),
    );
    console.error(
      "Preview transaction rolled back; inspect private diagnostic",
    );
    process.exitCode = 1;
  });
