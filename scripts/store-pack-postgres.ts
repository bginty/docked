import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { StoreTestReconciliation } from "../src/server/store-reconciliation";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { MemberStoreTestPurchases } from "../src/server/member-store-purchases";
import { storeAccountId } from "../src/server/store-purchase-verification";
import {
  storePackFixture,
  storePackReceipt,
  packMember,
  packNow,
} from "../tests/fixtures/store-pack-lifecycle";
import { wallet, validateCredits } from "../src/core/credits-sandbox";

async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "",
    key = randomBytes(32);
  let inbox = new StoreTestInbox(url, key);
  const checks: string[] = [];
  try {
    let sql = inbox.sql;
    for (const path of [
      "sandbox/credits.sql",
      "sandbox/store-billing.sql",
      "sandbox/store-reconciliation.sql",
    ])
      await sql.unsafe(readFileSync(path, "utf8"));
    const initial = storePackFixture();
    // Current local-fixture observations only; never touch provider/player records.
    Object.values(initial.economy!.players).forEach(
      (p) => (p.observedAt = Date.now()),
    );
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initial as any)})`;
    let store = new CreditsSandboxStore(sql);
    const token = "synthetic-token-only",
      receipt = storePackReceipt(
        createHash("sha256")
          .update("docked.fantasy\0" + token)
          .digest("hex"),
      );
    const bindingSecret = randomBytes(32).toString("hex");
    receipt.account = storeAccountId(packMember.id, bindingSecret);
    let current = receipt,
      verifications = 0,
      consumed = false,
      offline = false;
    const provider = {
      verify: async (t: string, account: string) => {
        verifications++;
        if (offline) throw Error("synthetic network failure");
        assert.equal(t, token);
        assert.equal(account, receipt.account);
        return current;
      },
      consume: async (t: string, _product: string, account: string) => {
        assert.equal(t, token);
        assert.equal(account, receipt.account);
        consumed = true;
      },
    };
    let worker = new StoreTestReconciliation(
      inbox,
      provider,
      () => receipt.account,
    );
    const notice = {
      id: "early-signed-refresh",
      receiptKey: receipt.key,
      kind: "purchase" as const,
      occurredAt: packNow,
    };
    await Promise.all(Array.from({ length: 20 }, () => worker.enqueue(notice)));
    assert.equal(
      (await sql`select * from credits_sandbox.store_notifications`).length,
      1,
    );
    assert.equal(await worker.runOne(), false);
    assert.equal(verifications, 0);
    assert.equal(wallet(await store.read(), packMember.id).available, 0);
    checks.push(
      "20 duplicate early notifications retained once; unknown member binding cannot credit a wallet",
    );
    const memberService = new MemberStoreTestPurchases({
      authenticate: async () => ({
        member: packMember.id,
        session: "isolated-session",
      }),
      admission: async () => ({
        version: "isolated-member-v1",
        expiresAt: Date.now() + 60000,
        products: [receipt.product],
      }),
      rateLimit: async () => true,
      bindingSecret,
      verify: provider.verify,
      accept: (...args) => inbox.accept(...args),
    });
    assert.equal(
      (await memberService.session()).accountBinding,
      receipt.account,
    );
    current = { ...receipt, state: "PENDING" };
    assert.equal((await memberService.receipt({ token })).state, "PENDING");
    assert.equal(wallet(await store.read(), packMember.id).available, 0);
    current = receipt;
    await sql`update credits_sandbox.store_notifications set next_attempt_at=clock_timestamp()`;
    await Promise.all(Array.from({ length: 12 }, () => worker.runOne()));
    assert.equal(verifications, 2);
    assert.equal(wallet(await store.read(), packMember.id).spendable, 9900);
    await worker.consumeOne();
    assert.equal(consumed, true);
    checks.push(
      "12 reconciliation workers verify once; approved pending payment credits 9900 and consumption follows durable commit",
    );
    const product = Object.values(initial.economy!.products).find(
      (p) =>
        p.cards === 9 &&
        p.type === "PREMIUM" &&
        initial.economy!.activeProductVersions!.includes(p.id),
    )!;
    const command = {
      kind: "buy-pack",
      product: product.id,
      configuration: product.version,
      expectedPrice: 5000,
      confirmed: true,
      policy: initial.policy.version,
    };
    await Promise.all(
      Array.from({ length: 16 }, () =>
        store.execute(packMember, "same-pack", command),
      ),
    );
    let state = await store.read();
    assert.equal(wallet(state, packMember.id).spendable, 4900);
    assert.equal(Object.keys(state.economy!.packs).length, 1);
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.execute(packMember, "same-open", {
          kind: "open-pack",
          entitlement: "same-pack",
        }),
      ),
    );
    state = await store.read();
    assert.equal(state.entitlements["same-pack"].status, "OPENED");
    const inventory = structuredClone(state.commerce.cards),
      supply = structuredClone(state.economy!.definitions);
    checks.push(
      "16 concurrent Premium purchases charge 5000 once; 10 opening retries retain exactly nine instances and one receipt",
    );
    await worker.schedule("2026-10-31T12:00");
    await worker.schedule("2026-10-31T12:00");
    assert.equal(
      (
        await sql`select * from credits_sandbox.store_notifications where kind='scheduled'`
      ).length,
      1,
    );
    offline = true;
    assert.equal(await worker.runOne(), false);
    assert.equal(wallet(await store.read(), packMember.id).available, 4900);
    current = { ...receipt, state: "REVOKED" };
    offline = false;
    // Simulate a dead worker and reconstruct all service objects from persisted state.
    await sql`update credits_sandbox.store_notifications set state='working',lease_until=clock_timestamp()-interval '1 second' where kind='scheduled'`;
    await inbox.close();
    inbox = new StoreTestInbox(url, key);
    sql = inbox.sql;
    store = new CreditsSandboxStore(sql);
    worker = new StoreTestReconciliation(
      inbox,
      provider,
      () => receipt.account,
    );
    await Promise.all(Array.from({ length: 12 }, () => worker.runOne()));
    state = await store.read();
    assert.equal(wallet(state, packMember.id).available, 4900);
    assert.equal(wallet(state, packMember.id).spendable, 0);
    assert.deepEqual(state.commerce.cards, inventory);
    assert.deepEqual(state.economy!.definitions, supply);
    const journals = state.journal.length;
    await inbox.accept(receipt, packMember.id, receipt.account, token);
    assert.equal((await store.read()).journal.length, journals);
    validateCredits(await store.read());
    checks.push(
      "Durable checkpoint deduplicates; network outage preserves state; expired worker lease recovers after restart; spent refund holds remaining funding without debt, confiscation or duplicate reversal",
    );
    mkdirSync("docs/qa/public-launch-final", { recursive: true });
    const result = {
      passed: true,
      checks,
      realCharges: 0,
      customerConnections: 0,
      providerRequests: "mock only",
      scope:
        "same wallet, pack allocator and receipt services in disposable PostgreSQL",
    };
    writeFileSync(
      "docs/qa/public-launch-final/store-pack-postgres.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await inbox.close();
  }
}
void main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Store lifecycle failed");
  process.exitCode = 1;
});
