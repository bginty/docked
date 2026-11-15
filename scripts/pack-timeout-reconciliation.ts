/** Read-only reconciliation of the founder-reported saved request. Never retries it. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { wallet, validateCredits } from "../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../src/core/member-test-wallet";
async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  const member = "623d1e69-d0f3-493f-9713-108e8c21469a",
    request = "9aa88640-713a-4661-87c0-c7e1036972f3";
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [row] =
          await tx`select revision,document from credits_sandbox.state where id`;
        const s = row.document;
        validateCredits(s);
        const stored = s.requests[`${member}:${request}`];
        assert(stored, "Original request missing");
        const pack = s.economy.packs[request];
        assert(pack && pack.member === member);
        const journals =
          await tx`select id,document from credits_sandbox.journal where id=${request + "_pack"}`;
        assert.equal(journals.length, 1);
        const lines =
          await tx`select credits,account from credits_sandbox.lines where journal=${request + "_pack"}`;
        assert.equal(
          lines.reduce((n, r) => n + Number(r.credits), 0),
          0,
        );
        const allocated =
          await tx`select card::text,serial,definition::text from beta_packs.issued where pack=${request}`;
        const entitlement = s.entitlements[request];
        assert(entitlement && entitlement.member === member);
        const receipt = testReceipt(s, request, member);
        const view = memberTestView(s, member, [], false, Date.now(), [], {
          catalogue: false,
        });
        const cards = allocated.map((r) => ({
          card: r.card,
          serial: r.serial,
          owned: s.commerce.cards[r.card]?.owner === member,
          inCollection: view.cards.some(
            (c) => c.id === r.card && c.owner === member,
          ),
        }));
        assert.equal(cards.length, pack.product.cards);
        assert(cards.every((c) => c.owned && c.inCollection));
        assert(receipt);
        return {
          at: new Date().toISOString(),
          productionWrites: 0,
          request,
          outcome: "committed",
          stateRevision: Number(row.revision),
          product: {
            id: pack.product.id,
            name: pack.product.name,
            sport: pack.product.sport,
            cards: pack.product.cards,
            priceCredits: pack.product.priceCredits,
            configurationHash: pack.configurationHash,
          },
          journals: journals.length,
          journalBalanced: true,
          debit: lines
            .filter((r) => Number(r.credits) < 0)
            .reduce((n, r) => n - Number(r.credits), 0),
          currentWallet: wallet(s, member),
          entitlementStatus: entitlement.status,
          openedAt: pack.openedAt,
          receiptAvailable: true,
          cards,
          storedRequestFingerprintSha256: createHash("sha256")
            .update(stored.fingerprint)
            .digest("hex"),
          replacementIssued: false,
          refundIssued: false,
          physicalAndroidInspection: false,
        };
      },
    );
    const dir = "docs/qa/pack-rounds-autofill-20261115";
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      dir + "/original-purchase-reconciliation.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Reconciliation stopped");
  process.exitCode = 1;
});
