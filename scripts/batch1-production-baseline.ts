/** Read-only census. No credentials/customer rows are printed or committed. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { custodyQuery } from "./lib/reviewed-inventory";
import { digest } from "../src/core/scoring-engine";
async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const release = await fetch("https://docked.com.au/api/beta-release").then(
      (r) => r.json(),
    );
    const value = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        const [counts] = await tx`select
        (select count(*)::int from commercial_billing.definitions) definitions,
        (select sum(issued)::int from commercial_billing.definitions) lifetime,
        (select sum(legacy_issued)::int from commercial_billing.definitions) legacy,
        (select count(*)::int from beta_packs.issued) beta_allocations,
        (select count(*)::int from commercial_billing.cards) commercial_cards,
        (select count(*)::int from public_gameplay.rounds where enabled) active_competitions,
        (select count(*)::int from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) open_commercial_controls,
        (select count(*)::int from private.feature_flags where enabled) public_flags,
        (select count(*)::int from operations.retention_policy where enabled) deletion_schedules`;
        assert.equal(counts.definitions, 6540);
        assert(
          counts.lifetime >= 890,
          "Legitimate lifetime issuance cannot decrease",
        );
        assert.equal(counts.legacy, 888);
        assert(
          counts.beta_allocations >= 2,
          "Legitimate beta allocations cannot disappear",
        );
        assert.equal(
          counts.lifetime,
          counts.legacy + counts.beta_allocations + counts.commercial_cards,
        );
        for (const k of [
          "commercial_cards",
          "active_competitions",
          "open_commercial_controls",
          "public_flags",
          "deletion_schedules",
        ])
          assert.equal(counts[k], 0, k);
        const [hashes] =
          await tx`select md5((document->'journal')::text) journal,
        md5((document->'lots')::text) lots,md5((document->'cases')::text) cases,
        md5(document::text) aggregate from credits_sandbox.state where id`;
        return {
          counts,
          custodyRecords: custody.length,
          custodyDigest: digest(custody),
          financialHashes: hashes,
        };
      },
    );
    const out = "docs/qa/batch1-pack-phone-20261116";
    mkdirSync(out, { recursive: true });
    writeFileSync(
      `${out}/production-${process.argv.includes("--final") ? "final-readback" : "baseline"}.json`,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          release,
          ...value,
          productionWrites: 0,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ ...value, release }));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
