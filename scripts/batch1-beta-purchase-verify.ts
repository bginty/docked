/** Read-only verification of the founder-performed purchase. Never sends commands. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  validateCredits,
  wallet,
  type CreditsState,
} from "../src/core/credits-sandbox";
import { testReceipt } from "../src/core/member-test-wallet";
import type { EconomyInstance } from "../src/core/card-economy";
import { custodyQuery } from "./lib/reviewed-inventory";
import { priv, root, source, sha } from "./lib/batch1-production-execution.mjs";

const baseline = JSON.parse(
  readFileSync(priv + "/beta-purchase-before.private.json", "utf8"),
);
const before = baseline.document as CreditsState;
const folder = "docs/qa/batch1-beta-acceptance-20261117";
const observation =
  process.argv.find((v) => v.startsWith("--observation="))?.slice(14) ??
  "purchase";
assert(/^[a-z0-9-]{1,40}$/.test(observation));
mkdirSync(folder, { recursive: true });
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const live = await fetch("https://docked.com.au/api/beta-release", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    }).then((r) => {
      assert(r.ok);
      return r.json();
    });
    assert.equal(live.commit, source);
    assert.equal(live.publicRegistration, false);
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const [row] =
          await tx`select document,revision from credits_sandbox.state where id`;
        const s = row.document as CreditsState;
        validateCredits(s);
        assert(s.economy && before.economy);
        const newPacks = Object.values(s.economy.packs).filter(
          (p) => !before.economy!.packs[p.id],
        );
        const ownPacks = newPacks.filter((p) => p.member === baseline.owner);
        const stored =
          await tx`select id,document from credits_sandbox.journal`;
        const journals = new Map(
          stored.map((j) => [j.document.id, j.document]),
        );
        assert.equal(journals.size, s.journal.length);
        for (const journal of s.journal)
          assert.deepEqual(journals.get(journal.id), journal);
        for (const journal of before.journal)
          assert.deepEqual(journals.get(journal.id), journal);
        const observations = [];
        for (const p of ownPacks) {
          const e = s.entitlements[p.id];
          assert(e && e.member === baseline.owner);
          const journal = s.journal.filter((j) => j.id === e.source);
          assert.equal(journal.length, 1);
          const receipt = s.requests[p.member + ":" + p.id]?.result as {
            entitlement: string;
            journal: string;
            price: number;
            cards: number;
          };
          assert(
            receipt &&
              receipt.entitlement === p.id &&
              receipt.journal === e.source,
          );
          assert.equal(receipt.cards, p.cards.length);
          assert.equal(new Set(p.cards).size, p.cards.length);
          const instances = p.cards.map((id) => s.economy!.instances[id]);
          assert.equal(
            new Set(instances.map((i) => i.playerId)).size,
            p.cards.length,
          );
          assert.equal(
            journal[0].lines
              .filter((l) => l.account === "system:pack-revenue")
              .reduce((n, l) => n + l.credits, 0),
            receipt.price,
          );
          assert.equal(
            journal[0].lines
              .filter((l) => l.credits < 0)
              .reduce((n, l) => n - l.credits, 0),
            receipt.price,
          );
          assert.equal(
            journal[0].lines.reduce((n, l) => n + l.credits, 0),
            0,
          );
          const issued =
            await tx`select i.*,d.lifetime_cap,d.issued,d.legacy_issued,d.sport from beta_packs.issued i join commercial_billing.definitions d on d.id=i.definition where i.pack=${p.id}`;
          assert.equal(issued.length, p.cards.length);
          for (const id of p.cards) {
            const instance: EconomyInstance = s.economy!.instances[id];
            const allocated = issued.find((i) => i.card === id);
            assert(
              allocated &&
                allocated.member_id === baseline.owner &&
                allocated.sport === p.product.sport,
            );
            assert.deepEqual(allocated.allocation, instance);
            assert.equal(allocated.serial, instance.serial);
            assert(
              instance.serial > allocated.legacy_issued &&
                instance.serial <= allocated.lifetime_cap &&
                instance.serial <= allocated.issued,
            );
            assert.equal(s.commerce.cards[id].owner, baseline.owner);
            assert.equal(s.cards[id].history[0].to, baseline.owner);
            assert.equal(s.cards[id].history[0].reference, p.id);
            assert.equal(
              Object.values(s.economy!.packs).filter((other) =>
                other.cards.includes(id),
              ).length,
              1,
            );
          }
          const [audit] =
            await tx`select count(*)::int n from beta_packs.events where action='pack-issued' and details->>'pack'=${p.id}`;
          assert.equal(audit.n, 1);
          const saved =
            e.status === "OPENED" ? testReceipt(s, p.id, p.member) : null;
          if (saved)
            assert.deepEqual(
              saved.cards.map((c) => c.id).sort(),
              [...p.cards].sort(),
            );
          observations.push({
            packSha256: sha(JSON.stringify(p.id)),
            product: p.product.name,
            sport: p.product.sport,
            family: p.product.type,
            createdAt: new Date(p.createdAt).toISOString(),
            openedAt: p.openedAt ? new Date(p.openedAt).toISOString() : null,
            cardCount: p.cards.length,
            uniquePlayers: instances.length,
            debit: receipt.price,
            oneJournal: true,
            oneAllocationEvent: true,
            permanentAllocationRows: issued.length,
            serialsAndOwnershipVerified: true,
            cardIdsSha256: sha(JSON.stringify([...p.cards].sort())),
            durableRequestResultPresent: true,
            savedReceiptRecoverable: saved !== null,
            savedReceiptCards: saved?.cards.length ?? 0,
            rarityCounts: Object.fromEntries(
              [...new Set(instances.map((i) => i.rarity))].map((r) => [
                r,
                instances.filter((i) => i.rarity === r).length,
              ]),
            ),
          });
        }
        const [counts] =
          await tx`select (select count(*)::int from commercial_billing.definitions) definitions,(select sum(issued)::int from commercial_billing.definitions) lifetime,(select count(*)::int from beta_packs.issued) beta_allocations,
        (select count(*)::int from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from beta_packs.issued b where b.definition=d.id)+(select count(*) from commercial_billing.cards c where c.definition=d.id)) lifetime_mismatches`;
        assert.equal(counts.lifetime_mismatches, 0);
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        const [commercial] =
          await tx`select sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
        assert(Object.values(commercial).every((v) => v === false));
        const [duplicate] =
          await tx`select count(*)::int n from (select definition,serial,count(*) from (select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards) c group by definition,serial having count(*)>1) d`;
        assert.equal(duplicate.n, 0);
        const allNewJournals = s.journal.filter(
          (j) => !before.journal.some((b) => b.id === j.id),
        );
        for (const [id, instance] of Object.entries(before.economy!.instances))
          assert.deepEqual(s.economy!.instances[id], instance);
        for (const [id, card] of Object.entries(before.commerce.cards))
          assert.deepEqual(s.commerce.cards[id], card);
        for (const [id, history] of Object.entries(before.cards))
          assert.deepEqual(s.cards[id], history);
        const suffix =
          observation === "purchase" ? "20261117" : "20261117-" + observation;
        writeFileSync(
          priv + "/beta-purchase-after-" + suffix + ".private.json",
          JSON.stringify({
            at: new Date().toISOString(),
            revision: row.revision,
            owner: baseline.owner,
            document: s,
          }),
          { flag: "wx", mode: 0o600 },
        );
        return {
          at: new Date().toISOString(),
          observation,
          source,
          deployment: live.deploymentId,
          beforeAt: baseline.at,
          revisionBefore: baseline.revision,
          revisionAfter: row.revision,
          founderWalletBefore: wallet(before, baseline.owner).spendable,
          founderWalletAfter: wallet(s, baseline.owner).spendable,
          newPacksAcrossAllMembers: newPacks.length,
          newFounderPacks: observations,
          newJournalCount: allNewJournals.length,
          previousJournalsPreserved: true,
          previousCardsAndCustodyPreserved: true,
          counts: { ...counts, custody: custody.length },
          commercial,
          duplicateSerials: 0,
          verification:
            "READ ONLY Production transaction; founder reports purchase completed",
          automaticPurchases: 0,
          productionWrites: 0,
          actualClientConfirmationLatencyMs: null,
          physicalAndroidConfirmed: false,
        };
      },
    );
    writeFileSync(
      folder + "/" + observation + "-verification.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    "Purchase verification incomplete; no Production writes or private values emitted.",
  );
  process.exitCode = 1;
});
