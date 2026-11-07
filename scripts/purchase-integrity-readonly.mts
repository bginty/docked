import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  validateCredits,
  wallet,
  type CreditsState,
} from "../src/core/credits-sandbox.ts";
import { validateRedemption } from "../src/core/redemption.ts";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet.ts";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
try {
  const result = await sql.begin(
    "isolation level repeatable read",
    async (tx) => {
      const [row] =
        await tx`select revision,document from credits_sandbox.state where id`;
      const s = row.document as CreditsState;
      validateCredits(s);
      validateRedemption(s);
      assertMemberTestEconomy(s);
      const journals = await tx`select document from credits_sandbox.journal`;
      const stored = new Map(journals.map((j) => [j.document.id, j.document]));
      for (const j of s.journal) assert.deepEqual(stored.get(j.id), j);
      assert.equal(stored.size, s.journal.length);
      const packCards = new Set<string>();
      for (const p of Object.values(s.economy!.packs)) {
        const entitlement = s.entitlements[p.id];
        assert.equal(entitlement.member, p.member);
        const journal = stored.get(entitlement.source);
        assert(journal);
        const request = s.requests[p.member + ":" + p.id];
        assert(request);
        const receipt = request.result as {
          entitlement: string;
          journal: string;
          price: number;
        };
        assert.equal(receipt.entitlement, p.id);
        assert.equal(receipt.journal, journal.id);
        assert.equal(
          journal.lines
            .filter(
              (l: { account: string }) => l.account === "system:pack-revenue",
            )
            .reduce((n: number, l: { credits: number }) => n + l.credits, 0),
          receipt.price,
        );
        for (const id of p.cards) {
          assert(!packCards.has(id));
          packCards.add(id);
        }
      }
      const access =
        await tx`select user_id::text id,kind,label,enabled,beta_private.admitted(user_id) admitted from credits_sandbox.access`;
      for (const a of access) assert(wallet(s, a.id).spendable >= 0);
      const barry = access.filter((a) => /barry/i.test(a.label));
      return {
        at: new Date().toISOString(),
        revision: Number(row.revision),
        validationPassed: true,
        journals: s.journal.length,
        packReceipts: Object.keys(s.economy!.packs).length,
        uniquePackCards: packCards.size,
        duplicatePackAllocations: 0,
        unmatchedPurchaseReceipts: 0,
        negativeSpendableBalances: 0,
        barry: {
          matchingAccounts: barry.length,
          admitted: barry.length === 1 && barry[0].enabled && barry[0].admitted,
        },
        writes: 0,
      };
    },
  );
  await mkdir("docs/qa/purchase-performance-20261107", { recursive: true });
  const stage = process.argv.includes("--after") ? "after" : "before";
  await writeFile(
    `docs/qa/purchase-performance-20261107/integrity-${stage}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await sql.end();
}
