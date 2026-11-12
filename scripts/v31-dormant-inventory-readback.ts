/** Independent read-only verification after the separately approved inventory import.
 * Never imports inventory, repairs drift, changes authority or opens a gate. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  checksumQuery,
  custodyQuery,
  schemaQuery,
  validateReviewedInventory,
} from "./lib/reviewed-inventory";

async function main() {
  const root = process.cwd();
  const preflightPath = process.argv[2];
  const output = process.argv[3];
  assert(preflightPath && output, "Exact preflight and output paths required");
  assert(
    path
      .resolve(preflightPath)
      .startsWith(path.resolve("private-data") + path.sep),
  );
  assert(path.resolve(output).startsWith(path.resolve("docs/qa") + path.sep));
  const baseline = JSON.parse(readFileSync(preflightPath, "utf8"));
  const planBytes = readFileSync(
    "private-data/v31-card-research-20261111/complete-proposal.private.json",
  );
  assert.equal(
    createHash("sha256").update(planBytes).digest("hex"),
    "4b039916c4ef00698e10bfa9d14c41ce23b9febf06cf78e035ae595a08dd3ee4",
  );
  const plan = JSON.parse(planBytes.toString("utf8"));
  validateReviewedInventory(plan);
  assert.equal(baseline.projectRef, "pojoymtniryarxxunyvz");
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='60s'`;
        const [{ value: schema }] = await tx.unsafe(schemaQuery);
        assert.deepEqual(schema, baseline.schemaFingerprint);
        const [{ value: custody }] = await tx.unsafe(custodyQuery);
        assert.equal(digest(custody), plan.protectedCustodyDigest);
        assert.equal(custody.length, 906);
        const [exact] = await tx.unsafe(
          `with expected as (
        select * from jsonb_to_recordset($1::text::jsonb) r(id uuid,player_id uuid,sport text,rarity text,lifetime_cap int,
          issued int,legacy_issued int,approved bool,rights_reference text,snapshot jsonb)
        ) select count(*)::int mismatches from commercial_billing.definitions d full join expected e using(id)
          where d.id is null or e.id is null or to_jsonb(d) is distinct from to_jsonb(e)`,
          [JSON.stringify(plan.rows)],
        );
        assert.equal(
          exact.mismatches,
          0,
          "Actual inventory differs from frozen manifest",
        );
        const [counts] =
          await tx`select count(*)::int definitions, sum(legacy_issued)::int lifetime_consumed,
        sum(issued)::int issued, count(*)filter(where approved)::int approved,
        count(*)filter(where issued<>legacy_issued or issued>lifetime_cap)::int invalid_supply,
        count(distinct (sport,player_id,rarity))::int unique_definitions from commercial_billing.definitions`;
        assert.deepEqual(counts, {
          definitions: 6540,
          lifetime_consumed: 888,
          issued: 888,
          approved: 0,
          invalid_supply: 0,
          unique_definitions: 6540,
        });
        const caps =
          await tx`select rarity,min(lifetime_cap)::int minimum,max(lifetime_cap)::int maximum,count(*)::int definitions
        from commercial_billing.definitions group by rarity order by rarity`;
        const expectedCaps: Record<string, number> = {
          RARE: 5000,
          ELITE: 2500,
          ULTRA_RARE: 400,
          LEGENDARY: 50,
          ICON: 1,
        };
        assert.equal(caps.length, 5);
        for (const row of caps) {
          assert.equal(row.minimum, expectedCaps[row.rarity]);
          assert.equal(row.maximum, expectedCaps[row.rarity]);
        }
        const protectedTables = Object.keys(baseline.tables).filter(
          (t) =>
            (t.startsWith("commercial_billing.") &&
              t !== "commercial_billing.definitions") ||
            [
              "credits_sandbox.state",
              "credits_sandbox.card_instances",
              "credits_sandbox.nba_fixture_instances",
              "credits_sandbox.nba_fixture_definitions",
              "credits_sandbox.pack_receipts",
              "credits_sandbox.permanent_players",
              "beta_fantasy.cards",
              "beta_fantasy.ownership_events",
              "sports_feed.sport_sandbox_inventory",
              "operations.incidents",
              "operations.events",
              "cron.job",
            ].includes(t),
        );
        assert(protectedTables.length >= 25);
        for (const table of protectedTables) {
          const [{ value }] = await tx.unsafe(checksumQuery(table));
          assert.deepEqual(
            { count: value.count, hash: value.hash },
            baseline.tables[table],
            "Protected data changed: " + table,
          );
        }
        const [gates] = await tx`select
        (select enabled from private.feature_flags where key='registration') registration,
        (select enabled from private.feature_flags where key='billing_ops_alerts') alerts,
        (select enabled from operations.retention_policy) retention,
        (select routine_days from operations.retention_policy) retention_days,
        (select count(*)::int from operations.retention_receipts) deletion_receipts,
        (select count(*)::int from public_gameplay.rounds) practice_rounds,
        exists(select 1 from public_gameplay.rounds where enabled or fixture_kind<>'practice') active_or_scored_rounds,
        exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) commerce,
        (select count(*)::int from commercial_billing.products where approved) approved_products,
        (select count(*)::int from commercial_billing.cards) new_cards,
        (select count(*)::int from commercial_billing.packs) commercial_packs,
        (select count(*)::int from commercial_billing.receipts) commercial_receipts,
        (select count(*)::int from commercial_billing.accounts) commercial_accounts,
        (select count(*)::int from private.outbox where payload->>'purpose'='billing_ops_health_v1') operational_emails`;
        for (const field of [
          "registration",
          "alerts",
          "retention",
          "active_or_scored_rounds",
          "commerce",
        ])
          assert.equal(gates[field], false, field);
        for (const field of [
          "deletion_receipts",
          "approved_products",
          "new_cards",
          "commercial_packs",
          "commercial_receipts",
          "commercial_accounts",
          "operational_emails",
        ])
          assert.equal(gates[field], 0, field);
        assert.equal(gates.retention_days, 90);
        assert.equal(gates.practice_rounds, 6);
        return {
          at: new Date().toISOString(),
          project: baseline.projectRef,
          productionWrites: 0,
          planSha256: baseline.planSha256,
          exactManifestMatches: true,
          counts,
          caps,
          coreSupply:
            "unlimited; unchanged; not part of this limited inventory import",
          protectedCustodyDigest: digest(custody),
          custodyRecords: 906,
          protectedTablesCompared: protectedTables.length,
          protectedRecordsUnchanged: true,
          schema,
          gates,
        };
      },
    );
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(JSON.stringify(result));
  } finally {
    await sql.end();
  }
}
main().catch((error: unknown) => {
  const failure = error as { message?: string; code?: string; stack?: string };
  writeFileSync(
    "private-data/v31-card-research-20261111/independent-postflight-error.private.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        message: failure.message,
        code: failure.code,
        stack: failure.stack,
      },
      null,
      2,
    ) + "\n",
  );
  console.error(
    "Read-only inventory verification failed; inspect privately before further actions",
  );
  process.exitCode = 1;
});
