import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { initialCredits, wallet } from "../src/core/credits-sandbox";
import { newCreditOnly } from "../src/core/credit-only";
import type { StoreReceipt } from "../src/server/store-purchase-verification";
async function main() {
  const url = new URL(process.env.FANTASY_TEST_DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  const admin = postgres(url.href, { onnotice: () => {} });
  let inbox: StoreTestInbox | undefined;
  try {
    await admin.unsafe(
      "create role anon; create role authenticated; create role service_role;",
    );
    await admin.unsafe(readFileSync("sandbox/credits.sql", "utf8"));
    await admin.unsafe(
      readFileSync(
        "supabase/migrations/20261031094324_isolated_google_billing_acceptance.sql",
        "utf8",
      ),
    );
    const state = initialCredits();
    state.creditOnly = newCreditOnly();
    await admin`insert into store_billing_acceptance.state values(true,0,${admin.json(state as any)})`;
    const password = randomBytes(24).toString("hex");
    await admin.unsafe(
      `alter role docked_billing_test login password '${password}'`,
    );
    url.username = "docked_billing_test";
    url.password = password;
    const sql = postgres(url.href, { max: 8, onnotice: () => {} });
    inbox = new StoreTestInbox({ hostedAcceptance: sql }, randomBytes(32));
    const store = new CreditsSandboxStore(
      sql,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "store_billing_acceptance",
    );
    const receipt: StoreReceipt = {
      provider: "google",
      key: "isolated",
      product: {
        id: "synthetic",
        scope: "account",
        credits: 4900,
        version: "fixture",
      },
      account: "synthetic-binding",
      state: "PURCHASED",
      environment: "test",
    };
    const accept = (r: StoreReceipt) =>
      inbox!.accept(
        r,
        "synthetic-store-acceptance",
        r.account,
        "private-synthetic-token",
      );
    await Promise.all(Array.from({ length: 20 }, () => accept(receipt)));
    assert.equal(
      wallet(await store.read(), "synthetic-store-acceptance").available,
      4900,
    );
    await assert.rejects(
      sql`select document from credits_sandbox.state`,
      /permission denied/,
    );
    await assert.rejects(
      sql`truncate store_billing_acceptance.journal`,
      /permission denied/,
    );
    await assert.rejects(
      sql`update store_billing_acceptance.journal set document='{}'`,
      /immutable/,
    );
    await assert.rejects(
      inbox.accept(
        receipt,
        "another-member",
        receipt.account,
        "private-synthetic-token",
      ),
      /conflict/,
    );
    let deliveries = 0;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        inbox!.deliverOne(async () => {
          deliveries++;
        }),
      ),
    );
    assert.equal(deliveries, 1);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        accept({ ...receipt, state: "CANCELLED" }),
      ),
    );
    await accept(receipt);
    assert.equal(
      wallet(await store.read(), "synthetic-store-acceptance").available,
      0,
    );
    await accept({ ...receipt, key: "pending", state: "PENDING" });
    assert.equal(
      wallet(await store.read(), "synthetic-store-acceptance").available,
      0,
    );
    console.log(
      JSON.stringify({
        passed: true,
        checks: [
          "dedicated RLS role cannot read customer ledger",
          "20 concurrent purchases credit once",
          "12 consumers deliver once",
          "refund retry and stale replay remain zero",
          "pending grants nothing",
          "immutable journals and truncate protected",
          "cross-member receipt denied",
        ],
        productionConnections: 0,
      }),
    );
  } finally {
    await inbox?.close();
    await admin.end();
  }
}
void main().catch(() => {
  console.error("Isolated hosted-schema test failed; diagnostics redacted");
  process.exitCode = 1;
});
