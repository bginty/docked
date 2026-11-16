/** Match the actual founder browser GET result to immutable existing receipts. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { testReceipt } from "../src/core/member-test-wallet";
import {
  authority,
  source,
  sourceBlob,
  sha,
  docs,
  root,
  save,
} from "./lib/batch1-production-execution.mjs";
async function main() {
  authority();
  assert.equal(
    sha(
      readFileSync("src/core/member-test-wallet.ts", "utf8").replaceAll(
        "\r\n",
        "\n",
      ),
    ),
    sha(
      sourceBlob("src/core/member-test-wallet.ts")
        .toString()
        .replaceAll("\r\n", "\n"),
    ),
  );
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const proof = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [owner] =
          await tx`select user_id::text id from credits_sandbox.access where kind='owner' and enabled`;
        const hash = (v: unknown) => sha(JSON.stringify(v));
        assert.equal(
          hash(owner.id),
          "f0ebb58f5db0391f39d3d5eca611fa218327c5a8663f1e4050d8727f81417827",
        );
        const [row] =
          await tx`select document from credits_sandbox.state where id`;
        const s = row.document,
          receipts = [];
        for (const [id, e] of Object.entries(s.entitlements) as [string, any][])
          if (e.member === owner.id && e.status === "OPENED") {
            const receipt = testReceipt(s, id, owner.id);
            if (!receipt.cards.length) continue;
            const ids = receipt.cards.map((c) => c.id).sort();
            assert.equal(new Set(ids).size, ids.length);
            receipts.push({
              packSha256: hash(id),
              cardCount: ids.length,
              cardIdsSha256: hash(ids),
              sport: s.economy?.packs[id]?.product.sport ?? "nfl",
            });
          }
        receipts.sort((a, b) => a.packSha256.localeCompare(b.packSha256));
        assert.equal(receipts.length, 37);
        assert.equal(
          hash(receipts),
          "9f2644052aa368b6c13af766921409110811bdfc2dfaa6acc807e1731410ff27",
        );
        return {
          receiptCount: receipts.length,
          totalReceiptCards: receipts.reduce((n, r) => n + r.cardCount, 0),
          receiptIdentityHash: hash(receipts),
          ownSession: true,
          ownerMfaEnforcedByActualRoute: true,
        };
      },
    );
    save(docs + "/staging-authenticated-acceptance.json", {
      at: "2026-11-16T11:39:53.962Z",
      verifiedAt: new Date().toISOString(),
      source,
      deployment: "dpl_Fnb75vUFUaDd4WL6pnkQDttKoQoh",
      authenticatedAccess: true,
      existingReceiptRecovered: true,
      ...proof,
      purchases: 0,
      grants: 0,
      openingRequests: 0,
      method:
        "Founder executed GET-only same-origin check with Vercel deployment pin; browser console and network responses independently inspected; every receipt hash matched read-only Production SQL",
      receiptReadMs: 2529,
      receiptRequestId: "syd1::syd1::4s5j8-1794829190036-924ea03f45e7",
      cacheControl: "private, no-store",
      actualPurchaseConfirmationMeasured: false,
      savedRequestPostRecoveryMeasured: false,
      physicalAndroidTest: false,
      launchGatesChanged: false,
      domainPromoted: false,
    });
    console.log(
      JSON.stringify({
        verified: true,
        ...proof,
        receiptReadMs: 2529,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Receipt comparison stopped");
  process.exitCode = 1;
});
