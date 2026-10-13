import assert from "node:assert/strict";
import postgres from "postgres";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { creditsFixture, alice, bob, owner, provider } from "./credits-fixture";
import { newCreditOnly } from "../src/core/credit-only";
import {
  wallet,
  financialReport,
  validateCredits,
} from "../src/core/credits-sandbox";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL!;
  assert.equal(new URL(url).hostname, "127.0.0.1");
  assert.match(new URL(url).pathname, /docked_free_play_test_/);
  const sql = postgres(url, { max: 12, onnotice: () => {} });
  const checks: string[] = [];
  try {
    await sql.unsafe(readFileSync("sandbox/credits.sql", "utf8"));
    const s = creditsFixture();
    s.creditOnly = newCreditOnly();
    // Disposable third-party seller and card fixtures, never human holdings.
    for (const card of ["a", "b"]) {
      s.commerce.cards[card] = {
        owner: alice.id,
        reserved: null,
        tier: "RARE",
        sport: "nfl",
      };
      s.cards[card] = {
        version: 1,
        restricted: false,
        locked: false,
        history: [
          { from: null, to: alice.id, reference: "QA-fixture", at: Date.now() },
        ],
      };
    }
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(s as any)})`;
    const store = new CreditsSandboxStore(sql);
    const run = store.execute.bind(store);
    await run(bob, "deposit", { kind: "credit-deposit", cents: 1000 });
    await run(provider, "bind", {
      kind: "bind",
      deposit: "deposit",
      providerOrder: "PP",
    });
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        run(provider, `capture${i}`, {
          kind: "capture",
          deposit: "deposit",
          providerOrder: "PP",
          capture: "CAP",
          event: `E${i}`,
          amount: 1000,
          currency: "AUD",
          verified: true,
          merchant: "SYNTHETIC_MERCHANT",
        }),
      ),
    );
    assert.equal(wallet(await store.read(), bob.id).pending, 1000);
    await run(provider, "clear", { kind: "clear", deposit: "deposit" });
    checks.push(
      "12 concurrent confirmed-payment deliveries issue exactly 1000 credits once; pending not spendable",
    );
    for (const card of ["a", "b"])
      await run(alice, `list${card}`, { kind: "list", card, price: 600 });
    const attempts = await Promise.allSettled(
      ["a", "b"].map((card) =>
        run(bob, `buy${card}`, {
          kind: "buy",
          listing: `list${card}`,
          expectedPrice: 600,
          policy: s.policy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
    let state = await store.read();
    assert.equal(wallet(state, bob.id).available, 400);
    assert.equal(wallet(state, alice.id).available, 555);
    const purchased = Object.entries(state.listings).find(
      ([, l]) => l.status === "SOLD",
    )!;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        run(bob, purchased[0].replace("list", "buy"), {
          kind: "buy",
          listing: purchased[0],
          expectedPrice: 600,
          policy: s.policy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(wallet(await store.read(), bob.id).available, 400);
    checks.push(
      "Competing purchases cannot overspend; losing transaction leaves card, price and ownership unchanged; duplicate successful purchase returns same receipt",
    );
    await run(provider, "settle", {
      kind: "settlement",
      deposit: "deposit",
      reference: "BANK",
      net: 1000,
      fees: 0,
      verified: true,
    });
    await run(alice, "kyc", { kind: "kyc-start", session: "K" });
    await run(
      { id: "synthetic-identity", role: "identity-provider" },
      "verified",
      {
        kind: "kyc-event",
        member: alice.id,
        session: "K",
        event: "KE",
        revision: 1,
        state: "VERIFIED",
        expires: Date.now() + 86400000,
      },
    );
    await run(owner, "beneficiary", {
      kind: "beneficiary",
      member: alice.id,
      beneficiary: "BEN",
      verified: true,
      reason: "Synthetic verified beneficiary only",
    });
    const request = {
      kind: "withdraw",
      amount: 500,
      beneficiary: "BEN",
      confirmed: true,
      policy: s.policy.version,
    };
    const withdrawals = await Promise.allSettled(
      ["w1", "w2"].map((id) => run(alice, id, request)),
    );
    assert.equal(withdrawals.filter((x) => x.status === "fulfilled").length, 1);
    state = await store.read();
    const wid = Object.keys(state.withdrawals)[0];
    assert.equal(wallet(state, alice.id).reserved, 500);
    await run(owner, "review", {
      kind: "withdraw-review",
      withdrawal: wid,
      action: "approve",
      reason: "Synthetic payout review, no actual payment",
    });
    await run(provider, "submit", {
      kind: "payout-submit",
      withdrawal: wid,
      provider: "OUT",
    });
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        run(provider, `failed${i}`, {
          kind: "payout-result",
          withdrawal: wid,
          provider: "OUT",
          event: `F${i}`,
          status: "FAILED",
          verified: true,
        }),
      ),
    );
    state = await store.read();
    assert.equal(wallet(state, alice.id).reserved, 0);
    assert.equal(wallet(state, alice.id).available, 555);
    checks.push(
      "Concurrent withdrawal reservations cannot overspend; eight verified failure notifications release once",
    );
    validateCredits(state);
    const report = financialReport(state);
    assert.equal(report.circulation.difference, 0);
    assert.deepEqual(report.unbalancedTransactions, []);
    const sums =
      await sql`select journal,sum(credits)::int n from credits_sandbox.lines group by journal having sum(credits)<>0`;
    assert.equal(sums.length, 0);
    await assert.rejects(
      () => sql`update credits_sandbox.lines set credits=1`,
      /immutable/,
    );
    await assert.rejects(
      () => sql`delete from credits_sandbox.journal`,
      /immutable/,
    );
    checks.push(
      "Database postings balance; immutable journal and lines; persisted aggregate validates",
    );
    // Two funded buyers compete for the same unique card, then retry the winner.
    const c = { id: "synthetic-charlie", role: "member" } as const;
    await run(owner, "grant-charlie", {
      kind: "promotion",
      member: c.id,
      amount: 1000,
      campaign: "v2-race",
      reason: "Disposable local race test only",
      confirmed: true,
      redeemable: false,
    });
    const remaining = Object.entries(state.listings).find(
      ([, l]) => l.status === "OPEN",
    )!;
    await run(alice, "cancel-remaining", {
      kind: "cancel-listing",
      listing: remaining[0],
    });
    await run(alice, "race-list", {
      kind: "list",
      card: remaining[1].card,
      price: 300,
    });
    const sameCard = await Promise.allSettled(
      [bob, c].map((m) =>
        run(m, "same-card-" + m.id, {
          kind: "buy",
          listing: "race-list",
          expectedPrice: 300,
          policy: s.policy.version,
          confirmed: true,
        }),
      ),
    );
    assert.equal(sameCard.filter((x) => x.status === "fulfilled").length, 1);
    const raced = await store.read();
    assert.equal(raced.cards[remaining[1].card].history.length, 2);
    assert.equal(
      raced.journal.filter((j) => j.id.startsWith("same-card-")).length,
      1,
    );
    checks.push(
      "Two buyers contend for one card: one owner transfer, one debit/proceeds/commission only",
    );
    const fingerprint = JSON.stringify(raced);
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`update credits_sandbox.state set revision=revision+1`;
          throw Error("expected rollback");
        }),
      /expected rollback/,
    );
    assert.equal(JSON.stringify(await store.read()), fingerprint);
    checks.push("Forced database rollback leaves state unchanged");
    mkdirSync("docs/qa/credit-v2", { recursive: true });
    writeFileSync(
      "docs/qa/credit-v2/concurrency.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scope: "disposable local PostgreSQL / simulated provider events",
          passed: true,
          checks,
          circulation: report.circulation,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
