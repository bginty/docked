/** Targeted acknowledgement regression. Synthetic provider and disposable local
 * PostgreSQL only; never connects to a hosted/customer ledger or Google. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialReconciliation } from "../src/server/commercial-reconciliation";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
} from "../src/core/commercial-billing";
import { rarityRule } from "../src/core/card-rarity";

const url = new URL(process.env.COMMERCIAL_ACK_DB ?? "");
assert.equal(
  url.hostname,
  "127.0.0.1",
  "Disposable loopback database required",
);
assert.equal(url.pathname, "/commercial_ack_acceptance");
const sql = postgres(url.href, { max: 16, onnotice: () => {} });
const encryption = { active: "fixture", values: { fixture: randomBytes(32) } };
const ledger = new CommercialLedger(sql, "acceptance", encryption);
const checks: { name: string; elapsedMs: number }[] = [];
const authorize = async () => {};
const account = "a".repeat(64);
let sequence = 0;
type Fixture = {
  member: string;
  token: string;
  receipt: CommercialReceipt;
  down: boolean;
  loseConsumeResponse: boolean;
  consumeAttempts: number;
  consumeSettlements: number;
};
const provider = new Map<string, Fixture>();
function fixture(credits = 4900): Fixture {
  const token = `synthetic-ack-token-${++sequence}`;
  const product = commercialProducts.find((p) => p.credits === credits)!;
  const f: Fixture = {
    member: randomUUID(),
    token,
    receipt: {
      key: createHash("sha256")
        .update("docked.fantasy\0" + token)
        .digest("hex"),
      account,
      environment: "acceptance",
      product,
      state: "PURCHASED",
      consumed: false,
      paid: true,
      orderId: `GPA.0000-0000-${sequence}`,
      grossCents: product.audCents,
      taxCents: null,
      refundedCents: 0,
      providerAt: new Date().toISOString(),
    },
    down: false,
    loseConsumeResponse: false,
    consumeAttempts: 0,
    consumeSettlements: 0,
  };
  provider.set(token, f);
  return f;
}
const verifier = {
  async verify(token: string, expectedAccount: string) {
    const f = provider.get(token);
    assert(f && expectedAccount === f.receipt.account);
    if (f.down) throw Error("Synthetic provider outage");
    return { ...f.receipt };
  },
  async consume(token: string, expectedAccount: string) {
    const f = provider.get(token);
    assert(f && expectedAccount === f.receipt.account);
    f.consumeAttempts++;
    if (f.down) throw Error("Synthetic provider outage");
    if (f.receipt.consumed) return;
    // Hold the actual lease briefly so concurrent claim attempts overlap.
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(f.receipt.state, "PURCHASED");
    f.receipt.consumed = true;
    f.consumeSettlements++;
    if (f.loseConsumeResponse) {
      f.loseConsumeResponse = false;
      throw Error("Synthetic response lost after Google consumed");
    }
  },
};
const worker = () =>
  new CommercialReconciliation(
    new CommercialLedger(sql, "acceptance", encryption),
    verifier,
    async () => true,
  );
const accept = (f: Fixture) =>
  ledger.accept(f.receipt, f.member, f.token, authorize);
async function job(f: Fixture) {
  const [r] =
    await sql`select state,attempts from commercial_billing.jobs where id=${`consume:${f.receipt.key}`}`;
  return r;
}
async function makeDue(f: Fixture) {
  // Advance only this synthetic job's database retry clock, not a real receipt.
  await sql`update commercial_billing.jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=${`consume:${f.receipt.key}`}`;
}
async function creditCount(f: Fixture) {
  const [r] =
    await sql`select count(*)::int n from commercial_billing.journals where id=${`${f.receipt.key}:credit`}`;
  return r.n;
}
async function check(name: string, run: () => Promise<void>) {
  const start = performance.now();
  await run();
  checks.push({ name, elapsedMs: Math.round(performance.now() - start) });
  console.log(`PASS ${name}`);
}
async function main() {
  await sql.unsafe(
    "create role anon;create role authenticated;create role service_role;",
  );
  await sql.unsafe(
    readFileSync(
      "supabase/migrations/20261101120754_commercial_google_ledger.sql",
      "utf8",
    ),
  );
  const approvals = Object.fromEntries(
    [
      "owner",
      "legal",
      "googlePlay",
      "privacy",
      "retention",
      "refundRecovery",
      "playerRights",
      "supplyReconciliation",
    ].map((k) => [k, "isolated-synthetic-ack-fixture"]),
  );
  Object.assign(approvals, {
    validUntil: "2099-01-01T00:00:00Z",
    withdrawals: false,
    prizes: false,
    paidEntry: false,
    nba: false,
  });
  await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,transfers_enabled=false,policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)}`;
  await sql`update commercial_billing.products set approved=true`;

  await check(
    "verified fulfilment acknowledges promptly within the three-minute TEST budget",
    async () => {
      const f = fixture();
      const start = performance.now();
      await accept(f);
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        true,
      );
      assert(performance.now() - start < 180_000);
      assert.equal(f.receipt.consumed, true);
      assert.equal(f.consumeSettlements, 1);
      assert.equal((await job(f)).state, "done");
      assert.equal((await ledger.wallet(f.member)).balance, 4900);
      assert.equal(await creditCount(f), 1);
    },
  );

  await check(
    "concurrent duplicate callbacks retain one credit and one consume lease",
    async () => {
      const f = fixture();
      await Promise.all(Array.from({ length: 12 }, () => accept(f)));
      await Promise.all(
        Array.from({ length: 20 }, () =>
          worker().acknowledgeReceipt(f.receipt.key, f.member),
        ),
      );
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        true,
      );
      assert.equal(f.consumeAttempts, 1);
      assert.equal(f.consumeSettlements, 1);
      assert.equal((await job(f)).attempts, 1);
      assert.equal(await creditCount(f), 1);
      assert.equal((await ledger.wallet(f.member)).balance, 4900);
    },
  );

  await check(
    "cross-member acknowledgement cannot claim or consume another receipt",
    async () => {
      const f = fixture();
      await accept(f);
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, randomUUID()),
        false,
      );
      assert.equal(f.consumeAttempts, 0);
      assert.deepEqual(await job(f), { state: "pending", attempts: 0 });
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        true,
      );
    },
  );

  await check(
    "provider outage leaves durable retry and a restarted worker finishes without extra credit",
    async () => {
      const f = fixture();
      await accept(f);
      f.down = true;
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        false,
      );
      assert.deepEqual(await job(f), { state: "pending", attempts: 1 });
      assert.equal((await ledger.wallet(f.member)).balance, 4900);
      f.down = false;
      await makeDue(f);
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        true,
      );
      assert.equal(f.consumeSettlements, 1);
      assert.equal(await creditCount(f), 1);
      assert.deepEqual(await job(f), { state: "done", attempts: 2 });
    },
  );

  await check(
    "a lost consume response is retried idempotently after restart",
    async () => {
      const f = fixture();
      await accept(f);
      f.loseConsumeResponse = true;
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        false,
      );
      assert.equal(f.receipt.consumed, true);
      await makeDue(f);
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        true,
      );
      assert.equal(f.consumeSettlements, 1);
      assert.equal(await creditCount(f), 1);
    },
  );

  await check(
    "refund recovery retains eighteen cards and its hold while acknowledgement cannot consume revoked funding",
    async () => {
      for (let i = 0; i < 12; i++) {
        const player = randomUUID();
        for (const rarity of [
          "RARE",
          "ELITE",
          "ULTRA_RARE",
          "LEGENDARY",
          "ICON",
        ] as const)
          await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},'afl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'isolated-ack-fixture',${sql.json({ name: `Synthetic AFL ${i}`, synthetic: true, team: "Fixture", position: "MID", season: "ISOLATED ACK FIXTURE", verifiedJerseyNumber: null, colour: "#16345A", status: "active" })})`;
      }
      const f = fixture(9900);
      const unrelated = fixture();
      await accept(f);
      await accept(unrelated);
      for (const family of ["PREMIUM", "STANDARD"] as const) {
        const pack = commercialPack("afl", family, 9);
        const bought = await ledger.buyPack(
          f.member,
          randomUUID(),
          {
            sport: "afl",
            family,
            size: 9,
            configurationHash: pack.configurationHash,
            confirmed: true,
          },
          authorize,
        );
        await ledger.openPack(f.member, bought.id, authorize);
      }
      f.receipt = {
        ...f.receipt,
        state: "REVOKED",
        refundedCents: 9900,
        providerAt: new Date().toISOString(),
      };
      await ledger.accept(f.receipt, f.member, f.token, authorize, false);
      const before =
        await sql`select exposure_credits,reason,state,revision from commercial_billing.recovery_cases where receipt=${f.receipt.key}`;
      assert.equal(
        await worker().acknowledgeReceipt(f.receipt.key, f.member),
        false,
      );
      assert.deepEqual(
        await sql`select exposure_credits,reason,state,revision from commercial_billing.recovery_cases where receipt=${f.receipt.key}`,
        before,
      );
      assert.equal(Number(before[0].exposure_credits), 5700);
      const [cards] =
        await sql`select count(*)::int n from commercial_billing.cards where owner_id=${f.member}`;
      assert.equal(cards.n, 18);
      assert.equal((await ledger.wallet(f.member)).balance, 0);
      assert.equal((await ledger.wallet(f.member)).reviewRequired, true);
      assert.equal((await ledger.wallet(unrelated.member)).balance, 4900);
      assert.equal(f.consumeAttempts, 0);
    },
  );

  const [unbalanced] =
    await sql`select count(*)::int n from (select journal from commercial_billing.lines group by journal having sum(amount)<>0) x`;
  assert.equal(unbalanced.n, 0);
  const report = {
    at: new Date().toISOString(),
    environment: "disposable-loopback-PostgreSQL",
    syntheticProvider: true,
    genuineGooglePurchase: false,
    hostedWrites: 0,
    passed: true,
    checks,
  };
  mkdirSync("docs/qa/google-eligibility-20261105", { recursive: true });
  writeFileSync(
    "docs/qa/google-eligibility-20261105/acknowledgement-postgres.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
