// Explicitly authorised release of one configuration to the existing admitted test beta.
// No member commands, purchases, grants, email, schema or permission changes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { applyPremiumPackTransition } from "../src/server/premium-pack-transition";
import { validateCredits } from "../src/core/credits-sandbox";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet";
import {
  premiumUltraVersion,
  eligibleCatalogue,
} from "../src/core/card-economy";
import { packOdds } from "../src/core/pack-odds";
import { digest } from "../src/core/scoring-engine";

async function main() {
  const mode = process.argv[2];
  assert.ok(["preflight", "review", "apply", "verify"].includes(mode));
  const root = "docs/qa/premium-v3",
    privateRoot = "private-data/premium-v3-release";
  mkdirSync(root, { recursive: true });
  mkdirSync(privateRoot, { recursive: true });
  const sql = ownerDatabase();
  let receipt: any;
  try {
    await sql.begin(
      mode === "preflight" || mode === "verify" ? "read only" : "",
      async (tx) => {
        if (mode === "review" || mode === "apply")
          await tx`select pg_advisory_xact_lock(71820342)`;
        const [row] =
          await tx`select revision,document from credits_sandbox.state where id`;
        const s = row.document;
        validateCredits(s);
        assertMemberTestEconomy(s);
        assert.ok(s.economy?.enabled);
        const e = s.economy;
        assert.ok(e.activeProductVersions);
        const active = e.activeProductVersions.map(
          (id: string) => e.products[id],
        );
        const premium = active.filter((p: any) => p.type === "PREMIUM");
        assert.equal(premium.length, 1);
        const standard = active.filter((p: any) => p.type === "STANDARD");
        assert.equal(standard.length, 1);
        const [admission] =
          await tx`select enabled,testers_enabled from beta_private.admission_control`;
        assert.equal(admission.enabled, true);
        assert.equal(admission.testers_enabled, true);
        for (const product of active) {
          const [registered] =
            await tx`select document from credits_sandbox.pack_configuration where version=${product.version}`;
          assert.deepEqual(registered.document, product);
        }
        receipt = {
          at: new Date().toISOString(),
          mode,
          projectRef,
          passed: true,
          revision: row.revision,
          stateHash: digest(s),
          sourceOfferHash: digest(premium[0]),
          standardHash: digest(standard[0]),
          activeProducts: active.map((p: any) => ({
            id: p.id,
            price: p.priceCredits,
            cards: p.cards,
            weights: p.weights,
            positions: p.positions,
            duplicatePlayers: p.duplicatePlayers,
            guaranteedSlots: p.guaranteedSlots,
            eligiblePlayers: eligibleCatalogue(e, p, Date.now()).length,
          })),
          retainedPacks: Object.keys(e.packs).length,
          retainedUnopenedPacks: Object.values(e.packs).filter(
            (p: any) => p.openedAt === null,
          ).length,
          testOnly: true,
          hostedMemberCommands: 0,
          schemaChanges: 0,
          privilegeChanges: 0,
        };
        if (mode === "verify") {
          assert.equal(premium[0].version, premiumUltraVersion);
          const applied = JSON.parse(
            readFileSync(root + "/configuration-apply.json", "utf8"),
          );
          assert.equal(receipt.standardHash, applied.standardHash);
          receipt.odds = packOdds(premium[0]);
          assert.deepEqual(
            receipt.odds.rows.map((r: any) => r.percent),
            [90, 9.9, 0.1],
          );
        }
        if (mode === "review" || mode === "apply") {
          if (mode === "apply") {
            const reviewed = JSON.parse(
              readFileSync(root + "/configuration-review.json", "utf8"),
            );
            assert.equal(reviewed.passed, true);
            assert.equal(reviewed.sourceOfferHash, receipt.sourceOfferHash);
            assert.equal(reviewed.standardHash, receipt.standardHash);
            const live = JSON.parse(readFileSync(root + "/live.json", "utf8"));
            assert.equal(live.passed, true);
            assert.equal(
              live.commit,
              execFileSync("git", ["rev-parse", "HEAD"], {
                encoding: "utf8",
                windowsHide: true,
              }).trim(),
            );
            const backup = JSON.stringify({
              projectRef,
              revision: row.revision,
              document: s,
            });
            const path = privateRoot + `/before-${row.revision}.json`;
            writeFileSync(path, backup, { flag: "wx", mode: 0o600 });
            assert.equal(readFileSync(path, "utf8"), backup);
            receipt.backup = {
              path,
              hash: digest(backup),
              verified: true,
              scope:
                "Affected aggregate and immutable product/receipt snapshots; not full Auth/storage recovery",
            };
          }
          receipt.transition = await applyPremiumPackTransition(
            async (q, v = []) => ({ rows: await tx.unsafe(q, v as never[]) }),
          );
          if (mode === "review")
            throw Error("EXPECTED_CONFIGURATION_REVIEW_ROLLBACK");
        }
      },
    );
  } catch (e) {
    if (
      mode !== "review" ||
      !(e instanceof Error) ||
      e.message !== "EXPECTED_CONFIGURATION_REVIEW_ROLLBACK"
    )
      throw e;
    receipt.rolledBack = true;
  } finally {
    await sql.end();
  }
  writeFileSync(
    root + `/configuration-${mode}.json`,
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
