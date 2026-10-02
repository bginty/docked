import { test } from "node:test";
import assert from "node:assert/strict";
import {
  binaryPrice,
  removeMargin,
  oddsDisplay,
  evaluate,
  decisionWindow,
  payoffEV,
  hash,
  strategyV1,
} from "../../src/core/pricing";
import { now, rules, quotes } from "./fixtures";
const input = () => ({
  rules,
  startAt: "2026-10-02T12:00:00.000Z",
  decisionAt: now,
  quotes: quotes(),
});
test("binary arithmetic and minimum price rounds upward", () => {
  const p = binaryPrice("0.55", "2");
  assert.equal(p.ev, "0.1");
  assert.equal(p.minimumOdds, "1.88");
  assert.equal(binaryPrice("0.55", "1.8").ev, "-0.01");
  assert.equal(binaryPrice("0.5", "2", "0.03").minimumOdds, "2.06");
});
test("margin removal normalises complete vectors", () => {
  const p = removeMargin({ A: "1.9", B: "1.9" });
  assert.equal(p.A.toFixed(15), "0.500000000000000");
  assert.equal(p.A.plus(p.B).toFixed(15), "1.000000000000000");
  assert.throws(() => removeMargin({ A: "2" }));
});
test("decimal, fractional and American conversions", () => {
  assert.equal(oddsDisplay("2", "american"), "+100");
  assert.equal(oddsDisplay("1.5", "american"), "-200");
  assert.equal(oddsDisplay("2.5", "fractional"), "3/2");
  assert.equal(oddsDisplay("1.8", "decimal"), "1.80");
});
test("complete state payoff supports pushes without binary coercion", () => {
  assert.equal(
    payoffEV([
      { probability: ".5", netPayoff: "1" },
      { probability: ".1", netPayoff: "0" },
      { probability: ".4", netPayoff: "-1" },
    ]).toString(),
    ".1".replace(/^\./, "0."),
  );
  assert.throws(() => payoffEV([{ probability: ".5", netPayoff: "1" }]));
});
test("one independent benchmark and stable config hash", () => {
  const r = evaluate(input());
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].offer.bookmaker, "offer");
  assert.equal(r.candidates[0].references.length, 2);
  assert.equal(hash(strategyV1), r.candidates[0].configHash);
});
test("target and related skin cannot reference themselves", () => {
  const x = input();
  x.quotes[2].operator = "offer-group";
  const r = evaluate(x);
  assert.equal(r.candidates.length, 0);
  assert.ok(
    r.rejections.some(
      (r) => r.reason === "insufficient_independent_references",
    ),
  );
});
for (const [name, mutate, reason] of [
  [
    "stale",
    (q: ReturnType<typeof quotes>) => {
      q[0].sourceAt = "2026-10-02T05:50:00Z";
    },
    "stale",
  ],
  [
    "future",
    (q: ReturnType<typeof quotes>) => {
      q[0].sourceAt = "2026-10-02T06:01:00Z";
    },
    "future_or_invalid_timestamp",
  ],
  [
    "mismatch",
    (q: ReturnType<typeof quotes>) => {
      q[0].rules.overtime = false;
    },
    "market_mismatch",
  ],
  [
    "incomplete",
    (q: ReturnType<typeof quotes>) => {
      delete q[0].prices["Fictional B"];
    },
    "incomplete_market",
  ],
  [
    "suspended",
    (q: ReturnType<typeof quotes>) => {
      q[0].suspended = true;
    },
    "unapproved_or_suspended",
  ],
] as const)
  test(`${name} quote rejected`, () => {
    const x = input();
    mutate(x.quotes);
    assert.ok(evaluate(x).rejections.some((r) => r.reason === reason));
  });
test("source skew rejects independently fresh but asynchronous quotes", () => {
  const x = input();
  x.quotes[1].sourceAt = "2026-10-02T05:58:10Z";
  assert.ok(evaluate(x).rejections.some((r) => r.reason === "source_skew"));
});
test("missed decision windows and pre-start safety do not create extra tips", () => {
  assert.equal(decisionWindow(input().startAt, "2026-10-02T06:03:00Z"), null);
  assert.equal(decisionWindow(input().startAt, "2026-10-02T11:59:00Z"), null);
  assert.equal(
    evaluate({ ...input(), decisionAt: "2026-10-02T06:03:00Z" }).candidates
      .length,
    0,
  );
});
test("unsupported non-binary market fails closed", () => {
  const x = input();
  x.rules = { ...rules, market: "exchange_lay" as never };
  assert.equal(evaluate(x).candidates.length, 0);
});
