// Every event, price and outcome here is fictional software-test input only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  strategyV1,
  validateStrategy,
  hash,
  binaryPrice,
  payoffEV,
} from "../../src/core/pricing";
import { observePublication } from "../../src/core/observations";
import { settle, type Result } from "../../src/core/settlement";
import { quotes, rules, now } from "./fixtures";
import { TheOddsApi, type Mapping } from "../../src/providers/odds-api";
import { PendingResultsProvider } from "../../src/providers/contracts";
import { AuthorisedResultsImport } from "../../src/providers/results";
import {
  replay,
  type HistoricalEvent,
  type Manifest,
} from "../../src/research/replay";
import { validateDataset } from "../../src/research/dataset";
import {
  revalidateBookmakers,
  type BookmakerApproval,
} from "../../src/core/bookmaker-approval";
const startAt = "2026-10-02T12:00:00.000Z";
const input = () => ({ rules, startAt, decisionAt: now, quotes: quotes() });
test("revoked, expired or ownership-changed reference sources cannot continue to qualify an old snapshot", () => {
  const approvals: BookmakerApproval[] = quotes().map((q) => ({
    bookmaker: q.bookmaker,
    operator: q.operator,
    approved: true,
    effectiveFrom: "2026-01-01T00:00:00Z",
    effectiveTo: "2027-01-01T00:00:00Z",
  }));
  const initial = revalidateBookmakers(quotes(), approvals, now);
  assert.equal(
    evaluate({ ...input(), quotes: initial.quotes }).candidates.length,
    1,
  );
  for (const changed of [
    approvals.filter((a) => a.bookmaker !== "ref-a"),
    approvals.map((a) =>
      a.bookmaker === "ref-a" ? { ...a, approved: false } : a,
    ),
    approvals.map((a) =>
      a.bookmaker === "ref-a" ? { ...a, effectiveTo: now } : a,
    ),
    approvals.map((a) =>
      a.bookmaker === "ref-a" ? { ...a, operator: "offer-group" } : a,
    ),
    [...approvals, { ...approvals[1], operator: "conflicting-owner" }],
  ]) {
    const r = revalidateBookmakers(quotes(), changed, now);
    assert.equal(
      evaluate({ ...input(), quotes: r.quotes }).candidates.length,
      0,
    );
    assert.equal(r.rejections.length, 1);
  }
  assert.equal(
    revalidateBookmakers(quotes(), approvals, "invalid").quotes.length,
    0,
  );
});
const result = (): Result => ({
  source: "fictional-outcomes",
  sourceEventId: "fictional-source-event",
  revision: "1",
  authorised: true,
  eventId: rules.eventId,
  status: "final",
  rules,
  scores: { "Fictional A": 100, "Fictional B": 90 },
  observedAt: "2026-10-02T15:00:00.000Z",
});
const events = (): HistoricalEvent[] => [
  {
    rules,
    startAt,
    snapshots: [
      { observedAt: now, quotes: quotes() },
      {
        observedAt: "2026-10-02T06:05:00.000Z",
        quotes: quotes("2026-10-02T06:05:00.000Z"),
      },
    ],
    result: result(),
  },
];
const manifest = (data: HistoricalEvent[]): Manifest => ({
  datasetId: "fictional-phase2",
  evidence: "demo",
  oddsRights: "locally authored fixture",
  resultsRights: "locally authored fixture",
  retentionAllowed: true,
  configHash: hash(strategyV1),
  dataHash: hash(data),
  codeCommit: "fictional-test",
  seed: 42,
  split: "held_out",
  contaminated: true,
  frozenAt: "2026-01-01",
  from: "2026-10-02",
  to: "2026-10-03",
  historicalUniverseEvidence: "fictional operator groups",
  sourceResolutionSeconds: 300,
});
test("ambiguous duplicate offers cannot depend on array ordering", () => {
  const i = input();
  const altered = structuredClone(i.quotes[0]);
  altered.id = "different-id";
  altered.prices["Fictional A"] = "1.8";
  i.quotes.push(altered);
  for (const list of [i.quotes, [...i.quotes].reverse()]) {
    const r = evaluate({ ...i, quotes: list });
    assert.equal(r.candidates.length, 0);
    assert.equal(
      r.rejections.filter((v) => v.reason === "duplicate_quote").length,
      2,
    );
  }
});
test("unknown operator identity and cross-sport market rules fail closed", () => {
  const i = input();
  i.quotes[1].operator = " ";
  assert.equal(evaluate(i).candidates.length, 0);
  assert.equal(
    evaluate({ ...input(), rules: { ...rules, competition: "soccer_epl" } })
      .rejections[0].reason,
    "competition_market_mismatch",
  );
});
test("stored configuration must match supported engine and cannot weaken safety", () => {
  assert.equal(
    validateStrategy({ ...strategyV1, version: "new-version" }).version,
    "new-version",
  );
  for (const change of [
    { minReferences: 1 },
    { maxAgeSeconds: 181 },
    { minEV: "NaN" },
    { method: "unknown" },
    { competitions: ["basketball_nba", "basketball_nba"] },
    { windowsSeconds: [3600, 21600] },
  ])
    assert.throws(() => validateStrategy({ ...strategyV1, ...change }));
  assert.ok(Object.isFrozen(strategyV1.windowsSeconds));
  assert.ok(Object.isFrozen(strategyV1.competitions));
});
test("non-finite payoff, threshold and tick are rejected and report hashes survive JSON", () => {
  assert.throws(() => binaryPrice(".5", "2", "NaN"));
  assert.throws(() => binaryPrice(".5", "2", ".03", "Infinity"));
  assert.throws(() =>
    payoffEV([
      { probability: ".5", netPayoff: "NaN" },
      { probability: ".5", netPayoff: "1" },
    ]),
  );
  const value = { a: 1, b: undefined, nested: [undefined, "x"] };
  assert.equal(hash(value), hash(JSON.parse(JSON.stringify(value))));
});
test("observations before publication or with unknown resolution cannot manufacture availability", () => {
  const i = {
    rules,
    startAt,
    observedAt: now,
    publishedAt: "2026-10-02T06:01:00.000Z",
    selection: "Fictional A",
    bookmaker: "offer",
    minimumOdds: "1.88",
    quotes: quotes(),
    resolutionSeconds: 300,
  };
  assert.equal(observePublication(i), null);
  assert.equal(
    observePublication({ ...i, publishedAt: now, resolutionSeconds: 0 }),
    null,
  );
  assert.equal(observePublication({ ...i, publishedAt: now })?.observedAt, now);
});
function providerPayload() {
  return [
    {
      id: "source-event",
      sport_key: "basketball_nba",
      commence_time: startAt.replace(".000", ""),
      home_team: "Fictional A",
      away_team: "Fictional B",
      bookmakers: quotes().map((q) => ({
        key: q.bookmaker,
        last_update: now,
        markets: [
          {
            key: "h2h",
            outcomes: Object.entries(q.prices).map(([name, price]) => ({
              name,
              price: Number(price),
            })),
          },
        ],
      })),
    },
  ];
}
const mapping: Mapping = {
  events: { "source-event": { rules, startAt } },
  bookmakers: Object.fromEntries(
    quotes().map((q) => [
      q.bookmaker,
      { operator: q.operator, approved: true },
    ]),
  ),
};
function provider(
  raw: unknown,
  headers: Record<string, string> = {
    "x-requests-remaining": "9",
    "x-requests-used": "1",
    "x-requests-last": "1",
  },
) {
  return new TheOddsApi(
    {
      key: "fictional-key-never-transmitted",
      rights: "test-only",
      remaining: 10,
      regions: "au",
      mapping,
      allowPolling: true,
    },
    async () => new Response(JSON.stringify(raw), { headers }),
    () => new Date(now),
  );
}
test("provider matches equivalent timestamp representations and records diagnostics", async () => {
  const r = await provider(providerPayload()).fetch("basketball_nba");
  assert.equal(r.quotes.length, 3);
  assert.equal(r.stats.validMarkets, 3);
  assert.equal(r.stats.eventsReceived, 1);
  assert.equal(r.stats.sourceTimestampAgeSeconds, 0);
  assert.equal(r.lastRequestCost, 1);
});
test("unknown quota stays null and blocks a subsequent network request", async () => {
  const p = provider(providerPayload(), {});
  const r = await p.fetch("basketball_nba");
  assert.equal(r.remaining, null);
  assert.equal(r.used, null);
  assert.equal(r.lastRequestCost, null);
  await assert.rejects(() => p.fetch("basketball_nba"), /Quota/);
});
test("provider rejects mismatched competition and duplicate outcome corruption", async () => {
  const wrong = providerPayload();
  wrong[0].sport_key = "soccer_epl";
  const r = await provider(wrong).fetch("basketball_nba");
  assert.equal(r.quotes.length, 0);
  assert.equal(r.stats.mappingFailures, 1);
  const duplicate = providerPayload();
  duplicate[0].bookmakers[0].markets[0].outcomes.push({
    name: "Fictional A",
    price: 2.1,
  });
  const r2 = await provider(duplicate).fetch("basketball_nba");
  assert.equal(r2.quotes.length, 2);
  assert.ok(r2.stats.errors.includes("incomplete_or_duplicate_outcomes"));
});
test("provider stale markets and missing configuration are explicit", async () => {
  const payload = providerPayload();
  payload[0].bookmakers[0].last_update = "2026-10-02T05:50:00.000Z";
  const r = await provider(payload).fetch("basketball_nba");
  assert.equal(r.stats.staleMarkets, 1);
  assert.equal(r.stats.validMarkets, 2);
  const p = new TheOddsApi(
    {
      key: "",
      rights: "",
      remaining: null,
      regions: "au",
      mapping,
      allowPolling: false,
    },
    async () => {
      throw new Error("must not fetch");
    },
  );
  assert.equal(p.status, "NOT_CONFIGURED");
  await assert.rejects(() => p.fetch("basketball_nba"), /NOT_CONFIGURED/);
});
test("historical response cannot come from after requested time and receipt is not backdated", async () => {
  const future = provider({
    timestamp: "2026-10-02T06:00:01.000Z",
    data: providerPayload(),
  });
  await assert.rejects(() => future.fetch("basketball_nba", now), /look-ahead/);
  const p = new TheOddsApi(
    {
      key: "fixture",
      rights: "fixture",
      remaining: 10,
      regions: "au",
      mapping,
      allowPolling: true,
    },
    async () =>
      new Response(JSON.stringify({ timestamp: now, data: providerPayload() })),
    () => new Date("2026-10-03T06:00:00Z"),
  );
  const r = await p.fetch("basketball_nba", now);
  assert.equal(r.quotes[0].receivedAt, "2026-10-03T06:00:00.000Z");
  assert.ok(r.historicalSnapshotId);
});
test("offset snapshot times cannot bypass as-of ordering", () => {
  const e = events();
  e[0].snapshots = [
    {
      observedAt: "2026-10-02T01:05:00-05:00",
      quotes: quotes("2026-10-02T06:05:00.000Z"),
    },
  ];
  const r = replay(e, manifest(e));
  assert.equal(r.rows.immediate.length, 0);
});
test("import rejects future receipt inside an old snapshot before outcomes are revealed", () => {
  const e = events();
  e[0].snapshots[0].quotes[0].receivedAt = "2026-10-03T06:00:00.000Z";
  const v = validateDataset(e, manifest(e));
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((s) => s.includes("Look-ahead")));
  assert.throws(() => replay(e, manifest(e)), /Look-ahead/);
});
test("delayed entry must retain original minimum price despite revised probability", () => {
  const e = events();
  const q = e[0].snapshots[1].quotes;
  q[0].prices = { "Fictional A": "1.85", "Fictional B": "2.05" };
  q[1].prices = q[2].prices = { "Fictional A": "1.65", "Fictional B": "2.3" };
  const r = replay(e, manifest(e));
  assert.equal(r.rows.immediate.length, 1);
  assert.equal(r.rows.delayed.length, 0);
});
test("closing proxy never selects earlier tips; missing availability remains null", () => {
  const e = events();
  e[0].snapshots.push({
    observedAt: "2026-10-02T11:48:00.000Z",
    quotes: quotes("2026-10-02T11:48:00.000Z"),
  });
  const r = replay(e, manifest(e));
  assert.equal(r.rows.immediate[0].publishedAt, now);
  assert.equal(r.closing.observations.length, 1);
  assert.notEqual(r.immediate.clv, null);
  assert.equal(
    r.availability.targets.find((t) => t.minutes === 15)?.rate,
    null,
  );
  const closeOnly = [{ ...e[0], snapshots: [e[0].snapshots[2]] }];
  assert.equal(replay(closeOnly, manifest(closeOnly)).rows.immediate.length, 0);
});
test("results require separate rights, preserve revisions and leave unavailable outcome pending", async () => {
  const pending = new PendingResultsProvider();
  assert.equal(pending.status, "NOT_CONFIGURED");
  assert.equal(await pending.result(), null);
  const data = [
    result(),
    {
      ...result(),
      revision: "2",
      supersedesRevision: "1",
      observedAt: "2026-10-02T16:00:00.000Z",
      scores: { "Fictional A": 90, "Fictional B": 100 },
    },
  ];
  const authority = {
    provider: "fictional-outcomes",
    rightsReference: "authored fixture only",
    enabled: true,
    allowedEventIds: [rules.eventId],
    dataHash: hash(data),
    reviewedBy: "test",
  };
  assert.throws(
    () =>
      new AuthorisedResultsImport(data, { ...authority, rightsReference: "" }),
    /rights/,
  );
  const p = new AuthorisedResultsImport(data, authority);
  assert.equal(p.revisions(rules.eventId).length, 2);
  assert.equal(
    settle(rules, "Fictional A", (await p.result(rules.eventId, rules))!),
    "lost",
  );
  assert.equal(await p.result("unknown", rules), null);
  const bad = [{ ...data[1], supersedesRevision: undefined }];
  assert.throws(
    () =>
      new AuthorisedResultsImport([...data.slice(0, 1), ...bad], {
        ...authority,
        dataHash: hash([...data.slice(0, 1), ...bad]),
      }),
    /Ambiguous/,
  );
});
test("cancellation, rescheduling and abandoned outcomes do not guess void; ties follow rules", () => {
  for (const status of [
    "cancelled",
    "postponed",
    "rescheduled",
    "abandoned",
  ] as const)
    assert.equal(
      settle(rules, "Fictional A", { ...result(), status }),
      "pending",
    );
  assert.equal(
    settle(rules, "Fictional A", { ...result(), status: "void" }),
    "disputed",
  );
  assert.equal(
    settle(rules, "Fictional A", {
      ...result(),
      status: "void",
      reason: "reviewed fixture cancellation",
      settlementBasis: "test rule",
    }),
    "void",
  );
  assert.equal(
    settle(rules, "Fictional A", {
      ...result(),
      scores: { "Fictional A": 100, "Fictional B": 100 },
    }),
    "disputed",
  );
  assert.equal(
    settle(rules, "Fictional A", {
      ...result(),
      scores: { "Fictional A": 100, "Fictional B": 90, Unknown: 1 },
    }),
    "disputed",
  );
});
