import { test } from "node:test";
import assert from "node:assert/strict";
import { ledger, closingValue, type LedgerRow } from "../../src/core/ledger";
const rows: LedgerRow[] = ["2.00", "1.90", "2.20", "1.80", "2.00"].map(
  (odds, i) => ({
    id: `f${i}`,
    eventId: `e${i}`,
    odds,
    stake: "1",
    publishedAt: `2026-01-0${i + 1}`,
    evidence: "demo",
    result: (["won", "lost", "won", "lost", "lost"] as const)[i],
    sport: "fictional",
    strategy: "fixture",
  }),
);
test("required losing arithmetic fixture is precise", () => {
  const l = ledger(rows, "demo");
  assert.equal(l.net, "-0.80");
  assert.equal(l.roi, "-16.00");
  assert.equal(l.drawdown, "2.00");
  assert.equal(l.longestLosingRun, 2);
});
test("voids/pending disclosed and excluded from ROI denominator", () => {
  const l = ledger(
    [
      ...rows,
      { ...rows[0], id: "void", eventId: "void", result: "void" },
      { ...rows[0], id: "pending", eventId: "pending", result: "pending" },
    ],
    "demo",
  );
  assert.equal(l.roi, "-16.00");
  assert.equal(l.turnover, "7");
  assert.equal(l.voidStake, "1");
  assert.equal(l.pendingStake, "1");
});
test("withdrawal does not erase settlement", () => {
  assert.equal(
    ledger(
      rows.map((r) => ({ ...r, availability: "withdrawn" })),
      "demo",
    ).net,
    "-0.80",
  );
});
test("reject mixed evidence and duplicate benchmarks", () => {
  assert.throws(() => ledger(rows, "live_published"));
  assert.throws(() => ledger([...rows, rows[0]], "demo"));
});
test("empty metrics and missing closing observations are N/A", () => {
  assert.equal(ledger([], "live_published").roi, null);
  assert.equal(ledger([], "live_published").net, null);
  assert.equal(
    closingValue("2", ".53", "2026-01-01T12:00Z", "2026-01-01T11:59Z", true),
    null,
  );
  assert.equal(
    closingValue("2", ".53", "2026-01-01T11:50Z", "2026-01-01T12:00Z", true),
    "0.06",
  );
});
