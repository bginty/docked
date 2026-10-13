// Additive aggregate migration. No grant, ownership, journal or balance edit.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { digest } from "../src/core/scoring-engine";
import { type CreditsState } from "../src/core/credits-sandbox";
const preserved = (s: CreditsState) =>
  digest({
    journal: s.journal,
    lots: s.lots,
    commerce: s.commerce,
    economy: s.economy,
    entitlements: s.entitlements,
    swaps: s.swaps,
    listings: s.listings,
    withdrawals: s.withdrawals,
    deposits: s.deposits,
  });
async function main() {
  assert.ok(
    process.argv.includes("--apply"),
    "Explicit additive migration flag required",
  );
  const sql = ownerDatabase();
  try {
    const store = new CreditsSandboxStore(sql, async (_tx, s) => {
      assert.equal(s.policy.liveEnabled, false);
      assert.equal(s.policy.purchasedWithdrawable, false);
      assert.equal(Object.keys(s.deposits).length, 0);
      assert.equal(Object.keys(s.withdrawals).length, 0);
    });
    const before = await store.read();
    await store.execute(
      { id: "credit-only-reviewed-migration", role: "reviewer", aal: "aal2" },
      "credit-only-policy-20261013-v1",
      {
        kind: "credit-only-policy",
        reason:
          "Owner requested credit-only test policy; preserve every existing grant, entitlement and transaction",
      },
    );
    const after = await store.read();
    assert.equal(preserved(after), preserved(before));
    const report = {
      at: new Date().toISOString(),
      passed: true,
      migration: "credit-only-policy-20261013-v1",
      storage:
        "Existing private aggregate and append-only history; no SQL schema change",
      beforeHash: preserved(before),
      afterHash: preserved(after),
      version: after.creditOnly?.version,
      windows: after.creditOnly?.windows.length,
      noBalanceOrOwnershipMutation: true,
    };
    writeFileSync(
      "docs/qa/credit-only/migration.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
