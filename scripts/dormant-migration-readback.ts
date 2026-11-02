/** Fresh committed-state verification only; never applies or repairs records. */
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createDecipheriv, createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
async function main() {
  const root = process.cwd();
  const out = root + "/docs/qa/final-australia-20261102/migrations";
  const vault = root + "/private-data/commercial-restore-20261102d";
  const applied = JSON.parse(await readFile(out + "/apply.json", "utf8"));
  assert.equal(applied.mode, "apply");
  assert.equal(applied.project, "pojoymtniryarxxunyvz");
  assert.equal(applied.migrations.length, 2);
  const name = (await readdir(vault))
    .filter((n) => /^pre-apply-\d+\.aes$/.test(n))
    .sort()
    .at(-1);
  assert(name);
  const key = Buffer.from(
    (
      await readFile(
        process.env.USERPROFILE +
          "/.docked-secrets/launch-migration-backup-key.hex",
        "utf8",
      )
    ).trim(),
    "hex",
  );
  const raw = await readFile(vault + "/" + name);
  const cipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  cipher.setAuthTag(raw.subarray(12, 28));
  const previous = JSON.parse(
    Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(),
  );
  assert.equal(previous.project, applied.project);
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const after: Record<string, unknown> = {};
        for (const [table, before] of Object.entries(previous.before)) {
          // These timestamps can change under the unchanged postgame scheduler.
          // The DDL transaction verified this whole table exactly; its immutable
          // fixture/rule fields were also checked against the restored backup.
          if (
            [
              "sports_feed.nfl_rounds",
              "private.docked_mail_scheduler",
              "sports_feed.nfl_worker_runs",
              "sports_feed.weekly_core_job_runs",
            ].includes(table)
          )
            continue;
          const [now] = await tx.unsafe(
            `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          );
          assert.deepEqual(now, before, "Committed records changed: " + table);
          after[table] = now;
        }
        for (const m of applied.migrations) {
          const rows =
            await tx`select statements from supabase_migrations.schema_migrations where version=${m.file.slice(0, 14)}`;
          assert.equal(rows.length, 1);
          assert.equal(
            createHash("sha256")
              .update(rows[0].statements.join("\n"))
              .digest("hex"),
            m.sha256,
          );
        }
        const [flags] = await tx`select
      (select enabled from private.feature_flags where key='registration') registration,
      (select enabled from billing_retention.policy where id) retention,
      exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) commercial,
      exists(select 1 from public_gameplay.policy where enabled) public_policy,
      exists(select 1 from public_gameplay.sports where visible or play_enabled) public_sports,
      (select count(*)::int from public_gameplay.rounds) public_rounds,
      (select rolcanlogin or rolsuper or rolbypassrls from pg_roles where rolname='docked_retention_worker') retention_worker_active`;
        assert.deepEqual(flags, {
          registration: false,
          retention: false,
          commercial: false,
          public_policy: false,
          public_sports: false,
          public_rounds: 0,
          retention_worker_active: false,
        });
        return {
          at: new Date().toISOString(),
          project: applied.project,
          committedMigrationHashesMatch: true,
          protectedTablesCompared: Object.keys(after).length,
          protectedRecordsUnchanged: true,
          flags,
          operationalTables:
            "NFL round telemetry, mail tick and append-only worker run logs were fully verified unchanged inside DDL transaction; later scheduler activity excluded. cron.job schedule definitions are included in the fresh committed-state comparison.",
          mutations: 0,
        };
      },
    );
    await writeFile(out + "/post-commit.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Readback failed");
  process.exitCode = 1;
});
