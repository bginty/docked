import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCredits,
  financialReport,
  validateCredits,
  wallet,
} from "../../src/core/credits-sandbox";
import {
  reconciliationCsv,
  reconciliationRange,
  reconciliationRows,
} from "../../src/core/credit-reconciliation";
import { newCreditOnly } from "../../src/core/credit-only";
import {
  alice,
  bob,
  owner,
  provider,
  creditsFixture,
} from "../../scripts/credits-fixture";
import type { Operator } from "../../src/core/commerce-sandbox";
const start = Date.parse("2026-10-13T00:00:00+11:00");
function setup() {
  let s = creditsFixture(),
    n = 0;
  s.creditOnly = newCreditOnly();
  for (const [id, m] of [
    ["A", alice],
    ["B", bob],
  ] as const) {
    s.commerce.cards[id] = {
      owner: m.id,
      reserved: null,
      tier: "RARE",
      sport: "nfl",
    };
    s.cards[id] = {
      version: 1,
      restricted: false,
      locked: false,
      history: [{ from: null, to: m.id, reference: "synthetic", at: start }],
    };
  }
  const run = (a: Operator, c: unknown, id = `r${++n}`, at = start) => {
    const out = executeCredits(s, a, id, c, at);
    s = out.state;
    return out.result;
  };
  const fund = () => {
    run(bob, { kind: "credit-deposit", cents: 1000 }, "deposit", start - 1000);
    run(
      provider,
      { kind: "bind", deposit: "deposit", providerOrder: "ORDER" },
      "bind",
      start - 1000,
    );
    run(
      provider,
      {
        kind: "capture",
        deposit: "deposit",
        providerOrder: "ORDER",
        capture: "CAPTURE",
        event: "EVENT",
        amount: 1000,
        currency: "AUD",
        merchant: "SYNTHETIC_MERCHANT",
        verified: true,
      },
      "capture",
      start - 1000,
    );
    run(provider, { kind: "clear", deposit: "deposit" }, "clear", start - 1000);
  };
  return {
    get s() {
      return s;
    },
    run,
    fund,
  };
}
test("dated reconciliation reconstructs sale/resale, opening and closing; no double-counted proceeds", () => {
  const h = setup();
  h.fund();
  h.run(alice, { kind: "list", card: "A", price: 1000 }, "listing");
  const buy = {
    kind: "buy",
    listing: "listing",
    expectedPrice: 1000,
    policy: h.s.policy.version,
    confirmed: true,
  };
  h.run(bob, buy, "buy");
  h.run(bob, buy, "buy");
  h.run(bob, { kind: "list", card: "A", price: 900 }, "resale");
  h.run(alice, { ...buy, listing: "resale", expectedPrice: 900 }, "buy2");
  const report = financialReport(h.s),
    v = reconciliationRows(
      report,
      reconciliationRange("2026-10-13", "2026-10-13"),
    );
  assert.equal(v.opening, 1000);
  assert.equal(v.closing, 857);
  assert.equal(v.rows.length, 2);
  assert.deepEqual(
    v.rows.map((r) => [r.grossDebit, r.sellerProceeds, r.commission]),
    [
      [1000, 925, 75],
      [900, 832, 68],
    ],
  );
  assert.ok(
    v.rows.every(
      (r) =>
        r.funding.includes("payment:CAPTURE") &&
        r.providerReferences[0].includes("CAPTURE"),
    ),
  );
  assert.equal(wallet(h.s, bob.id).available, 832);
  assert.equal(report.circulation.difference, 0);
  assert.match(reconciliationCsv(report), /Opening customer liability/);
  const empty = reconciliationRows(
    report,
    reconciliationRange("2026-10-14", "2026-10-14"),
  );
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.opening, 857);
  assert.equal(empty.closing, 857);
  h.run(
    provider,
    {
      kind: "settlement",
      deposit: "deposit",
      reference: "BANK",
      net: 960,
      fees: 40,
      verified: true,
    },
    "settle",
  );
  const settled = reconciliationRows(financialReport(h.s)).rows.at(-1)!;
  assert.ok(settled.providerReferences[0].includes("BANK"));
  assert.ok(settled.users.includes(bob.id));
  assert.equal(settled.liabilityMovement, 0);
});
test("Sydney date boundaries handle DST and invalid/reversed ranges", () => {
  const day = reconciliationRange("2026-10-04", "2026-10-04");
  assert.equal(day.end - day.start, 23 * 3600000);
  assert.throws(() => reconciliationRange("2026-02-30"), /Invalid/);
  assert.throws(() => reconciliationRange("2026-10-14", "2026-10-13"), /End/);
});
test("free swap atomically cancels superseded listings; replay and stale buy cannot create another owner", () => {
  const h = setup();
  h.run(owner, {
    kind: "swap-window",
    start,
    end: start + 60000,
    reason: "Isolated zero-fee test window",
  });
  h.run(alice, { kind: "list", card: "A", price: 1000 }, "listed");
  h.run(
    alice,
    { kind: "offer", other: bob.id, give: ["A"], take: ["B"], feeEach: 0 },
    "swap",
  );
  const cmd = { kind: "accept", swap: "swap", feeEach: 0 };
  h.run(bob, cmd, "accept");
  h.run(bob, cmd, "accept");
  assert.equal(h.s.listings.listed.status, "CANCELLED");
  assert.equal(h.s.cards.A.history.length, 2);
  assert.equal(h.s.commerce.cards.A.owner, bob.id);
  assert.throws(
    () =>
      h.run(bob, {
        kind: "buy",
        listing: "listed",
        expectedPrice: 1000,
        policy: h.s.policy.version,
        confirmed: true,
      }),
    /stale/,
  );
  assert.equal(financialReport(h.s).swapFees, 0);
  h.run(bob, { kind: "list", card: "A", price: 50 }, "new-owner");
  h.run(bob, { kind: "cancel-listing", listing: "new-owner" });
  assert.equal(h.s.listings["new-owner"].status, "CANCELLED");
});
test("missing funding record or altered posting is detected; CSV neutralises formula text", () => {
  const h = setup();
  h.fund();
  const missing = structuredClone(h.s);
  delete missing.lots[Object.keys(missing.lots)[0]];
  assert.throws(() => validateCredits(missing), /lot/);
  const altered = structuredClone(h.s);
  altered.journal[0].lines[0].credits++;
  assert.throws(() => validateCredits(altered), /integrity/);
  const report = financialReport(h.s);
  report.transactions[0].reason = '=HYPERLINK("bad")';
  assert.match(reconciliationCsv(report), /'=HYPERLINK/);
});
test("expired swap, forged ownership, failed purchase and stale amount preserve all records", () => {
  const h = setup();
  const before = structuredClone(h.s);
  assert.throws(
    () => h.run(bob, { kind: "list", card: "A", price: 100 }),
    /Ownership/,
  );
  assert.deepEqual(h.s, before);
  h.run(alice, { kind: "list", card: "A", price: 100 }, "L");
  const listed = structuredClone(h.s);
  assert.throws(
    () =>
      h.run(bob, {
        kind: "buy",
        listing: "L",
        expectedPrice: 99,
        policy: h.s.policy.version,
        confirmed: true,
      }),
    /stale/,
  );
  assert.throws(
    () =>
      h.run(bob, {
        kind: "buy",
        listing: "L",
        expectedPrice: 100,
        policy: h.s.policy.version,
        confirmed: true,
      }),
    /Insufficient/,
  );
  assert.deepEqual(h.s, listed);
  h.run(owner, {
    kind: "swap-window",
    start,
    end: start + 172800000,
    reason: "Isolated expiration acceptance",
  });
  h.run(
    alice,
    { kind: "offer", other: bob.id, give: ["A"], take: ["B"], feeEach: 0 },
    "S",
  );
  const offered = structuredClone(h.s);
  assert.throws(
    () =>
      h.run(
        bob,
        { kind: "accept", swap: "S", feeEach: 0 },
        "late",
        start + 86400000,
      ),
    /expired/,
  );
  assert.deepEqual(h.s, offered);
});
