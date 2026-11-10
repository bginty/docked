/** Loopback-only proof of nonzero lifetime baseline preservation. No providers. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { dormantCommercialPool } from "../src/core/commercial-pool-plan";
import { importDormantCommercialPool } from "./commercial-pool-import";
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 12, onnotice: () => {} });
const player = {
  id: "0058d801-be72-4ba3-ad83-1325b2e8bcfc",
  sport: "afl",
  provider: "isolated",
  providerId: "historical-player",
  snapshot: {
    name: "Isolated acceptance identity",
    team: "Fixture",
    position: "MID",
    season: "2026",
    verifiedJerseyNumber: null,
    colour: "#123456",
    status: "active",
    synthetic: false,
  },
  eligiblePositions: ["MID"],
  source: {
    url: "https://example.invalid/fixture",
    hash: "a".repeat(64),
    checkedAt: "2026-11-10T00:00:00Z",
    license: "isolated-test-only-not-rights-evidence",
    verification: "test fixture",
    permanentIssuanceEligible: false,
  },
};
const rows = dormantCommercialPool([player]);
const prior = [
  {
    sport: "afl",
    player_id: "preserved-legacy-alias",
    provider: "isolated",
    provider_id: "historical-player",
    rarity: "ICON",
    issued: 1,
    max_serial: 1,
  },
  {
    sport: "afl",
    player_id: "preserved-legacy-alias",
    provider: "isolated",
    provider_id: "historical-player",
    rarity: "RARE",
    issued: 2,
    max_serial: 2,
  },
];
const checks: string[] = [];
async function main() {
  try {
    await sql.unsafe(
      "create role anon; create role authenticated; create role service_role;",
    );
    for (const file of [
      "20261101120754_commercial_google_ledger.sql",
      "20261109231834_commercial_lifetime_supply_guards.sql",
    ])
      await sql.unsafe(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await assert.rejects(
      importDormantCommercialPool(sql, rows, prior),
      /Production import blocked/,
    );
    checks.push(
      "Production-labelled database rejects importer before any definitions",
    );
    await sql`update commercial_billing.control set environment='acceptance' where id`;
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, () =>
        importDormantCommercialPool(sql, rows, prior),
      ),
    );
    assert.equal(
      concurrent.reduce((n, r) => n + r.inserted, 0),
      5,
    );
    assert(
      concurrent.every(
        (r) => r.preservedLifetimeIssuance === 3 && r.issued === 0,
      ),
    );
    checks.push(
      "12 concurrent exact imports create five definitions once and preserve three legacy allocations",
    );
    const replay = await importDormantCommercialPool(
      sql,
      [...rows].reverse(),
      [...prior].reverse(),
    );
    assert.equal(replay.inserted, 0);
    assert.equal(replay.unchanged, 5);
    checks.push(
      "reordered exact retry is a no-op with nonzero lifetime baselines",
    );
    await assert.rejects(
      importDormantCommercialPool(sql, rows, [
        prior[0],
        { ...prior[1], issued: 3, max_serial: 3 },
      ]),
      /differs/,
    );
    await assert.rejects(importDormantCommercialPool(sql, rows), /differs/);
    checks.push(
      "changed or omitted historical counts cannot reset immutable baselines",
    );
    await assert.rejects(
      importDormantCommercialPool(sql, rows, [
        { ...prior[0], player_id: player.id, provider_id: "different-person" },
      ]),
      /contradicts/,
    );
    await assert.rejects(
      importDormantCommercialPool(sql, rows, [
        { ...prior[0], provider_id: "unmapped" },
      ]),
      /Unmatched/,
    );
    checks.push(
      "contradictory provider identities and unmatched historical sources fail closed",
    );
    const [state] =
      await sql`select count(*)::int definitions, sum(issued)::int consumed,
      sum(legacy_issued)::int legacy, count(*) filter(where approved)::int approved,
      (select count(*)::int from commercial_billing.cards) cards,
      (select count(*)::int from commercial_billing.accounts) accounts,
      (select count(*)::int from commercial_billing.receipts) receipts,
      (select count(*)::int from commercial_billing.journals) journals
      from commercial_billing.definitions`;
    assert.deepEqual(state, {
      definitions: 5,
      consumed: 3,
      legacy: 3,
      approved: 0,
      cards: 0,
      accounts: 0,
      receipts: 0,
      journals: 0,
    });
    checks.push(
      "no cards, owners, wallets, receipts, journals or approval created",
    );
    const [gates] =
      await sql`select sales_enabled, issuance_enabled, transfers_enabled from commercial_billing.control where id`;
    assert(Object.values(gates).every((value) => value === false));
    const out = "docs/qa/v31-operational-acceptance-20261110";
    mkdirSync(out, { recursive: true });
    writeFileSync(
      `${out}/lifetime-import-postgres.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          database: "isolated loopback PostgreSQL 17",
          passed: true,
          productionWrites: 0,
          providerCalls: 0,
          checks,
          state,
          gates,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks, state }));
  } finally {
    await sql.end();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
