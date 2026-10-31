/** Explicit isolated acceptance: repeat terminal refunds; reject spending held funds. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { hostedGoogleCall } from "./hosted-google-client";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  assert.equal(process.env.DOCKED_HOSTED_MEMBER_ACCEPTANCE, "true");
  const config = JSON.parse(
    readFileSync(
      join(
        process.env.USERPROFILE!,
        ".docked-secrets/hosted-member-acceptance.json",
      ),
      "utf8",
    ),
  );
  const url = new URL(config.database);
  assert.equal(
    decodeURIComponent(url.username),
    "docked_billing_test.pojoymtniryarxxunyvz",
  );
  assert.equal(config.member, "synthetic-store-member-20261101");
  const sql = postgres(url.href, {
    ssl: { ca: config.databaseCa, rejectUnauthorized: true },
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
  try {
    const read = async () =>
      (
        await sql`select revision,md5(document::text) hash,document from store_member_acceptance.state where id`
      )[0];
    const before = await read();
    const receipts =
      await sql`select receipt_key,status from store_member_acceptance.store_receipts`;
    assert.equal(receipts.length, 2);
    assert(receipts.every((r) => r.status === "CANCELLED"));
    for (const r of receipts)
      await hostedGoogleCall({ operation: "refund", key: r.receipt_key });
    const state = before.document as CreditsState;
    const product = Object.values(state.economy!.products).find(
      (p) => p.sport === "nfl" && p.type === "STANDARD" && p.cards === 1,
    )!;
    assert(product);
    await assert.rejects(
      hostedGoogleCall({
        operation: "pack",
        request: "refund-hold-spend-rejection",
        command: {
          kind: "buy-pack",
          product: product.id,
          configuration: product.version,
          expectedPrice: product.priceCredits,
          confirmed: true,
          policy: state.policy.version,
        },
      }),
    );
    const after = await read();
    assert.equal(after.revision, before.revision);
    assert.equal(after.hash, before.hash);
    const status = await hostedGoogleCall({ operation: "status" });
    assert.equal(status.spendable, 0);
    assert.equal(status.balance, 3500);
    assert.equal(status.collection.length, 27);
    assert.equal(status.packs.length, 3);
    const [{ count: unsettled }] =
      await sql`select count(*)::int count from store_member_acceptance.store_outbox where state in ('pending','working')`;
    assert.equal(unsettled, 0);
    const evidence = {
      at: new Date().toISOString(),
      refundRetries: 2,
      heldFundsPurchaseDenied: true,
      before: { revision: before.revision, hash: before.hash },
      after: { revision: after.revision, hash: after.hash },
      balance: status.balance,
      spendable: status.spendable,
      cards: status.collection.length,
      packs: status.packs.length,
      unsettled,
      customerWrites: 0,
    };
    writeFileSync(
      "docs/qa/hosted-member-20261101/final-refund-audit.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "Final isolated refund acceptance not confirmed; references redacted",
  );
  process.exitCode = 1;
});
