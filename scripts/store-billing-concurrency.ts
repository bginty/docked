import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { creditsFixture, alice, bob } from "./credits-fixture";
import { newCreditOnly } from "../src/core/credit-only";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet, validateCredits } from "../src/core/credits-sandbox";
import type { StoreReceipt } from "../src/server/store-purchase-verification";

async function main() {
  const inbox = new StoreTestInbox(
    process.env.FANTASY_TEST_DATABASE_URL ?? "",
    randomBytes(32),
  );
  const sql = inbox.sql,
    checks: string[] = [];
  try {
    await sql.unsafe(readFileSync("sandbox/credits.sql", "utf8"));
    await sql.unsafe(readFileSync("sandbox/store-billing.sql", "utf8"));
    const initial = creditsFixture();
    initial.creditOnly = newCreditOnly();
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initial as any)})`;
    const store = new CreditsSandboxStore(sql);
    const base: StoreReceipt = {
      provider: "google",
      key: "isolated-receipt",
      account: "synthetic-binding",
      environment: "test",
      state: "PURCHASED",
      product: {
        id: "fixture-only-not-a-store-sku",
        sport: "afl",
        credits: 100,
        version: "fixture",
      },
    };
    const apply = (receipt: StoreReceipt, member = alice.id) =>
      inbox.accept(receipt, member, base.account, "synthetic-private-token");
    await Promise.all(Array.from({ length: 20 }, () => apply(base)));
    const state = await store.read();
    validateCredits(state);
    assert.equal(wallet(state, alice.id).available, 100);
    assert.equal(
      (await sql`select * from credits_sandbox.store_outbox`).length,
      1,
    );
    assert.notEqual(
      (
        await sql`select encrypted_reference from credits_sandbox.store_receipts`
      )[0].encrypted_reference,
      "synthetic-private-token",
    );
    await assert.rejects(apply(base, bob.id), /conflict/);
    checks.push(
      "20 concurrent verified receipts credit the existing wallet once; cross-account replay denied; private reference encrypted",
    );
    await assert.rejects(
      inbox.deliverOne(async () => {
        throw Error("mock provider outage");
      }),
      /retry pending/,
    );
    assert.equal(wallet(await store.read(), alice.id).available, 100);
    let deliveries = 0;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        inbox.deliverOne(async (_provider, token, product) => {
          assert.equal(token, "synthetic-private-token");
          assert.equal(product, base.product.id);
          deliveries++;
        }),
      ),
    );
    assert.equal(deliveries, 1);
    checks.push(
      "Provider failure preserves committed credits; 12 acknowledgement workers deliver once after retry",
    );
    await Promise.all(
      Array.from({ length: 12 }, () => apply({ ...base, state: "REVOKED" })),
    );
    assert.equal(wallet(await store.read(), alice.id).available, 0);
    await apply(base);
    assert.equal(wallet(await store.read(), alice.id).available, 0);
    const early = {
      ...base,
      key: "refund-before-purchase",
      state: "REVOKED" as const,
    };
    await apply(early);
    await apply({ ...early, state: "PURCHASED" });
    assert.equal(wallet(await store.read(), alice.id).available, 0);
    checks.push(
      "Concurrent refunds reverse once; stale and out-of-order purchases cannot resurrect a refunded receipt",
    );
    const pending = { ...base, key: "pending", state: "PENDING" as const };
    await apply(pending);
    assert.equal(wallet(await store.read(), alice.id).available, 0);
    await sql.unsafe(
      "create function credits_sandbox.fail_outbox() returns trigger language plpgsql as $$begin raise exception 'isolated failure';end$$; create trigger isolated_failure before insert on credits_sandbox.store_outbox for each row execute function credits_sandbox.fail_outbox()",
    );
    await assert.rejects(
      apply({ ...pending, state: "PURCHASED" }),
      /isolated failure/,
    );
    assert.equal(wallet(await store.read(), alice.id).available, 0);
    assert.equal(
      (
        await sql`select status from credits_sandbox.store_receipts where receipt_key='pending'`
      )[0].status,
      "PENDING",
    );
    await sql.unsafe(
      "drop trigger isolated_failure on credits_sandbox.store_outbox",
    );
    await apply({ ...pending, state: "PURCHASED" });
    assert.equal(wallet(await store.read(), alice.id).available, 100);
    checks.push(
      "Pending receipts grant nothing; injected outbox failure rolls back wallet and inbox together; retry succeeds once",
    );
    const evidence = {
      passed: true,
      checks,
      productionConnections: 0,
      providerNetworkRequests: 0,
      realPurchases: 0,
    };
    writeFileSync(
      "docs/qa/store-release-20261031/store-postgres.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await inbox.close();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Store fixture failed",
  );
  process.exitCode = 1;
});
