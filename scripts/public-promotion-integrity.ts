/** Read-only application release census. No migrations, grants or activations. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  mode = process.argv[2];
assert(["before", "after"].includes(mode));
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const out = "docs/qa/public-promotion-20261105";
async function run() {
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='120s'`;
        const tables =
          await tx`select schemaname,tablename from pg_tables where schemaname in ('commercial_billing','billing_retention','public_gameplay') or (schemaname='credits_sandbox' and tablename in ('state','card_instances','pack_receipts','journal','pack_entitlements')) or (schemaname='beta_fantasy' and tablename in ('cards','entries','results','competitions','ownership_events','sales','round_drafts','slot_locks','lineup_configurations','scoring_rules')) order by 1,2`;
        const fingerprints: Record<string, unknown> = {};
        for (const t of tables) {
          const name = t.schemaname + "." + t.tablename;
          fingerprints[name] = (
            await tx.unsafe(
              `select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) hash from (select md5(to_jsonb(t)::text) h from ${name} t) q`,
            )
          )[0];
        }
        fingerprints["auth.identities"] = (
          await tx`select count(*)::int count,md5(coalesce(string_agg(md5(jsonb_build_array(id,email,deleted_at,banned_until)::text),'' order by id),'')) hash from auth.users`
        )[0];
        fingerprints["cron.configuration"] = (
          await tx`select count(*)::int count,md5(coalesce(jsonb_agg(jsonb_build_object('id',jobid,'schedule',schedule,'command',command,'active',active,'user',username) order by jobid)::text,'')) hash from cron.job`
        )[0];
        const [gates] =
          await tx`select (select enabled from private.feature_flags where key='registration') registration,(select enabled from public_gameplay.policy where id) public_gameplay,(select enabled from billing_retention.policy where id) retention,(select sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled from commercial_billing.control where id) commercial,(select count(*)::int from public_gameplay.rounds where enabled) public_rounds`;
        assert.deepEqual(gates, {
          registration: false,
          public_gameplay: false,
          retention: false,
          commercial: false,
          public_rounds: 0,
        });
        const dependencies =
          await tx`select version from supabase_migrations.schema_migrations where version in ('20261101120754','20261102010000','20261102010001','20261102011703','20261102023100') order by version`;
        assert.equal(dependencies.length, 5);
        const [security] =
          await tx`select exists(select 1 from pg_tables t join pg_class c on c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass where t.schemaname in ('commercial_billing','billing_retention','public_gameplay') and not c.relrowsecurity) missing_rls,has_function_privilege('anon','public_gameplay.read_state(text)','execute') or has_function_privilege('authenticated','public_gameplay.read_state(text)','execute') public_execute`;
        assert.deepEqual(security, {
          missing_rls: false,
          public_execute: false,
        });
        return {
          at: new Date().toISOString(),
          project: "pojoymtniryarxxunyvz",
          mode,
          productionWrites: 0,
          fingerprints,
          gates,
          security,
          dependencies,
        };
      },
    );
    if (mode === "after") {
      const before = JSON.parse(
        readFileSync(out + "/integrity-before.json", "utf8"),
      );
      assert.deepEqual(
        report.fingerprints,
        before.fingerprints,
        "Investigate customer activity before asserting unchanged",
      );
    }
    writeFileSync(
      out + "/integrity-" + mode + ".json",
      JSON.stringify({ ...report, passed: true }, null, 2),
    );
    console.log(
      JSON.stringify({
        mode,
        passed: true,
        protectedGroups: Object.keys(report.fingerprints).length,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
