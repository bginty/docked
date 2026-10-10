import { test } from "node:test";
import assert from "node:assert/strict";
import { csv, operationFilters } from "../../src/core/owner-operations";
import { paymentTotals } from "../../src/core/payment-report";
import {
  generatePrizes,
  updatePrize,
  prizeTotals,
  type PrizeRegister,
} from "../../src/core/prize-register";
const actor = { id: "owner", owner: true, aal: "aal2" },
  at = "2026-10-10T00:00:00Z",
  due = "2026-10-11T00:00:00Z";
const results = {
  competition: "synthetic",
  sport: "epl",
  round: "1",
  final: true,
  complete: true,
  revision: 1,
  winners: [{ member: "a", name: "Synthetic A", rank: 1 }],
};
const schedule = {
  version: "sample-only-v1",
  approved: true,
  tiePolicy: "hold" as const,
  prizes: [
    {
      position: 1,
      description: "Synthetic pack",
      kind: "pack" as const,
      quantity: 1,
      currency: null,
      cents: null,
      verificationRequired: false,
    },
  ],
};
test("Owner CSV protects formulas; reporting defaults live and uses Sydney date boundaries", () => {
  const f = operationFilters({ start: "2026-10-10", end: "2026-10-10" });
  assert.equal(f.scope, "live");
  assert.equal(f.staff, "false");
  assert.equal(f.startAt, "2026-10-09T13:00:00.000Z");
  assert.match(
    csv([["=CMD()", " +formula", "safe", 'quote"x']]),
    /"'=CMD\(\)"/,
  );
  assert.match(csv([["\tfoo"]]), /"'\tfoo"/);
  assert.throws(() =>
    operationFilters({ start: "2026-10-12", end: "2026-10-10" }),
  );
});
test("Payment totals separate test/live and include refunds fees and chargebacks; not profit", () => {
  const rows = [
    {
      scope: "live" as const,
      at,
      kind: "capture" as const,
      currency: "AUD",
      cents: 9900,
      providerId: "1",
    },
    {
      scope: "live" as const,
      at,
      kind: "refund" as const,
      currency: "AUD",
      cents: 1000,
      providerId: "2",
    },
    {
      scope: "live" as const,
      at,
      kind: "fee" as const,
      currency: "AUD",
      cents: 300,
      providerId: "3",
    },
    {
      scope: "beta" as const,
      at,
      kind: "capture" as const,
      currency: "AUD",
      cents: 100000,
      providerId: "4",
    },
  ];
  assert.equal(paymentTotals(rows, "live", at, due).AUD.netReceipts, 8600);
  assert.throws(
    () => paymentTotals([...rows, rows[0]], "live", at, due),
    /Duplicate/,
  );
});
test("Final prizes exactly once, provisional denial, ties held, corrections preserve fulfilled audit", () => {
  const empty: PrizeRegister = {
    scope: "synthetic-only",
    obligations: [],
    audit: [],
  };
  assert.throws(() =>
    generatePrizes(
      empty,
      { ...results, final: false },
      schedule,
      actor,
      at,
      due,
    ),
  );
  assert.throws(() =>
    generatePrizes(
      empty,
      results,
      schedule,
      { ...actor, aal: "aal1" },
      at,
      due,
    ),
  );
  let s = generatePrizes(empty, results, schedule, actor, at, due);
  const id = s.obligations[0].id;
  assert.equal(
    generatePrizes(s, results, schedule, actor, at, due).audit.length,
    1,
  );
  s = updatePrize(
    s,
    id,
    "APPROVED",
    actor,
    at,
    "Synthetic eligibility checked",
    { eligible: true },
  );
  s = updatePrize(
    s,
    id,
    "PROCESSING",
    actor,
    at,
    "Synthetic fulfilment started",
  );
  s = updatePrize(s, id, "FULFILLED", actor, at, "Synthetic grant confirmed", {
    eligible: true,
    reference: "fake-grant",
    evidence: "local-test",
  });
  assert.equal(prizeTotals(s, due, at, due).fulfilledInRange, 1);
  s = generatePrizes(
    s,
    {
      ...results,
      revision: 2,
      winners: [{ member: "b", name: "Synthetic B", rank: 1 }],
    },
    schedule,
    actor,
    due,
    due,
  );
  assert.equal(s.obligations.length, 1);
  assert.equal(s.obligations[0].status, "HELD");
  assert.equal(s.obligations[0].reference, "fake-grant");
  assert.ok(s.audit.some((a) => a.result.status === "FULFILLED"));
  assert.equal(prizeTotals(s, due, at, due).fulfilledInRange, 1);
  assert.equal(prizeTotals(s, due, at, due).nonCashUnits, 0);
  assert.throws(
    () =>
      updatePrize(
        s,
        id,
        "AWAITING_APPROVAL",
        actor,
        due,
        "Attempt duplicate fulfilment",
      ),
    /never pay twice/,
  );
  const tie = generatePrizes(
    empty,
    {
      ...results,
      winners: [...results.winners, { member: "b", name: "B", rank: 1 }],
    },
    schedule,
    actor,
    at,
    due,
  );
  assert.ok(tie.obligations.every((o) => o.status === "HELD"));
  assert.deepEqual(prizeTotals(tie, due, at, due).cashByCurrency, {});
});
