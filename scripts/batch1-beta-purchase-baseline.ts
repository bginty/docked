/** Read-only before-image for one founder-confirmed normal beta purchase. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  priv,
  docs,
  save,
  root,
  sha,
  source,
} from "./lib/batch1-production-execution.mjs";
async function main() {
  const file = priv + "/beta-purchase-before.private.json";
  assert(
    !existsSync(file),
    "Existing acceptance baseline must not be replaced",
  );
  const live = await fetch("https://docked.com.au/api/beta-release", {
    cache: "no-store",
  }).then((r) => r.json());
  assert.equal(live.commit, source);
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const before = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [row] =
          await tx`select document,revision from credits_sandbox.state where id`;
        const [owner] =
          await tx`select user_id::text id from credits_sandbox.access where kind='owner' and enabled`;
        const [counts] =
          await tx`select (select count(*) from commercial_billing.definitions)::int definitions,(select sum(issued) from commercial_billing.definitions)::int lifetime,(select count(*) from beta_packs.issued)::int beta_allocations`;
        return {
          at: new Date().toISOString(),
          source,
          owner: owner.id,
          document: row.document,
          revision: row.revision,
          counts,
        };
      },
    );
    save(file, before);
    save(docs + "/beta-purchase-before.json", {
      at: before.at,
      source,
      revision: before.revision,
      counts: before.counts,
      walletDigest: sha(JSON.stringify(before.document)),
      purchasesPerformed: 0,
    });
    console.log(
      JSON.stringify({
        captured: true,
        revision: before.revision,
        counts: before.counts,
        purchasesPerformed: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Baseline capture stopped");
  process.exitCode = 1;
});
