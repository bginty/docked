import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { StoreTestInbox } from "../src/server/store-test-inbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { initialCredits, wallet } from "../src/core/credits-sandbox";
import { newCreditOnly } from "../src/core/credit-only";
import { hostedMemberFixture } from "./hosted-member-fixture";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet";
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
    const memberMode = process.env.DOCKED_HOSTED_MEMBER_TEST === "true";
    if(memberMode) await admin.unsafe(readFileSync("supabase/migrations/20261031224322_isolated_member_billing_acceptance.sql","utf8"));
    const schema = memberMode ? "store_member_acceptance" : "store_billing_acceptance";
    const state = memberMode ? hostedMemberFixture() : initialCredits();
    state.creditOnly = newCreditOnly();
    await admin`insert into ${admin(schema)}.state values(true,0,${admin.json(state as any)})`;
    const password = randomBytes(24).toString("hex");
    await admin.unsafe(
      `alter role docked_billing_test login password '${password}'`,
    );
    url.username = "docked_billing_test";
    url.password = password;
    const sql = postgres(url.href, { max: 8, onnotice: () => {} });
    inbox = new StoreTestInbox({ hostedAcceptance: sql, memberAcceptance: memberMode }, randomBytes(32));
    const store = new CreditsSandboxStore(
      sql,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      schema,
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
    if(memberMode) {
      const product = Object.values(state.economy!.products).find(p=>p.sport==='nrl' && p.type==='STANDARD' && p.cards===9 && state.economy!.activeProductVersions!.includes(p.id))!;
      const actor = {id:'synthetic-store-acceptance',role:'member' as const};
      const command = {kind:'buy-pack',product:product.id,configuration:product.version,expectedPrice:700,confirmed:true,policy:state.policy.version};
      await Promise.all(Array.from({length:16},()=>store.execute(actor,'one-hosted-pack',command)));
      await Promise.all(Array.from({length:10},()=>store.execute(actor,'one-hosted-opening',{kind:'open-pack',entitlement:'one-hosted-pack'})));
      const after = await store.read();
      assertMemberTestEconomy(after);
      assert.equal(wallet(after,actor.id).available,4200);
      assert.equal(Object.keys(after.economy!.instances).length,9);
      assert.equal(after.entitlements['one-hosted-pack'].status,'OPENED');
      assert(Object.values(after.commerce.cards).filter(c=>c.owner===actor.id).every(c=>c.sport==='nrl'));
    }
    await assert.rejects(
      sql`truncate ${sql(schema)}.journal`,
      /permission denied/,
    );
    await assert.rejects(
      sql`update ${sql(schema)}.journal set document='{}'`,
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
      wallet(await store.read(), "synthetic-store-acceptance").spendable,
      0,
    );
    await accept({ ...receipt, key: "pending", state: "PENDING" });
    assert.equal(
      wallet(await store.read(), "synthetic-store-acceptance").spendable,
      0,
    );
    console.log(
      JSON.stringify({
        passed: true,
        checks: [
          ...(memberMode ? ["Shared member wallet: 16 pack retries debit once, 10 openings retain nine NRL cards; refund holds spent funds; zero customer access"]:[]),
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
