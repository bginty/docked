import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMarketDataConfig,
  monitoredWindow,
} from "../../src/core/market-data";
import { marketDataEnvironment } from "../../src/core/market-data-environment";
import {
  assertHostedPreview,
  hostedPreviewDisabledFlags,
} from "../../src/core/hosted-preview";
import { previewCommunityFeature } from "../../src/core/preview-community";
import { oddsApiCredential } from "../../src/providers/credentials";
import {
  fetchCurrentMarketData,
  providerFixtures,
  fixtureRules,
} from "../../src/providers/market-data";
import { MarketBaselineModel } from "../../src/providers/model";
import { marketEditorialDraft } from "../../src/core/market-editorial";
import type { MonitoredMarkets } from "../../src/core/market-data";
import { buildMarketReference } from "../../src/core/market-reference";
import { referenceConfig, referenceInput } from "./market-reference-fixtures";

// Authored parser/clock fixtures only; no actual event, provider request or performance claim.
const at = "2026-10-04T00:00:00.000Z",
  start = "2026-10-04T06:00:00.000Z";

test("editorial draft retains bounded source provenance and never turns missing data into a story or publication", () => {
  const data: MonitoredMarkets = {
    status: "READY",
    message: "Fictional parser fixture",
    provider: "the-odds-api",
    observedAt: at,
    configurationReference: {
      version: "market-data-v1.0.0",
      hash: "a".repeat(64),
    },
    window: "weekend",
    from: at,
    to: start,
    timezone: "UTC",
    events: [
      {
        eventId: "fixture-only",
        eventLabel: "Fictional A vs Fictional B",
        sport: "basketball",
        competition: "Authored fixture competition",
        startAt: start,
        status: "scheduled",
        markets: [],
      },
    ],
  };
  const draft = marketEditorialDraft(data);
  assert.ok(draft);
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.autoPublication, false);
  assert.equal(draft.coverage, "BOUNDED_MONITORED_SUBSET");
  assert.equal(draft.displayedSubsetCount, 1);
  assert.deepEqual(draft.eventIds, ["fixture-only"]);
  assert.deepEqual(draft.configurationReference, data.configurationReference);
  assert.equal(draft.asOf, at);
  assert.match(draft.body, /not a count of every fixture/);
  assert.equal(marketEditorialDraft({ ...data, status: "UNAVAILABLE" }), null);
  assert.equal(marketEditorialDraft({ ...data, events: [] }), null);
  assert.equal(
    marketEditorialDraft({ ...data, configurationReference: undefined }),
    null,
  );
});
const configuration = () =>
  validateMarketDataConfig({
    version: "market-data-v1.0.0",
    provider: "the-odds-api",
    rights: {
      reference: "Authored fixture rights only",
      display: true,
      storage: true,
      derived: true,
      rawRetentionDays: 1,
    },
    monthlyCreditLimit: 10,
    pollIntervalSeconds: 300,
    horizonHours: 168,
    maxEvents: 5,
    maxRequestsPerRun: 2,
    regions: ["au"],
    competitions: [
      {
        providerCompetitionId: "basketball_nba",
        competitionId: "basketball_nba",
        sport: "basketball",
        displayName: "Fictional NBA parser example",
        mappingEvidence: "Authored mapping fixture",
      },
    ],
    bookmakers: {
      example: {
        operator: "fictional-operator",
        ownershipEvidence: "Authored ownership fixture",
        sourceType: "bookmaker",
        classification: "UNKNOWN_REVIEW",
        classificationVersion: "unreviewed",
        classificationEvidence: "No affirmative provider standard evidence",
        knownAt: at,
        effectiveFrom: at,
        effectiveTo: "2026-10-05T00:00:00.000Z",
      },
    },
  });
const payload = () => [
  {
    id: "fictional-event",
    sport_key: "basketball_nba",
    commence_time: start,
    home_team: "Fictional A",
    away_team: "Fictional B",
    bookmakers: [
      {
        key: "example",
        markets: [
          {
            key: "h2h",
            last_update: at,
            outcomes: [
              { name: "Fictional A", price: 1.9 },
              { name: "Fictional B", price: 1.9 },
            ],
          },
        ],
      },
    ],
  },
];
test("current data adapter reserves before its one actual request and reuses canonical quote checks without inventing standard classification", async () => {
  const log: string[] = [];
  const cfg = configuration();
  const result = await fetchCurrentMarketData(
    cfg,
    {
      key: "fictional-only",
      reserve: async (cost) => {
        assert.equal(cost, 1);
        log.push("reserve");
      },
    },
    async (input) => {
      log.push("network");
      const url = new URL(String(input));
      assert.equal(url.hostname, "api.the-odds-api.com");
      assert.equal(url.searchParams.get("markets"), "h2h");
      return new Response(JSON.stringify(payload()), {
        headers: { "x-requests-remaining": "9" },
      });
    },
    () => new Date(at),
  );
  assert.deepEqual(log, ["reserve", "network"]);
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.quotes.length, 1);
  assert.equal(
    result.quotes[0].communityMetadata?.priceClass,
    "UNKNOWN_REVIEW",
  );
  assert.equal(result.quotes[0].rawPayloadId, result.rawRecords[0].id);
  assert.equal(
    result.fixtureEvidence["fictional-event"],
    result.rawRecords[0].id,
  );
  assert.equal(result.remaining, 9);
  assert.equal(result.used, null);
});
test("unknown budget rejection and provider failures cannot bypass the durable reservation boundary", async () => {
  let calls = 0,
    reservations = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw Error("network failure includes no printed credential");
  };
  await assert.rejects(
    fetchCurrentMarketData(
      configuration(),
      {
        key: "fictional-only",
        reserve: async () => {
          throw Error("budget exhausted");
        },
      },
      fetcher,
    ),
    /budget exhausted/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    fetchCurrentMarketData(
      configuration(),
      {
        key: "fictional-only",
        reserve: async () => {
          reservations++;
        },
      },
      fetcher,
    ),
    /provider unavailable/,
  );
  assert.equal(calls, 1);
  assert.equal(reservations, 1);
});
test("catalog rejects duplicates and mismatches, preserves unsupported NFL as facts without a pricing strategy", () => {
  const cfg = configuration();
  assert.throws(
    () =>
      providerFixtures(
        [...payload(), ...payload()],
        cfg,
        cfg.competitions[0],
        at,
      ),
    /Duplicate/,
  );
  const wrong = payload();
  wrong[0].sport_key = "soccer_epl";
  assert.equal(providerFixtures(wrong, cfg, cfg.competitions[0], at).length, 0);
  const nfl = validateMarketDataConfig({
    ...cfg,
    competitions: [
      {
        ...cfg.competitions[0],
        competitionId: "americanfootball_nfl",
        providerCompetitionId: "americanfootball_nfl",
        sport: "nfl",
      },
    ],
  });
  const raw = payload();
  raw[0].sport_key = "americanfootball_nfl";
  const fixtures = providerFixtures(raw, nfl, nfl.competitions[0], at);
  assert.equal(fixtures.length, 1);
  assert.equal(fixtureRules(fixtures[0]), null);
});

test("each authoritative quota response is persisted before another request, including error responses", async () => {
  const cfg = configuration();
  cfg.competitions.push({
    ...cfg.competitions[0],
    providerCompetitionId: "soccer_epl",
    competitionId: "soccer_epl",
    sport: "football",
  });
  const log: string[] = [];
  await assert.rejects(
    fetchCurrentMarketData(
      cfg,
      {
        key: "fictional-only",
        reserve: async () => {
          log.push("reserved");
        },
        observeQuota: async (quota) => {
          assert.equal(quota.remaining, 0);
          log.push("quota persisted");
        },
      },
      async () => {
        log.push("network");
        return new Response(JSON.stringify(payload()), {
          headers: { "x-requests-remaining": "0" },
        });
      },
      () => new Date(at),
    ),
    /quota exhausted/,
  );
  assert.deepEqual(log, ["reserved", "network", "quota persisted"]);
  let observed = false;
  await assert.rejects(
    fetchCurrentMarketData(
      configuration(),
      {
        key: "fictional-only",
        reserve: async () => {},
        observeQuota: async (q) => {
          assert.equal(q.remaining, 0);
          observed = true;
        },
      },
      async () =>
        new Response("Unavailable", {
          status: 429,
          headers: { "x-requests-remaining": "0" },
        }),
    ),
    /HTTP 429/,
  );
  assert.equal(observed, true);
});
test("missing and future market observations do not become current quotes; expired ownership cannot normalize a quote", async () => {
  for (const kind of ["missing", "future", "expired"]) {
    const cfg = configuration(),
      raw = payload();
    if (kind === "missing")
      delete (raw[0].bookmakers[0].markets[0] as { last_update?: string })
        .last_update;
    if (kind === "future")
      raw[0].bookmakers[0].markets[0].last_update = "2026-10-04T00:00:01.000Z";
    if (kind === "expired") {
      cfg.bookmakers.example.effectiveFrom = "2026-10-03T00:00:00Z";
      cfg.bookmakers.example.effectiveTo = at;
    }
    const result = await fetchCurrentMarketData(
      cfg,
      { key: "fictional-only", reserve: async () => {} },
      async () => new Response(JSON.stringify(raw)),
      () => new Date(at),
    );
    assert.equal(result.quotes.length, 0, kind);
  }
});
test("same unchanged payload received later has distinct retained observation identity", async () => {
  const run = (time: string) =>
    fetchCurrentMarketData(
      configuration(),
      { key: "fictional-only", reserve: async () => {} },
      async () => new Response(JSON.stringify(payload())),
      () => new Date(time),
    );
  const first = await run(at),
    later = await run("2026-10-04T00:00:01.000Z");
  assert.notEqual(first.rawRecords[0].id, later.rawRecords[0].id);
});

test("OddsPapi discovery remains fixture-only without reviewed market/outcome mapping and never treats fixture updatedAt as a quote", async () => {
  const cfg = validateMarketDataConfig({
    ...configuration(),
    provider: "odds-papi",
    competitions: [
      {
        ...configuration().competitions[0],
        providerCompetitionId: "123",
        providerSportId: 11,
      },
    ],
  });
  let reservations = 0,
    calls = 0;
  const raw = [
    {
      fixtureId: "fictional-papi",
      participant1Id: 1,
      participant2Id: 2,
      sportId: 11,
      tournamentId: 123,
      statusId: 0,
      startTime: start,
      updatedAt: at,
      participant1Name: "Fictional A",
      participant2Name: "Fictional B",
      hasOdds: true,
    },
  ];
  const result = await fetchCurrentMarketData(
    cfg,
    {
      key: "fictional-only",
      reserve: async () => {
        reservations++;
      },
    },
    async (input) => {
      calls++;
      assert.equal(new URL(String(input)).pathname, "/v4/fixtures");
      return new Response(JSON.stringify(raw));
    },
    () => new Date(at),
  );
  assert.equal(calls, 1);
  assert.equal(reservations, 1);
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.quotes.length, 0);
  assert.equal(result.remaining, null);
  assert.equal(result.stats.sourceTimestampAgeSeconds, null);
  raw[0].updatedAt = "2026-10-04T00:00:01.000Z";
  assert.equal(providerFixtures(raw, cfg, cfg.competitions[0], at).length, 0);
});
test("provider aliases refuse conflicting values and preview market data cannot open legacy publication or unrelated projects", () => {
  assert.equal(oddsApiCredential({}), undefined);
  assert.equal(
    oddsApiCredential({ ODDS_API_KEY: "a", THE_ODDS_API_KEY: "a" }),
    "a",
  );
  assert.throws(
    () => oddsApiCredential({ ODDS_API_KEY: "a", THE_ODDS_API_KEY: "b" }),
    /Conflicting/,
  );
  const env = {
    DOCKED_HOSTED_PREVIEW: "true",
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    VERCEL_ENV: "preview",
    SITE_URL: "https://docked-preview-s24-briant-ginty.vercel.app",
    NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    DATABASE_URL:
      "postgres://postgres.bckkllmndoxzpzdqrevb:fictional@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
    DATABASE_CONNECTION_MODE: "session",
    MARKET_DATA_PROJECT_REF: "bckkllmndoxzpzdqrevb",
    MARKET_DATA_PROVIDER: "the-odds-api",
    MARKET_DATA_POLLING_ENABLED: "true",
    ...Object.fromEntries(hostedPreviewDisabledFlags.map((k) => [k, "false"])),
  };
  assert.equal(marketDataEnvironment(env), true);
  assert.doesNotThrow(() => assertHostedPreview(env));
  assert.equal(previewCommunityFeature("market_data"), false);
  for (const change of [
    { APP_ENV: "production" },
    { VERCEL_ENV: "production" },
    { MARKET_DATA_PROJECT_REF: "unrelated" },
    { SITE_URL: "https://docked.com.au" },
    { PUBLICATION_ENABLED: "true" },
    { FORWARD_PAPER_ENABLED: "true" },
    { SENDING_ENABLED: "true" },
    { ODDS_API_KEY: "legacy" },
  ]) {
    assert.equal(marketDataEnvironment({ ...env, ...change }), false);
    assert.throws(() => assertHostedPreview({ ...env, ...change }));
  }
  assert.doesNotThrow(() =>
    assertHostedPreview({
      ...env,
      MARKET_DATA_POLLING_ENABLED: "false",
      THE_ODDS_API_KEY: "fixture",
    }),
  );
});
test("watchlist windows are explicit UTC and weekend boundaries do not invent fixture dates", () => {
  assert.deepEqual(
    monitoredWindow("weekend", new Date("2026-10-04T12:00:00Z")),
    {
      from: "2026-10-04T12:00:00.000Z",
      to: "2026-10-05T00:00:00.000Z",
      timezone: "UTC",
    },
  );
  assert.equal(
    monitoredWindow("weekend", new Date("2026-10-05T12:00:00Z")).from,
    "2026-10-10T00:00:00.000Z",
  );
});
test("baseline model exactly reuses shared reference probability and retains research-only provenance", () => {
  const input = referenceInput(),
    shared = buildMarketReference(input, referenceConfig),
    model = new MarketBaselineModel(referenceConfig),
    request = {
      ...input,
      asOfTime: input.observedAt,
      generatedAt: input.observedAt,
      codeCommit: "a".repeat(40),
    };
  const result = model.estimate(request);
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(result.probability, shared.reference?.pricing?.probability);
  assert.equal(result.referenceHash, shared.reference?.evidenceHash);
  assert.equal(result.advantageClaim, false);
  assert.equal(result.validationStatus, "UNVALIDATED");
  assert.equal(result.uncertainty, null);
  assert.deepEqual(model.estimate(request), result);
  assert.equal(
    model.estimate({ ...request, asOfTime: "invalid" }).status,
    "UNAVAILABLE",
  );
  assert.equal(
    model.estimate({ ...request, generatedAt: "2025-01-01T00:00:00Z" }).status,
    "UNAVAILABLE",
  );
  assert.equal(
    model.estimate({ ...request, codeCommit: "unknown" }).status,
    "UNAVAILABLE",
  );
  const future = structuredClone(request);
  for (const q of future.sources)
    q.receivedAt = new Date(Date.parse(input.observedAt) + 1000).toISOString();
  assert.equal(model.estimate(future).status, "UNAVAILABLE");
});
