// Additive Docked-only deployment. No account action, grant, or admission activation.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const mode = process.argv[2];
assert.ok(["--inspect", "--apply"].includes(mode));
const file = "20261010210741_support_privacy_and_beta_catalogue.sql";
const source = readFileSync(`supabase/migrations/${file}`, "utf8").replaceAll(
  "\r\n",
  "\n",
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(
  readFileSync("docs/qa/friends-release/real-postgres.json", "utf8"),
);
assert.equal(evidence.passed, true);
assert.equal(evidence.migrationHashes[file], hash(source));
const sql = ownerDatabase();
try {
  const tables =
    await sql`select schemaname,tablename from pg_tables where schemaname in('fantasy','private','public','beta_fantasy','beta_private','beta_public') order by 1,2`;
  const snapshot = async (tx) => {
    const rows = [];
    for (const t of tables) {
      const name = `${t.schemaname}.${t.tablename}`;
      assert.match(name, /^[a-z_]+\.[a-z0-9_]+$/);
      rows.push({
        name,
        ...(
          await tx.unsafe(
            `select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${name} t`,
          )
        )[0],
      });
    }
    return hash(JSON.stringify(rows));
  };
  const before = await snapshot(sql);
  assert.equal(
    (await sql`select enabled from beta_private.friends_control`)[0].enabled,
    false,
  );
  if (mode === "--apply")
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820341),pg_advisory_xact_lock(71820343)`;
      const prior =
        await tx`select statements from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
      if (prior.length)
        assert.equal(
          hash(prior[0].statements[0].replaceAll("\r\n", "\n")),
          hash(source),
        );
      else {
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},${file.slice(15, -4)},${[source]})`;
      }
      assert.equal(
        await snapshot(tx),
        before,
        "Existing records changed; rollback",
      );
      for (const role of [
        "anon",
        "authenticated",
        "docked_app",
        "docked_beta_app",
      ]) {
        assert.equal(
          (
            await tx`select has_function_privilege(${role},'beta_private.support_privacy_redact(uuid)','execute') allowed`
          )[0].allowed,
          false,
        );
        assert.equal(
          (
            await tx`select has_table_privilege(${role},'beta_private.privacy_cases','select') allowed`
          )[0].allowed,
          false,
        );
      }
    });
  assert.equal(await snapshot(sql), before);
  const report = {
    checkedAt: new Date().toISOString(),
    projectRef,
    mode,
    passed: true,
    migration: file,
    sha256: hash(source),
    existingDataUnchanged: true,
    externalAccessEnabled: false,
    realPrivacyRequestsExecuted: false,
    scope:
      "Hosted schema and permission verification only; isolated export/erasure acceptance is local",
  };
  mkdirSync("docs/qa/free-beta-data", { recursive: true });
  writeFileSync(
    `docs/qa/free-beta-data/privacy-hosted-${mode.slice(2)}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
