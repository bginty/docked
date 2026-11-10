/** Read-only, scoped receipt -> ledger -> credit provenance trace. No balances. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
const dir = "private-data/v31-final-reconciliation-20261110";
const out = "docs/qa/v31-final-reconciliation-20261110";
const exceptions = JSON.parse(
  readFileSync(dir + "/per-card-exceptions.private.json", "utf8"),
);
assert.equal(process.argv[2], "--production-read-only");
assert.equal(exceptions.length, 86);
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [row] =
          await tx`select revision,document from credits_sandbox.state where id`;
        const s = row.document;
        const records = exceptions.map((c: any) => {
          const card =
            s.economy.instances[c.immutableCardId] ??
            s.economy.retiredTestInstances[c.immutableCardId];
          assert(
            card && card.source === c.sourcePack && card.serial === c.serial,
          );
          const e = s.entitlements[card.source];
          assert(e && e.member === c.originalRecipient);
          const journal = s.journal.find((j: any) => j.id === e.source);
          assert(journal, "Pack ledger source missing");
          assert.equal(
            journal.lines.reduce((sum: number, l: any) => sum + l.credits, 0),
            0,
          );
          const charged = journal.lines.filter((l: any) => l.credits < 0);
          const funding = charged.map((line: any) => {
            const match = /^lot:(.*):(available|pending|reserved)$/.exec(
              line.account,
            );
            assert(
              match,
              "Unexpected funding account requires manual investigation",
            );
            const chain: any[] = [];
            const seen = new Set();
            let lot = s.lots[match[1]];
            assert(lot, "Funding lot missing");
            while (lot) {
              assert(!seen.has(lot.id), "Lot ancestry cycle");
              seen.add(lot.id);
              chain.push(lot);
              if (!lot.parentLot) break;
              lot = s.lots[lot.parentLot];
              assert(lot, "Parent funding lot missing");
            }
            const origin = chain.at(-1);
            const deposits = Object.entries(s.deposits).filter(
              ([id, d]: [string, any]) =>
                id === origin.provenance || chain.some((l) => l.id === d.lot),
            );
            const refundCases = Object.entries(s.cases).filter(
              ([, r]: [string, any]) =>
                deposits.some(([id]) => id === r.reference),
            );
            const googleTest = deposits.some(
              ([id]) => s.storeTestDeposits?.[id]?.environment === "test",
            );
            return {
              category: origin.category,
              fundingLotSha256: hash(match[1]),
              provenanceSha256: hash(origin.provenance),
              ancestryDepth: chain.length,
              inheritedFromTransfer: chain.length > 1,
              depositRecords: deposits.length,
              googleTest,
              refundedFunding: deposits.some(
                ([, d]: [string, any]) => d.refunded > 0,
              ),
              recoveryCases: refundCases.length,
              openRecoveryCases: refundCases.filter(
                ([, r]: [string, any]) => r.status === "OPEN",
              ).length,
            };
          });
          const coupon = s.packCoupons?.redemptions?.[card.source];
          assert(
            charged.length || coupon?.charge === 0,
            "Unfunded pack requires investigation",
          );
          return {
            immutableCardId: c.immutableCardId,
            originalPackSha256: hash(card.source),
            journalSha256: hash(journal.id),
            originalReceiptMatched: true,
            balancedPackJournal: true,
            entitlementStatus: e.status,
            couponApplied: !!coupon,
            funding,
            supplyDisposition:
              "Issued serial remains consumed regardless of refund, credit grant, transfer or retirement",
          };
        });
        return {
          at: new Date().toISOString(),
          readOnly: true,
          sourceRevision: row.revision,
          productionWrites: 0,
          records,
        };
      },
    );
    writeFileSync(
      out + "/exception-funding-trace.json",
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    const summary = {
      cards: result.records.length,
      balancedPackJournals: result.records.filter(
        (r: any) => r.balancedPackJournal,
      ).length,
      cardsWithRefundedFunding: result.records.filter((r: any) =>
        r.funding.some((f: any) => f.refundedFunding),
      ).length,
      cardsWithGoogleTestFunding: result.records.filter((r: any) =>
        r.funding.some((f: any) => f.googleTest),
      ).length,
      fundingCategories: [
        ...new Set(
          result.records.flatMap((r: any) =>
            r.funding.map((f: any) => f.category),
          ),
        ),
      ],
      productionWrites: 0,
    };
    writeFileSync(
      out + "/funding-summary.json",
      JSON.stringify(summary, null, 2) + "\n",
    );
    console.log(JSON.stringify(summary));
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "Funding trace failed closed. No hosted mutation or raw diagnostic printed.",
  );
  process.exitCode = 1;
});
