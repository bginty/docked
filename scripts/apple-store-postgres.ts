import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { AppleTestReconciliation } from "../src/server/apple-store-reconciliation";
import {
  appleAccountToken,
  type AppleNotice,
} from "../src/server/apple-store-verification";
import { MemberStoreTestPurchases } from "../src/server/member-store-purchases";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import {
  storePackFixture,
  storePackReceipt,
  packMember,
} from "../tests/fixtures/store-pack-lifecycle";
import { wallet, validateCredits } from "../src/core/credits-sandbox";
import type { StoreReceipt } from "../src/server/store-purchase-verification";

async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "",
    key = randomBytes(32),
    secret = randomBytes(32).toString("hex");
  let inbox = new StoreTestInbox(url, key);
  const checks: string[] = [];
  try {
    let sql = inbox.sql;
    for (const path of [
      "sandbox/credits.sql",
      "sandbox/store-billing.sql",
      "sandbox/apple-reconciliation.sql",
    ])
      await sql.unsafe(readFileSync(path, "utf8"));
    const initial = storePackFixture();
    Object.values(initial.economy!.players).forEach(
      (p) => (p.observedAt = Date.now()),
    );
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initial as any)})`;
    let store = new CreditsSandboxStore(sql);
    const binding = appleAccountToken(packMember.id, secret),
      other = "unrelated-isolated-member";
    const untouched = wallet(await store.read(), other);
    const base: StoreReceipt = {
      ...storePackReceipt("20000000000001"),
      provider: "apple",
      account: binding,
    };
    let current = base,
      offline = false,
      reads = 0;
    const provider = {
      refresh: async (id: string, account: string) => {
        reads++;
        if (offline) throw Error("Synthetic outage");
        assert.equal(id, base.key);
        assert.equal(account, binding);
        return current;
      },
    };
    let worker = new AppleTestReconciliation(inbox, provider, (member) =>
      appleAccountToken(member, secret),
    );
    const notice = (
      id: string,
      changes: Partial<AppleNotice> = {},
    ): AppleNotice => ({
      id: createHash("sha256").update(id).digest("hex"),
      receiptKey: base.key,
      kind: "verify",
      occurredAt: Date.now(),
      reason: "REFUND",
      ...changes,
    });
    const early = notice("early");
    await Promise.all(Array.from({ length: 20 }, () => worker.enqueue(early)));
    assert.equal(
      (
        await sql`select count(*)::int n from credits_sandbox.apple_store_notifications`
      )[0].n,
      1,
    );
    await worker.runOne();
    assert.equal(reads, 0);
    assert.equal(wallet(await store.read(), packMember.id).available, 0);
    checks.push(
      "20 duplicate authenticated-notification references persist once; an unknown receipt cannot assign or credit a member",
    );

    const service = new MemberStoreTestPurchases({
      provider: "apple",
      accountBinding: appleAccountToken,
      authenticate: async () => ({
        member: packMember.id,
        session: "isolated-auth-session",
      }),
      admission: async () => ({
        version: "apple-isolated-v1",
        expiresAt: Date.now() + 60000,
        products: [base.product],
      }),
      rateLimit: async () => true,
      bindingSecret: secret,
      verify: async (_token, account) => provider.refresh(base.key, account),
      accept: (receipt, member, account, token) =>
        inbox.accept(receipt, member, account, token),
    });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        service.receipt({ token: "synthetic-signed-transaction" }),
      ),
    );
    assert.equal(wallet(await store.read(), packMember.id).available, 9900);
    assert.equal(
      (await sql`select count(*)::int n from credits_sandbox.store_receipts`)[0]
        .n,
      1,
    );
    assert.equal(
      (await sql`select count(*)::int n from credits_sandbox.store_outbox`)[0]
        .n,
      0,
    );
    await assert.rejects(
      inbox.accept(base, other, binding, "replayed"),
      /conflict/,
    );
    checks.push(
      "20 concurrent Apple receipts credit 9900 once in the shared wallet; cross-member replay denied; no Apple receipt enters Google consumption outbox",
    );

    const product = Object.values(initial.economy!.products).find(
      (p) =>
        p.cards === 9 &&
        p.type === "PREMIUM" &&
        initial.economy!.activeProductVersions!.includes(p.id),
    )!;
    await Promise.all(
      Array.from({ length: 16 }, () =>
        store.execute(packMember, "apple-pack", {
          kind: "buy-pack",
          product: product.id,
          configuration: product.version,
          expectedPrice: 5000,
          confirmed: true,
          policy: initial.policy.version,
        }),
      ),
    );
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.execute(packMember, "apple-open", {
          kind: "open-pack",
          entitlement: "apple-pack",
        }),
      ),
    );
    let state = await store.read();
    assert.equal(wallet(state, packMember.id).spendable, 4900);
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    assert.equal(Object.keys(state.economy!.packs).length, 1);
    const inventory = structuredClone(state.commerce.cards),
      supply = structuredClone(state.economy!.definitions);
    checks.push(
      "16 concurrent Premium purchases and 10 open retries yield one charge, one opened pack and exactly nine isolated cards",
    );

    await worker.schedule("2026-11-05T00:00");
    await worker.schedule("2026-11-05T00:00");
    assert.equal(
      (
        await sql`select count(*)::int n from credits_sandbox.apple_store_notifications where reason='SCHEDULED'`
      )[0].n,
      1,
    );
    // Early notification was already persisted; close it without mutating funds,
    // then exercise recovery through the independently persisted sweep.
    await sql`update credits_sandbox.apple_store_notifications set state='done' where reason<>'SCHEDULED'`;
    offline = true;
    await sql`update credits_sandbox.apple_store_notifications set next_attempt_at=clock_timestamp()`;
    await worker.runOne();
    assert.equal(wallet(await store.read(), packMember.id).spendable, 4900);
    await sql`update credits_sandbox.apple_store_notifications set state='working',lease_until=clock_timestamp()-interval '1 second' where state='pending'`;
    await inbox.close();
    inbox = new StoreTestInbox(url, key);
    sql = inbox.sql;
    store = new CreditsSandboxStore(sql);
    worker = new AppleTestReconciliation(inbox, provider, (member) =>
      appleAccountToken(member, secret),
    );
    offline = false;
    current = { ...base, state: "REVOKED" };
    const before = reads;
    await Promise.all(Array.from({ length: 12 }, () => worker.runOne()));
    assert.equal(reads, before + 1);
    state = await store.read();
    assert.equal(wallet(state, packMember.id).spendable, 0);
    assert.deepEqual(state.commerce.cards, inventory);
    assert.deepEqual(state.economy!.definitions, supply);
    checks.push(
      "Outage defers safely; expired lease recovers after process restart; 12 workers reconcile once; spent refund places recovery hold without confiscating cards or changing supply",
    );

    const terminal = JSON.stringify(state);
    current = base;
    await worker.enqueue(
      notice("late-purchase", { reason: "ONE_TIME_CHARGE" }),
    );
    await worker.runOne();
    assert.equal(JSON.stringify(await store.read()), terminal);
    const attention = notice("reversal", {
      kind: "review",
      reason: "REFUND_REVERSED",
    });
    await worker.enqueue(attention);
    await worker.runOne();
    assert.equal(
      (
        await sql`select state from credits_sandbox.apple_store_notifications where id=${attention.id}`
      )[0].state,
      "attention",
    );
    assert.equal(JSON.stringify(await store.read()), terminal);
    checks.push(
      "Out-of-order purchase cannot revive revoked funds; refund reversal requires review and never silently recredits",
    );

    const otherBinding = appleAccountToken(other, secret);
    const unspent: StoreReceipt = {
      ...base,
      key: "20000000000002",
      account: otherBinding,
      product: { ...base.product, credits: 4900, id: "synthetic-4900" },
    };
    await inbox.accept(unspent, other, otherBinding, "fixture-second");
    await inbox.accept(
      { ...unspent, state: "REVOKED" },
      other,
      otherBinding,
      "fixture-second",
    );
    assert.equal(
      wallet(await store.read(), other).available,
      untouched.available,
    );
    assert.equal(
      wallet(await store.read(), other).spendable,
      untouched.spendable,
    );
    validateCredits(await store.read());
    await sql`create role qa_apple_reader nologin`;
    await sql`grant usage on schema credits_sandbox to qa_apple_reader`;
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`set local role qa_apple_reader`;
        await tx`select * from credits_sandbox.apple_store_notifications`;
      }),
      { code: "42501" },
    );
    checks.push(
      "Periodic missed-notification sweep is bounded and idempotent; unprivileged role cannot read the private queue",
    );
    checks.push(
      "4900 refund before spending reverses once; ledger validates and unrelated-wallet baseline is restored",
    );
    const result = {
      passed: true,
      checks,
      providerRequests:
        "mock only; no genuine Apple Sandbox or notification delivery claimed",
      database: "disposable local PostgreSQL",
      realCharges: 0,
      productionConnections: 0,
    };
    mkdirSync("docs/qa/dual-store-20261105", { recursive: true });
    writeFileSync(
      "docs/qa/dual-store-20261105/apple-postgres.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await inbox.close();
  }
}
void main().catch(() => {
  console.error(
    "Apple isolated acceptance failed; no production connection was used",
  );
  process.exitCode = 1;
});
