import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import { wallet, type CreditsState } from "../src/core/credits-sandbox";
async function main() {
  const sql = ownerDatabase();
  try {
    const [row] =
      await sql`select revision,document from credits_sandbox.state where id`;
    const s = row.document as CreditsState;
    const protectedMembers = [
      "623d1e69-d0f3-493f-9713-108e8c21469a",
      "ef641248-67be-4c32-9b12-9205bfcee15b",
    ];
    const report = {
      at: new Date().toISOString(),
      revision: row.revision,
      policy: s.policy.version,
      creditOnly: s.creditOnly?.version ?? null,
      journalCount: s.journal.length,
      journalHash: digest(s.journal),
      cards: Object.keys(s.commerce.cards).length,
      deposits: Object.keys(s.deposits).length,
      withdrawals: Object.keys(s.withdrawals).length,
      entitlements: Object.keys(s.entitlements).length,
      sealed: Object.values(s.entitlements).filter((e) => e.status === "SEALED")
        .length,
      legacyEntitlements: Object.keys(s.entitlements).filter(
        (id) => !s.economy?.packs[id],
      ).length,
      products: Object.values(s.economy?.products ?? {}).map((p) => ({
        id: p.id,
        version: p.version,
        price: p.priceCredits,
      })),
      protected: protectedMembers.map((id, i) => ({
        account: i === 0 ? "owner" : "invited-member",
        walletHash: createHash("sha256").update(JSON.stringify(wallet(s, id))).digest("hex"),
        holdingsHash: digest(
          Object.entries(s.commerce.cards).filter(([, c]) => c.owner === id),
        ),
        requestsHash: digest(
          Object.entries(s.requests).filter(([k]) => k.startsWith(id + ":")),
        ),
      })),
      commercialActivation: false,
    };
    mkdirSync("docs/qa/credit-only", { recursive: true });
    const target = process.argv.includes("--after") ? "after" : "before";
    writeFileSync(
      `docs/qa/credit-only/inventory-${target}.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        target,
        revision: row.revision,
        deposits: report.deposits,
        withdrawals: report.withdrawals,
        cards: report.cards,
        entitlements: report.entitlements,
        legacyEntitlements: report.legacyEntitlements,
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
