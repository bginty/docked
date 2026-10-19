// Reviewed Preview-only migration runner. Never accepts a Production target.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
assert.equal(process.argv[2], "--preview");
const config = JSON.parse(
  readFileSync("private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(config.projectRef, "bckkllmndoxzpzdqrevb");
const url = new URL(config.databaseUrl);
assert.ok(
  url.hostname === `db.${config.projectRef}.supabase.co` ||
    (url.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(url.username) === `postgres.${config.projectRef}`),
);
const backup = JSON.parse(
  readFileSync("docs/qa/premium-member-release/backup.json", "utf8"),
);
const archive = readFileSync(
  "private-data/premium-member-preview-recovery/before-migrations.dump",
);
const digest = createHash("sha256").update(archive).digest("hex");
assert.ok(
  JSON.stringify(backup).includes(digest),
  "Recovery archive must match verified receipt",
);
const rehearsal = JSON.parse(
  readFileSync(
    "docs/qa/premium-member-release/recovery-rehearsal.json",
    "utf8",
  ),
);
assert.equal(rehearsal.passed, true);
const sql = postgres(url.href, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
try {
  const result = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820343)`;
    const tables =
      await tx`select schemaname,tablename from pg_tables where schemaname in ('beta_fantasy','beta_public','credits_sandbox') or (schemaname='auth' and tablename='users') or (schemaname='beta_private' and tablename in ('roles','admissions')) order by 1,2`;
    const snapshot = async () => {
      const rows = [];
      for (const t of tables) {
        const identifier = [t.schemaname, t.tablename]
          .map((v) => '"' + v.replaceAll('"', '""') + '"')
          .join(".");
        const data = await tx.unsafe(
          `select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) digest from ${identifier} t`,
        );
        rows.push({ table: t.schemaname + "." + t.tablename, ...data[0] });
      }
      return rows;
    };
    const before = await snapshot();
    const applied = [];
    for (const file of rehearsal.migrations) {
      const version = file.split("_")[0];
      if (
        (
          await tx`select 1 from supabase_migrations.schema_migrations where version=${version}`
        ).length
      )
        continue;
      const source = readFileSync("supabase/migrations/" + file, "utf8");
      await tx.unsafe(source);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${file.slice(15, -4)},${tx.array([source])})`;
      applied.push({
        file,
        sha256: createHash("sha256").update(source).digest("hex"),
      });
    }
    const after = await snapshot();
    assert.deepEqual(
      after,
      before,
      "Existing member, ownership, wallet, competition and admission rows must remain unchanged",
    );
    assert.equal(
      (await tx`select enabled from sports_feed.weekly_core_control`)[0]
        .enabled,
      false,
    );
    assert.equal(
      Number(
        (await tx`select count(*) n from sports_feed.weekly_core_packs`)[0].n,
      ),
      0,
    );
    return {
      applied,
      preservedTables: after,
      weeklyEnabled: false,
      packsIssued: 0,
    };
  });
  const receipt = {
    checkedAt: new Date().toISOString(),
    target: "protected-preview",
    projectRef: config.projectRef,
    recoverySha256: digest,
    ...result,
    productionChanged: false,
  };
  writeFileSync(
    "docs/qa/premium-member-release/preview-migrations.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(
    JSON.stringify({
      applied: result.applied.length,
      preservedTables: result.preservedTables.length,
      weeklyEnabled: false,
      packsIssued: 0,
      productionChanged: false,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      code: e.code ?? e.name,
      message: e.message.replaceAll(url.password, "[redacted]"),
    }),
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
