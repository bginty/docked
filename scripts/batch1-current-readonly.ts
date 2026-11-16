/** Fresh Production metadata/counts only. Never reads customer bodies or credentials into evidence. */
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { writeFileSync } from "node:fs";
import { custodyQuery } from "./lib/reviewed-inventory";
import { digest } from "../src/core/scoring-engine";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [assets] =
          await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select sum(issued)::int from commercial_billing.definitions) lifetime,(select count(*)::int from beta_packs.issued) beta_allocations,(select count(*)::int from commercial_billing.cards) commercial_cards,(select count(*)::int from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) open_commercial_controls,(select count(*)::int from private.feature_flags where enabled) enabled_flags,(select count(*)::int from operations.retention_policy where enabled) cleanup,(select count(*)::int from public_gameplay.rounds where enabled) enabled_rounds`;
        const [wallet] =
          await tx`select octet_length(document::text) bytes,jsonb_array_length(document->'journal') journal_entries,jsonb_array_length(document->'events') events,(select count(*)::int from jsonb_object_keys(document->'economy'->'players')) players,(select count(*)::int from jsonb_object_keys(document->'economy'->'instances')) instances,(select count(*)::int from jsonb_object_keys(document->'requests')) requests,md5((document->'journal')::text) journal_hash,md5(document::text) wallet_hash from credits_sandbox.state where id`;
        const tables =
          await tx`select n.nspname schema,c.relname name,c.relkind kind,c.relacl acl,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p','v','S') and n.nspname in('credits_sandbox','beta_private','beta_public','beta_fantasy','sports_feed','nfl_roster','commercial_billing','season_catalogue','beta_packs','private','public_gameplay') order by 1,2`;
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        return {
          assets,
          wallet,
          tables,
          custodyRecords: custody.length,
          custodyDigest: digest(custody),
        };
      },
    );
    const release = await fetch("https://docked.com.au/api/beta-release").then(
      (r) => r.json(),
    );
    writeFileSync(
      "docs/qa/batch1-hosted-20261116/production-readonly.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          ...result,
          release,
          productionWrites: 0,
          customerBodiesCopied: 0,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        assets: result.assets,
        workload: result.wallet,
        release,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error("Read-only Production metadata check failed");
  process.exitCode = 1;
});
