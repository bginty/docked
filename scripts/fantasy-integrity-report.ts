import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import {
  assertPhase5dConnection,
  phase5dProject,
} from "./hosted-preview/phase5d-scope";
async function main() {
  if (process.argv[2] !== `--confirm-project=${phase5dProject}`)
    throw Error("Exact Preview scope required");
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assertPhase5dConnection(c);
  const j = JSON.parse(
    await readFile("private-data/fantasy/testers.json", "utf8"),
  );
  const sql = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca: await readFile(c.caFile, "utf8") },
  });
  try {
    const checks = (
      await sql`select
 (select count(*)<=3 from fantasy.members where revoked_at is null and expires_at>clock_timestamp()) member_cap,
 not exists(select 1 from fantasy.editions where issued>max_supply) supply_bounds,
 not exists(select 1 from fantasy.cards a left join lateral(select to_user from fantasy.ownership_events o where o.card_id=a.id order by created_at desc,id desc limit 1) o on true where o.to_user is distinct from a.owner_id) current_owner_matches_provenance,
 not exists(select 1 from fantasy.ledger group by journal_id having sum(amount)<>0) balanced_journals,
 not exists(select 1 from fantasy.ledger where account not like 'system:%' group by account having sum(amount)<0) nonnegative_wallets,
 (select coalesce(sum(fee),0) from fantasy.sales)=(select coalesce(sum(amount),0) from fantasy.ledger where account='system:fee') sale_fees_reconcile,
 not exists(select 1 from fantasy.packs p join fantasy.pack_definitions d on d.id=p.definition_id where (select count(*) from fantasy.pack_items i where i.pack_id=p.id)<>jsonb_array_length(d.slots)) complete_pack_issuance,
 not exists(select 1 from fantasy.listings l join fantasy.cards c on c.id=l.card_id where l.state='active' and l.seller<>c.owner_id) listings_have_owner,
 (select count(*) from auth.users where id=any(${j.baselineIds}::uuid[]))=${j.baselineIds.length} original_accounts_preserved,
 (select count(*)=0 from private.tip_publications) old_publication_gate,
 (select count(*)=0 from private.feature_flags where enabled) old_feature_gates,
 (select count(*)=0 from private.outbox where state='sent') no_outbound_email,
 (select count(*)=6 from private.football_model_attempts) original_model_history_preserved`
    )[0];
    const counts = (
      await sql`select (select count(*) from fantasy.cards)::int cards,(select count(*) from fantasy.packs)::int packs,(select count(*) from fantasy.sales)::int sales,(select count(*) from fantasy.trades where state='accepted')::int trades,(select count(*) from fantasy.results)::int results,(select count(*) from fantasy.ownership_events)::int provenance_events,(select count(*) from auth.users)::int auth_accounts`
    )[0];
    const passed = Object.values(checks).every((v) => v === true);
    await writeFile(
      "docs/qa/fantasy/live-integrity.json",
      JSON.stringify(
        {
          status: passed ? "PASS" : "FAIL",
          project: phase5dProject,
          checks,
          counts,
          productionChanged: false,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ status: passed ? "PASS" : "FAIL", checks, counts }),
    );
    if (!passed) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-only Preview invariant check failed.");
  process.exitCode = 1;
});
