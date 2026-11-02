/** Read-only protected data fingerprint and dormant retention monitor. */
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
async function main() {
  const cwd = process.cwd(),
    out = cwd + "/docs/qa/v30-customer-billing-20261102";
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const names =
          await tx`select schemaname,tablename from pg_tables where schemaname in ('fantasy','beta_fantasy','commercial_billing') and tablename in ('accounts','cards','ownership_events','ledger','journals','lines','lots','members','packs','pack_items','entries','results','round_scores','sales','receipts','receipt_events') union select schemaname,tablename from pg_tables where schemaname='credits_sandbox' and tablename in ('state','card_instances','nba_fixture_instances','journal','lines','pack_receipts','history') union select 'cron','job'`;
        const tables: Record<string, unknown> = {};
        for (const n of names) {
          const key = n.schemaname + "." + n.tablename;
          assert(/^[a-z_]+\.[a-z_]+$/.test(key));
          tables[key] = (
            await tx.unsafe(
              `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${key} t`,
            )
          )[0];
        }
        const [retention] =
          await tx`select p.version,p.enabled,p.completed_job_days,p.archive_days,p.authority,p.valid_until,(select count(*)::int from billing_retention.archives) archives,(select count(*)::int from billing_retention.holds where released_at is null) holds,(select count(*)::int from billing_retention.holds where released_at is null and review_at<clock_timestamp()) overdue_holds from billing_retention.policy p where id`;
        assert.equal(retention.enabled, false);
        assert.equal(retention.authority, null);
        assert.equal(retention.archives, 0);
        return {
          at: new Date().toISOString(),
          project: "pojoymtniryarxxunyvz",
          tables,
          retention,
          mutations: 0,
        };
      },
    );
    if (process.argv[2] === "after") {
      const before = JSON.parse(
        await readFile(out + "/production-before.json", "utf8"),
      );
      assert.deepEqual(
        data.tables,
        before.tables,
        "Protected records changed; inspect before attribution",
      );
    }
    await writeFile(
      out +
        "/production-" +
        (process.argv[2] === "after" ? "after" : "before") +
        ".json",
      JSON.stringify(data, null, 2),
    );
    console.log(
      JSON.stringify({
        protectedTables: Object.keys(data.tables).length,
        matched: process.argv[2] === "after",
        retention: data.retention,
        mutations: 0,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
