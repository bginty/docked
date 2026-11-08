import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import {
  PurchaseTiming,
  timePurchase,
  withPurchaseTiming,
} from "../src/server/purchase-timing";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { GoogleCommercialVerifier } from "../src/server/google-commercial-verifier";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
} from "../src/core/commercial-billing";
import { rarityRule } from "../src/core/card-rarity";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
import { memberTestView, testReceipt } from "../src/core/member-test-wallet";
import { wallet } from "../src/core/credits-sandbox";
import { packFixture, packMember } from "../tests/fixtures/pack-economy";
const url = new URL(process.env.PURCHASE_TIMING_DB ?? "");
if (url.hostname !== "127.0.0.1" || url.pathname !== "/docked_purchase_timing")
  throw Error("Disposable loopback purchase benchmark database required");
const sql = postgres(url.toString(), { max: 16, onnotice: () => {} });
const samples = 20,
  warmup = 2;
type Row = Record<string, number>;
const aggregate = (rows: Row[]) =>
  Object.fromEntries(
    [...new Set(rows.flatMap(Object.keys))].map((key) => {
      const values = rows
        .flatMap((row) => (key in row ? [row[key]] : []))
        .sort((a, b) => a - b);
      return [
        key,
        {
          samples: values.length,
          p50Ms: values[Math.ceil(values.length * 0.5) - 1],
          p95Ms: values[Math.ceil(values.length * 0.95) - 1],
          maxMs: values.at(-1),
        },
      ];
    }),
  );
const measured = async <T>(operation: () => Promise<T>) => {
  const timing = new PurchaseTiming();
  const value = await withPurchaseTiming(timing, operation);
  return { value, timing: timing.snapshot() };
};
const checks: string[] = [];
async function internal(Store: typeof CreditsSandboxStore) {
  // Only this newly-created, loopback fixture database can reach this statement.
  await sql.unsafe("drop schema if exists credits_sandbox cascade");
  await sql.unsafe(readFileSync("sandbox/credits.sql", "utf8"));
  const state = packFixture(),
    now = Date.now();
  for (const player of Object.values(state.economy!.players))
    player.observedAt = now;
  paidPackCatalogueUpgrade(state.economy!, now);
  const product = memberTestView(
    state,
    packMember.id,
    [],
    false,
    now,
  ).products.find((p) => p.tier === "STANDARD" && p.cards === 9)!;
  assert.ok(product);
  await sql`insert into credits_sandbox.state values(true,0,${sql.json(state as never)})`;
  const store = new Store(sql),
    buy: Row[] = [],
    open: Row[] = [],
    view: Row[] = [];
  const command = {
    kind: "buy-pack",
    product: product.id,
    configuration: product.version,
    expectedPrice: product.price,
    confirmed: true,
    policy: state.policy.version,
  };
  for (let i = 0; i < samples + warmup; i++) {
    const request = `isolated-pack-${i}`;
    const a = await measured(() => store.execute(packMember, request, command));
    const b = await measured(() =>
      store.execute(packMember, `open-${i}`, {
        kind: "open-pack",
        entitlement: request,
      }),
    );
    const c = await measured(() =>
      timePurchase("purchase_view", async () => {
        const committed = await store.read();
        assert.equal(
          testReceipt(committed, request, packMember.id).cards.length,
          9,
        );
        return memberTestView(
          committed,
          packMember.id,
          [],
          false,
          Date.now(),
          [],
          { catalogue: false },
        );
      }),
    );
    if (i >= warmup) {
      buy.push(a.timing);
      open.push(b.timing);
      view.push(c.timing);
    }
  }
  const before = await store.read();
  assert.equal(
    wallet(before, packMember.id).spendable,
    25000 - product.price * (samples + warmup),
  );
  await Promise.all(
    Array.from({ length: 8 }, () =>
      store.execute(packMember, "isolated-pack-0", command),
    ),
  );
  await Promise.all(
    Array.from({ length: 8 }, () =>
      store.execute(packMember, "open-0", {
        kind: "open-pack",
        entitlement: "isolated-pack-0",
      }),
    ),
  );
  assert.deepEqual(await store.read(), before);
  assert.equal(
    (
      await sql`select journal from credits_sandbox.lines group by journal having sum(credits)<>0`
    ).length,
    0,
  );
  checks.push(
    `${Store === CreditsSandboxStore ? "candidate" : "baseline"}: ${samples + warmup} nine-card purchases/openings; 8 concurrent duplicate buys and opens preserve exact state and balance; balanced journals`,
  );
  return {
    buy: aggregate(buy),
    open: aggregate(open),
    postCommitView: aggregate(view),
    raw: { buy, open, view },
    databaseScope:
      "Actual CreditsSandboxStore, core issuance, native PostgreSQL advisory/row locks, durable journal/history and deferred balance guards; synthetic 24-player pool. Hosted catalogue, Auth, network and Production-only guard migrations are not included.",
  };
}
async function commercial() {
  await sql.unsafe(
    "create role anon; create role authenticated; create role service_role;",
  );
  await sql.unsafe(
    readFileSync(
      "supabase/migrations/20261101120754_commercial_google_ledger.sql",
      "utf8",
    ),
  );
  const approvals = {
    owner: "isolated-fixture",
    legal: "isolated-fixture",
    googlePlay: "isolated-fixture",
    privacy: "isolated-fixture",
    retention: "isolated-fixture",
    refundRecovery: "isolated-fixture",
    playerRights: "isolated-fixture",
    supplyReconciliation: "isolated-fixture",
    validUntil: "2099-01-01T00:00:00Z",
    withdrawals: false,
    prizes: false,
    paidEntry: false,
    nba: false,
  };
  await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)}`;
  await sql`update commercial_billing.products set approved=true`;
  for (let i = 0; i < 24; i++) {
    const player = randomUUID();
    for (const rarity of ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"])
      await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},'afl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'isolated-fixture',${sql.json({ name: `Synthetic AFL ${i}`, synthetic: true, team: "Fixture", position: "MID", season: "ISOLATED ACCEPTANCE", verifiedJerseyNumber: null, colour: "#16345A", status: "active" })})`;
  }
  const ledger = new CommercialLedger(sql, "acceptance", {
      active: "local",
      values: { local: randomBytes(32) },
    }),
    authorize = async () => {},
    rows: Row[] = [],
    pack = commercialPack("afl", "STANDARD", 9);
  for (let i = 0; i < samples + warmup; i++) {
    const member = randomUUID(),
      token = `isolated-token-${i}`,
      account = createHash("sha256").update(member).digest("hex"),
      product = commercialProducts[i % 2],
      orderId = `GPA.0000-0000-${i}`;
    const purchase = {
      orderId,
      purchaseStateContext: { purchaseState: "PURCHASED" },
      testPurchaseContext: { fopType: "TEST" },
      obfuscatedExternalAccountId: account,
      regionCode: "AU",
      productLineItem: [
        {
          productId: product.id,
          productOfferDetails: {
            quantity: 1,
            refundableQuantity: 1,
            purchaseOptionId: "buy-au",
            consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
          },
        },
      ],
    };
    const order = {
      orderId,
      purchaseToken: token,
      state: "PROCESSED",
      lastEventTime: new Date().toISOString(),
      total: { currencyCode: "AUD", units: String(product.audCents / 100) },
      tax: { currencyCode: "AUD", units: "0" },
      lineItems: [
        {
          productId: product.id,
          oneTimePurchaseDetails: { quantity: 1, purchaseOptionId: "buy-au" },
        },
      ],
      orderHistory: {},
    };
    // Real verifier parsing/account/product checks, deterministic transport. Not Google checkout evidence.
    const verifier = new GoogleCommercialVerifier(
      "acceptance",
      async () => "fixture-oauth",
      async (input) =>
        Response.json(String(input).includes("/orders/") ? order : purchase),
    );
    const a = await measured(async () => {
      const receipt = await timePurchase("purchase_verify", () =>
        verifier.verify(token, account),
      );
      return timePurchase("purchase_transaction", () =>
        ledger.accept(receipt, member, token, authorize),
      );
    });
    const b = await measured(() =>
      timePurchase("purchase_transaction", () =>
        ledger.buyPack(
          member,
          randomUUID(),
          {
            sport: "afl",
            family: "STANDARD",
            size: 9,
            configurationHash: pack.configurationHash,
            confirmed: true,
          },
          authorize,
        ),
      ),
    );
    const c = await measured(() =>
      timePurchase("purchase_transaction", () =>
        ledger.openPack(member, b.value.id, authorize),
      ),
    );
    assert.equal(c.value.cards.length, 9);
    assert.equal(
      (await ledger.wallet(member)).balance,
      product.credits - pack.priceCredits,
    );
    if (i === 0) {
      const verified = await verifier.verify(token, account);
      await Promise.all(
        Array.from({ length: 8 }, () =>
          ledger.accept(verified, member, token, authorize),
        ),
      );
      assert.equal(
        (await ledger.wallet(member)).balance,
        product.credits - pack.priceCredits,
      );
      await assert.rejects(
        ledger.accept(verified, randomUUID(), token, authorize),
        /another account/,
      );
      const refunded = {
        ...verified,
        state: "REVOKED" as const,
        refundedCents: verified.grossCents!,
        providerAt: new Date().toISOString(),
      };
      await ledger.accept(refunded, member, token, authorize);
      await ledger.accept(refunded, member, token, authorize);
      assert.equal((await ledger.wallet(member)).balance, 0);
      assert.equal(
        (await ledger.openPack(member, b.value.id, authorize)).cards.length,
        9,
      );
      const [hold] =
        await sql`select exposure_credits from commercial_billing.recovery_cases where receipt=${verified.key}`;
      assert.equal(Number(hold.exposure_credits), pack.priceCredits);
      checks.push(
        "native commercial receipt: 8 concurrent retries credit once; cross-account replay denied; duplicate refund after nine-card opening yields zero spendable and exact recovery hold, preserving cards",
      );
    }
    if (i >= warmup)
      rows.push({
        verifyTransportMock: a.timing.purchase_verify!,
        receiptCommit: a.timing.purchase_transaction!,
        packCommit: b.timing.purchase_transaction!,
        openCommit: c.timing.purchase_transaction!,
      });
  }
  checks.push(
    "commercial: both 4,900/9,900-credit mappings; actual verifier with mocked Google transport; native migration/ledger; 22 receipt, pack and nine-card open commits with exact remaining balances",
  );
  return {
    stages: aggregate(rows),
    raw: rows,
    providerScope:
      "No Google account, checkout, payment authorisation, network latency, notification push or acknowledgement measured. OAuth and Google response transport are deterministic fixtures; ledger and SQL are real.",
  };
}
async function main() {
  try {
    const baselinePath = "../tmp/purchase-timing-baseline.ts";
    const baseline = (await import(baselinePath)) as {
      CreditsSandboxStore: typeof CreditsSandboxStore;
    };
    const before = await internal(baseline.CreditsSandboxStore),
      after = await internal(CreditsSandboxStore),
      google = await commercial();
    const output = {
      createdAt: new Date().toISOString(),
      baselineCommit: "f07f76e0",
      engine: (await sql`select version() v`)[0].v,
      samples,
      warmup,
      synthetic: true,
      productionMutated: false,
      realProviderTransactions: 0,
      scope:
        "Native loopback PostgreSQL only. Stage diagnostics are nested and cannot be added. Before/after isolated totals measure instrumentation impact, not a claimed hosted speedup.",
      before,
      after,
      google,
      checks,
    };
    mkdirSync("docs/qa/scoring-pack-refinement-20261108", { recursive: true });
    writeFileSync(
      "docs/qa/scoring-pack-refinement-20261108/purchase-timing-postgres.json",
      JSON.stringify(output, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        { before: before.buy, after: after.buy, google: google.stages, checks },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
