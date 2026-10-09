// Authored parser fixtures only. No real provider calls, events or performance data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TheOddsApi, type Mapping } from "../../src/providers/odds-api";
import {
  fetchCurrentMarketData,
  fetchTrialEvents,
  fetchTrialScores,
  fetchTrialSports,
  providerFixtures,
} from "../../src/providers/market-data";
import { validateMarketDataConfig } from "../../src/core/market-data";
import { rules, now } from "./fixtures";

const start = "2026-10-02T12:00:00.000Z";
const fixture = () => ({
  id: "fictional-source-event",
  sport_key: "basketball_nba",
  commence_time: start,
  home_team: "Fictional A",
  away_team: "Fictional B",
  bookmakers: [
    {
      key: "fictional-book",
      last_update: now,
      markets: [
        {
          key: "h2h",
          last_update: now as string | undefined,
          outcomes: [
            { name: "Fictional A", price: 1.9 },
            { name: "Fictional B", price: 1.9 },
          ],
        },
      ],
    },
  ],
});
const mapping = (): Mapping => ({
  events: {
    "fictional-source-event": { rules: structuredClone(rules), startAt: start },
  },
  bookmakers: {
    "fictional-book": { operator: "fictional-operator", approved: true },
  },
});
const provider = (payload: unknown, map = mapping(), receivedAt = now) =>
  new TheOddsApi(
    {
      key: "fictional-test-only",
      rights: "Authored fixture rights",
      remaining: 20,
      regions: "au",
      mapping: map,
      allowPolling: true,
    },
    async (_url, init) => {
      assert.equal(init?.redirect, "error");
      return new Response(JSON.stringify(payload));
    },
    () => new Date(receivedAt),
  );
const configuration = () =>
  validateMarketDataConfig({
    version: "market-data-v1.0.0",
    provider: "the-odds-api",
    rights: {
      reference: "Authored fixture rights",
      display: true,
      storage: true,
      derived: true,
      rawRetentionDays: 1,
    },
    monthlyCreditLimit: 10,
    pollIntervalSeconds: 300,
    horizonHours: 24,
    maxEvents: 5,
    maxRequestsPerRun: 1,
    regions: ["au"],
    competitions: [
      {
        providerCompetitionId: "basketball_nba",
        competitionId: "basketball_nba",
        sport: "basketball",
        displayName: "Fictional basketball",
        mappingEvidence: "Authored fixture mapping",
      },
    ],
    bookmakers: {
      "fictional-book": {
        operator: "fictional-operator",
        ownershipEvidence: "Authored ownership fixture",
        sourceType: "bookmaker",
        classification: "UNKNOWN_REVIEW",
        classificationVersion: "unknown",
        classificationEvidence: "No affirmative standard-price evidence",
        knownAt: now,
        effectiveFrom: now,
        effectiveTo: "2026-10-03T06:00:00.000Z",
      },
    },
  });

test("Phase5A returned event counts retain rejected and bounded rows without inventing fixtures", async () => {
  const cfg = configuration();
  cfg.maxEvents = 1;
  const rows = [
    fixture(),
    { ...fixture(), id: "fictional-started", commence_time: now },
    {
      ...fixture(),
      id: "fictional-later",
      commence_time: "2026-10-02T14:00:00Z",
    },
  ];
  const authority = { key: "fictional-test-only", reserve: async () => {} };
  const fetcher = async () => new Response(JSON.stringify(rows));
  const current = await fetchCurrentMarketData(
    cfg,
    authority,
    fetcher,
    () => new Date(now),
  );
  assert.equal(current.stats.eventsReceived, 3);
  assert.equal(current.fixtures.length, 1);
  assert.equal(current.fixtures[0].providerEventId, rows[0].id);
  const catalog = await fetchTrialEvents(
    cfg,
    "basketball_nba",
    authority,
    fetcher,
    () => new Date(now),
  );
  assert.equal(catalog.stats.eventsReceived, 3);
  assert.equal(catalog.fixtures.length, 1);
  assert.equal(catalog.quotes.length, 0);
});

test("Phase5A current observations never borrow refreshed bookmaker time or receipt time", async () => {
  for (const sourceAt of [
    undefined,
    "2026-10-02T05:56:59.000Z",
    "2026-10-02T06:00:01.000Z",
  ]) {
    const e = fixture();
    e.bookmakers[0].markets[0].last_update = sourceAt;
    const value = await provider([e]).fetch("basketball_nba");
    assert.equal(value.quotes.length, 0);
    assert.ok(
      value.stats.errors.includes(
        sourceAt === undefined
          ? "missing_market_source_timestamp"
          : sourceAt > now
            ? "future_source_timestamp"
            : "stale_market",
      ),
    );
    if (sourceAt?.includes("05:56")) assert.equal(value.stats.staleMarkets, 1);
  }
  const e = fixture();
  e.bookmakers[0].last_update = "2026-10-02T05:00:00Z";
  const current = await provider([e]).fetch("basketball_nba");
  assert.equal(current.quotes[0].sourceAt, now);
  assert.equal(current.quotes[0].sourceTimestampKind, "market_observation");
});

test("Phase5A a stopped source clock ages out even when unchanged odds are returned again", async () => {
  const early = await provider(
    [fixture()],
    mapping(),
    "2026-10-02T06:01:00.000Z",
  ).fetch("basketball_nba");
  const late = await provider(
    [fixture()],
    mapping(),
    "2026-10-02T06:03:01.000Z",
  ).fetch("basketball_nba");
  assert.equal(early.quotes[0].sourceAt, now);
  assert.equal(late.quotes.length, 0);
  assert.equal(late.stats.sourceTimestampAgeSeconds, 181);
  assert.equal(late.stats.staleMarkets, 1);
});

test("Phase5A explicit unreviewed lifecycle signals cannot silently become active quotes", async () => {
  for (const level of ["event", "bookmaker", "market", "outcome"] as const) {
    const e = fixture();
    const target =
      level === "event"
        ? e
        : level === "bookmaker"
          ? e.bookmakers[0]
          : level === "market"
            ? e.bookmakers[0].markets[0]
            : e.bookmakers[0].markets[0].outcomes[0];
    Object.assign(target, { suspended: true, status: "closed" });
    const value = await provider([e]).fetch("basketball_nba");
    assert.equal(value.quotes.length, 0, level);
    assert.equal(value.stats.rejectedMarkets, 1, level);
  }
});

test("Phase5A start cutoff and unsupported settlement mappings fail closed in the adapter", async () => {
  for (const startAt of [now, "2026-10-02T05:59:59.000Z"]) {
    const e = fixture(),
      map = mapping();
    e.commence_time = startAt;
    map.events[e.id].startAt = startAt;
    assert.equal(
      (await provider([e], map).fetch("basketball_nba")).quotes.length,
      0,
    );
  }
  for (const changes of [
    { overtime: false },
    { draw: true },
    { line: 1 },
    { period: "first_half" },
    { settlement: "regulation_only" },
    { outcomes: ["Fictional A"] },
  ]) {
    const map = mapping();
    Object.assign(map.events["fictional-source-event"].rules, changes);
    const value = await provider([fixture()], map).fetch("basketball_nba");
    assert.equal(value.quotes.length, 0);
    assert.equal(value.stats.mappingFailures, 1);
  }
});

test("Phase5A a malformed duplicate cannot make an ambiguous provider identity appear unique", async () => {
  const bad = fixture();
  bad.bookmakers[0].markets[0].last_update = "invalid";
  const result = await provider([fixture(), bad]).fetch("basketball_nba");
  assert.equal(result.quotes.length, 0);
  assert.ok(result.stats.errors.includes("event_mapping_rejected"));
  const cfg = configuration();
  bad.commence_time = "invalid";
  assert.throws(
    () => providerFixtures([fixture(), bad], cfg, cfg.competitions[0], now),
    /Duplicate/,
  );
});

test("Phase5A chronological catalog truncation uses instants and excludes start-boundary/status ambiguity", () => {
  const cfg = configuration();
  cfg.maxEvents = 1;
  const earlier = {
    ...fixture(),
    id: "earlier",
    commence_time: "2026-10-02T18:00:00+10:00",
  };
  const later = {
    ...fixture(),
    id: "later",
    commence_time: "2026-10-02T09:00:00Z",
  };
  assert.equal(
    providerFixtures([later, earlier], cfg, cfg.competitions[0], now)[0]
      .providerEventId,
    "earlier",
  );
  assert.deepEqual(
    providerFixtures(
      [{ ...fixture(), commence_time: now }],
      cfg,
      cfg.competitions[0],
      now,
    ),
    [],
  );
  assert.deepEqual(
    providerFixtures(
      [{ ...fixture(), status: "cancelled" }],
      cfg,
      cfg.competitions[0],
      now,
    ),
    [],
  );
});

test("Phase5A legacy historical timestamps remain explicitly labelled without backdating receipt or admitting future snapshots", async () => {
  const e = fixture();
  e.bookmakers[0].markets[0].last_update = undefined;
  const value = await provider(
    { timestamp: now, data: [e] },
    mapping(),
    "2026-10-03T06:00:00.000Z",
  ).fetch("basketball_nba", now);
  assert.equal(value.quotes[0].sourceTimestampKind, "bookmaker_legacy");
  assert.equal(value.quotes[0].snapshotAt, now);
  assert.equal(value.quotes[0].receivedAt, "2026-10-03T06:00:00.000Z");
  await assert.rejects(
    provider({
      timestamp: "2026-10-02T06:00:01.000Z",
      data: [fixture()],
    }).fetch("basketball_nba", now),
    /look-ahead/,
  );
});

test("Phase5A catalog and odds calls are exact scoped, reserve first and persist quota before parsing", async () => {
  const log: string[] = [];
  const sports = await fetchTrialSports(
    {
      key: "fictional-test-only",
      reserve: async (cost, scope) => {
        assert.equal(cost, 0);
        assert.equal(scope, "sports");
        log.push("reserve");
      },
      observeQuota: async (quota) => {
        assert.equal(quota.remaining, 499);
        log.push("quota");
      },
    },
    async (url, init) => {
      assert.equal(new URL(String(url)).pathname, "/v4/sports");
      assert.equal(init?.redirect, "error");
      log.push("request");
      return new Response(
        JSON.stringify([
          {
            key: "basketball_nba",
            group: "Basketball",
            title: "Fictional catalog",
            description: "Authored fixture",
            active: true,
            has_outrights: false,
          },
        ]),
        { headers: { "x-requests-remaining": "499", "x-requests-last": "0" } },
      );
    },
    () => new Date(now),
  );
  assert.deepEqual(log, ["reserve", "request", "quota"]);
  assert.equal(sports.sports[0].hasOutrights, false);
  assert.equal(sports.chargedCredits, 0);
  let eventCalls = 0;
  const events = await fetchTrialEvents(
    configuration(),
    "basketball_nba",
    {
      key: "fictional-test-only",
      reserve: async (cost, scope) => {
        assert.equal(cost, 0);
        assert.equal(scope, "events:basketball_nba");
      },
    },
    async (url) => {
      eventCalls++;
      assert.equal(
        new URL(String(url)).pathname,
        "/v4/sports/basketball_nba/events",
      );
      const { bookmakers: _books, ...e } = fixture();
      return new Response(JSON.stringify([e]));
    },
    () => new Date(now),
  );
  assert.equal(eventCalls, 1);
  assert.equal(events.fixtures.length, 1);
  assert.equal(events.quotes.length, 0);
  assert.equal(events.remaining, null);
  const odds = await fetchCurrentMarketData(
    configuration(),
    {
      key: "fictional-test-only",
      reserve: async (cost, scope) => {
        assert.equal(cost, 1);
        assert.equal(scope, "odds:basketball_nba");
      },
    },
    async () => new Response(JSON.stringify([fixture()])),
    () => new Date(now),
  );
  assert.equal(odds.quotes[0].communityMetadata?.priceClass, "UNKNOWN_REVIEW");
});

test("Phase5A catalog denial has no request, errors report quota, and invalid bodies stay bounded", async () => {
  let calls = 0;
  await assert.rejects(
    fetchTrialSports(
      {
        key: "fictional-test-only",
        reserve: async () => {
          throw Error("rights denied");
        },
      },
      async () => {
        calls++;
        return new Response("[]");
      },
    ),
    /rights denied/,
  );
  assert.equal(calls, 0);
  let observed = false;
  await assert.rejects(
    fetchTrialSports(
      {
        key: "fictional-test-only",
        reserve: async () => {},
        observeQuota: async (q) => {
          observed = true;
          assert.equal(q.remaining, 0);
        },
      },
      async () =>
        new Response("denied", {
          status: 429,
          headers: { "x-requests-remaining": "0" },
        }),
    ),
    /HTTP 429/,
  );
  assert.equal(observed, true);
  await assert.rejects(
    fetchTrialSports(
      { key: "fictional-test-only", reserve: async () => {} },
      async () =>
        new Response("[]", { headers: { "content-length": "8000001" } }),
    ),
    /bounded import size/,
  );
  await assert.rejects(
    fetchTrialSports(
      { key: "fictional-test-only", reserve: async () => {} },
      async () => new Response("invalid"),
    ),
    /Invalid market data provider payload/,
  );
  const cfg = configuration();
  cfg.competitions[0].providerCompetitionId = "soccer_epl";
  await assert.rejects(
    fetchCurrentMarketData(cfg, {
      key: "fictional-test-only",
      reserve: async () => {
        calls++;
      },
    }),
    /identity mismatch/,
  );
  assert.equal(calls, 0);
});

test("Phase5A scores inspection reserves two credits and never claims settlement readiness", async () => {
  const log: string[] = [];
  const payload = [
    {
      id: "fictional-source-event",
      sport_key: "basketball_nba",
      commence_time: "2026-10-01T01:00:00Z",
      completed: true,
      home_team: "Fictional A",
      away_team: "Fictional B",
      scores: [
        { name: "Fictional A", score: "100" },
        { name: "Fictional B", score: "90" },
      ],
      last_update: now,
    },
  ];
  const value = await fetchTrialScores(
    "basketball_nba",
    {
      key: "fictional-test-only",
      reserve: async (cost, scope) => {
        assert.equal(cost, 2);
        assert.equal(scope, "scores:basketball_nba");
        log.push("reserve");
      },
      observeQuota: async (quota) => {
        assert.equal(quota.reservedCost, 2);
        log.push("quota");
      },
    },
    async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, "/v4/sports/basketball_nba/scores");
      assert.equal(parsed.searchParams.get("daysFrom"), "3");
      log.push("request");
      return new Response(JSON.stringify(payload));
    },
    () => new Date(now),
  );
  assert.deepEqual(log, ["reserve", "request", "quota"]);
  assert.equal(value.chargedCredits, 2);
  assert.equal(value.remaining, null);
  assert.equal(value.scores[0].completed, true);
  assert.equal(value.settlementReady, false);
  let calls = 0;
  await assert.rejects(
    fetchTrialScores("unreviewed_sport", {
      key: "fictional-test-only",
      reserve: async () => {
        calls++;
      },
    }),
    /Unsupported/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    fetchTrialScores(
      "basketball_nba",
      { key: "fictional-test-only", reserve: async () => {} },
      async () =>
        new Response(
          JSON.stringify([
            {
              ...payload[0],
              scores: [
                { name: "Fictional A", score: "100" },
                { name: "Fictional A", score: "90" },
              ],
            },
          ]),
        ),
    ),
    /Invalid provider scores/,
  );
});
