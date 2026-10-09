import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  officialRecordMetrics,
  officialRecordScope,
  type OfficialDockedRecord,
  type OfficialRecordRow,
} from "../../src/core/official-docked-record";
import { OfficialRecord } from "../../src/components/official-docked-record";

const first = "2026-10-04T01:00:00Z";
function row(
  id: string,
  overrides: Partial<OfficialRecordRow> = {},
): OfficialRecordRow {
  return {
    publicationId: id,
    eventId: "same-event",
    publishedAt: first,
    selection: "DEMO test selection",
    odds: "2.00",
    estimatedEv: "0.1",
    benchmarkStake: "1",
    evidence: "live_published",
    result: "pending",
    netUnits: null,
    settledAt: null,
    correctionCount: 0,
    modelVersion: "test-v1",
    ...overrides,
  };
}
const ready = (
  rows: OfficialRecordRow[],
  start: string | null = first,
): OfficialDockedRecord => ({
  status: "READY",
  officialRecordStart: start,
  rows,
});

test("official record separates genuinely empty from inaccessible and never invents a start date", () => {
  const empty = officialRecordMetrics(ready([], null));
  assert.equal(empty.officialRecordStart, null);
  assert.equal(empty.published, 0);
  for (const key of [
    "netUnits",
    "roi",
    "averagePublishedOdds",
    "averageEstimatedEdge",
    "maximumDrawdown",
    "longestLosingRun",
  ] as const)
    assert.equal(empty[key], null);
  for (const status of [
    "NOT_CONFIGURED",
    "RESTRICTED",
    "UNAVAILABLE",
  ] as const) {
    const hidden = officialRecordMetrics({
      ...ready([row("not-public")]),
      status,
    });
    assert.equal(hidden.published, null);
    assert.equal(hidden.wins, null);
    assert.equal(hidden.netUnits, null);
    assert.deepEqual(hidden.rows, []);
    assert.equal(hidden.officialRecordStart, first);
  }
  assert.equal(officialRecordMetrics(ready([])).officialRecordStart, first);
  const html = renderToStaticMarkup(
    createElement(OfficialRecord, { record: ready([], null) }),
  );
  assert.match(html, /The record has not started yet\./);
  assert.match(html, /We do not reconstruct historical tips\./);
  assert.doesNotMatch(
    renderToStaticMarkup(
      createElement(OfficialRecord, {
        record: { ...ready([], null), status: "RESTRICTED" },
      }),
    ),
    /The record has not started yet/,
  );
});

test("official metrics exclude research, paper and DEMO, retain separate genuine publications of one event", () => {
  const stats = officialRecordMetrics(
    ready([
      row("win", {
        result: "won",
        netUnits: "1",
        settledAt: "2026-10-05T02:00:00Z",
      }),
      row("loss", {
        result: "lost",
        netUnits: "-1",
        settledAt: "2026-10-05T03:00:00Z",
        correctionCount: 1,
      }),
      ...(["demo", "forward_paper", "retrospective_backtest"] as const).map(
        (evidence) =>
          row(evidence, {
            evidence,
            odds: "99",
            result: "won",
            netUnits: "98",
            settledAt: "2026-10-05T01:00:00Z",
          }),
      ),
    ]),
  );
  assert.equal(stats.published, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.netUnits, "0.00");
  assert.equal(stats.roi, "0.00");
  assert.equal(stats.maximumDrawdown, "1.00");
  assert.equal(stats.longestLosingRun, 1);
  assert.equal(stats.rows[1].correctionCount, 1);
  assert.throws(
    () => officialRecordMetrics(ready([row("same"), row("same")])),
    /Duplicate official publication/,
  );
});

test("all published estimates enter averages while voids and unresolved outcomes do not inflate ROI", () => {
  const stats = officialRecordMetrics(
    ready([
      row("won", {
        result: "won",
        odds: "3",
        estimatedEv: "0.2",
        netUnits: "2",
        settledAt: "2026-10-05T01:00:00Z",
      }),
      row("lost", {
        result: "lost",
        odds: "2",
        estimatedEv: "0.1",
        netUnits: "-1",
        settledAt: "2026-10-05T02:00:00Z",
      }),
      row("void", {
        result: "void",
        odds: "4",
        estimatedEv: "0.3",
        netUnits: "0",
        settledAt: "2026-10-05T03:00:00Z",
      }),
      row("pending", { odds: "5", estimatedEv: "0.4" }),
      row("disputed", { result: "disputed", odds: "6", estimatedEv: "0.5" }),
    ]),
  );
  assert.equal(stats.published, 5);
  assert.equal(stats.settled, 3);
  assert.equal(stats.pending, 1);
  assert.equal(stats.disputed, 1);
  assert.equal(stats.netUnits, "1.00");
  assert.equal(stats.roi, "50.00");
  assert.equal(stats.averagePublishedOdds, "4.000");
  assert.equal(stats.averageEstimatedEdge, "30.00");
  assert.deepEqual(stats.months, { "2026-10": "1.00" });
});

test("unknown settlement, estimate or chronology stays unknown instead of zero or a selected-subset average", () => {
  const incomplete = officialRecordMetrics(
    ready([
      row("win", {
        result: "won",
        netUnits: "1",
        settledAt: "2026-10-05T01:00:00Z",
      }),
      row("loss", { result: "lost", estimatedEv: null }),
    ]),
  );
  assert.equal(incomplete.settled, 2);
  assert.equal(incomplete.netUnits, null);
  assert.equal(incomplete.roi, null);
  assert.equal(incomplete.averageEstimatedEdge, null);
  assert.equal(incomplete.maximumDrawdown, null);
  assert.deepEqual(incomplete.curve, []);
  const voids = officialRecordMetrics(
    ready([
      row("v", {
        result: "void",
        netUnits: "0",
        settledAt: "2026-10-05T01:00:00Z",
      }),
    ]),
  );
  assert.equal(voids.netUnits, "0.00");
  assert.equal(voids.roi, null);
  assert.equal(voids.longestLosingRun, null);
  assert.equal(officialRecordMetrics(ready([row("pending")])).netUnits, null);
});

test("official record renders every genuine publication and its immutable provenance, including corrected losses", () => {
  const data = ready([
    row("lost-record", {
      result: "lost",
      netUnits: "-1",
      settledAt: "2026-10-05T01:00:00Z",
      correctionCount: 2,
    }),
    row("pending-record"),
  ]);
  const html = renderToStaticMarkup(
    createElement(OfficialRecord, { record: data }),
  );
  assert.match(html, /href="\/tips\/lost-record"/);
  assert.match(html, /href="\/tips\/pending-record"/);
  assert.match(html, />LOST</);
  assert.match(html, /Avg Published Odds/);
  assert.match(html, /Avg Estimated Edge/);
  assert.match(html, /<time dateTime="2026-10-04T01:00:00Z"/);
});

test("date and model filters preserve the global start and use identical summary/detail populations", () => {
  const record = ready([
    row("old"),
    row("new", {
      publishedAt: "2026-11-01T01:00:00Z",
      modelVersion: "test-v2",
      competition: "example",
    }),
  ]);
  const scoped = officialRecordScope(record, {
    from: "2026-11-01",
    strategy: "test-v2",
    sport: "example",
  });
  assert.equal(scoped.officialRecordStart, first);
  assert.deepEqual(
    scoped.rows.map((item) => item.publicationId),
    ["new"],
  );
  const stats = officialRecordMetrics(scoped);
  assert.equal(stats.published, 1);
  assert.deepEqual(stats.rows, scoped.rows);
  assert.equal(
    officialRecordScope(record, { to: "2020-01-01" }).officialRecordStart,
    first,
  );
});
