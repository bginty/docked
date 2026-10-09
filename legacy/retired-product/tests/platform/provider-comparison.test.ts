import { test } from "node:test";
import assert from "node:assert/strict";
import { OddsPapi, type OddsPapiMapping } from "../../src/providers/odds-papi";
import {
  compareProviderTrials,
  runProviderTrial,
  type ProviderTrial,
} from "../../src/providers/comparison";
import { hash } from "../../src/core/pricing";
import { rules, now } from "./fixtures";
const mapping: OddsPapiMapping = {
  fixtureId: "fictional-source-event",
  rules,
  startAt: "2026-10-02T07:00:00.000Z",
  sportId: 99,
  tournamentId: 88,
  participant1Id: 11,
  participant2Id: 22,
  marketId: "fictional-market",
  outcomes: { "11": "Fictional A", "22": "Fictional B" },
  mappingEvidence: "test-only reviewed mapping",
  bookmakers: {
    "fixture-book": {
      operator: "fixture-group",
      approved: true,
      ownershipEvidence: "test-only",
    },
  },
};
const options = {
  key: "fictional-test-key",
  rights: "fictional-test-rights",
  allowPolling: true,
  remaining: 3,
  mapping,
  bookmakers: ["fixture-book"],
};
function payload() {
  return {
    fixtureId: mapping.fixtureId,
    participant1Id: 11,
    participant2Id: 22,
    sportId: 99,
    tournamentId: 88,
    statusId: 0,
    startTime: mapping.startAt,
    bookmakerOdds: {
      "fixture-book": {
        bookmakerIsActive: true,
        suspended: false,
        markets: {
          "fictional-market": {
            marketActive: true,
            outcomes: {
              "11": {
                players: {
                  "0": {
                    price: 2,
                    active: true,
                    changedAt: now,
                    bookmakerChangedAt: null,
                    exchangeMeta: null,
                  },
                },
              },
              "22": {
                players: {
                  "0": {
                    price: 1.9,
                    active: true,
                    changedAt: now,
                    exchangeMeta: null,
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
const fake = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
test("OddsPapi trial uses exact canonical mapping, retains unknown quota and never invents standard classification", async () => {
  const provider = new OddsPapi(options, fake(payload()), () => new Date(now));
  const result = await provider.fetch("basketball_nba");
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0].prices["Fictional A"], "2");
  assert.equal(result.remaining, null);
  assert.equal(result.lastRequestCost, 1);
  assert.equal(result.quotes[0].communityMetadata, undefined);
  const missing = payload();
  delete (
    missing.bookmakerOdds["fixture-book"].markets["fictional-market"]
      .outcomes as Record<string, unknown>
  )["22"];
  assert.equal(
    (
      await new OddsPapi(options, fake(missing), () => new Date(now)).fetch(
        "basketball_nba",
      )
    ).quotes.length,
    0,
  );
  const wrong = payload();
  wrong.participant1Id = 999;
  await assert.rejects(
    () =>
      new OddsPapi(options, fake(wrong), () => new Date(now)).fetch(
        "basketball_nba",
      ),
    /mismatch/,
  );
});
test("OddsPapi disabled, unknown/exhausted quota, failure reservation and cooldown never leak keys or make extra calls", async () => {
  let calls = 0;
  let tick = Date.parse(now);
  const fetcher = (async () => {
    calls++;
    throw new Error("private API URL with fake key");
  }) as typeof fetch;
  const missing = new OddsPapi(
    { ...options, key: "" },
    fetcher,
    () => new Date(tick),
  );
  assert.equal(
    (await runProviderTrial(missing, "basketball_nba")).status,
    "NOT_CONFIGURED",
  );
  assert.equal(calls, 0);
  for (const remaining of [0, null])
    await assert.rejects(
      () =>
        new OddsPapi(
          { ...options, remaining },
          fetcher,
          () => new Date(tick),
        ).fetch("basketball_nba"),
      /Quota/,
    );
  const failed = new OddsPapi(
    { ...options, remaining: 1 },
    fetcher,
    () => new Date(tick),
  );
  const trial = await runProviderTrial(failed, "basketball_nba");
  assert.equal(trial.errorCode, "FETCH_FAILED");
  assert.equal(JSON.stringify(trial).includes("fake key"), false);
  tick += 1000;
  await assert.rejects(() => failed.fetch("basketball_nba"), /Quota/);
  assert.equal(calls, 1);
  const quota = await runProviderTrial(
    new OddsPapi(options, fake({}, 429), () => new Date(tick)),
    "basketball_nba",
  );
  assert.equal(quota.status, "QUOTA_BLOCKED");
});
test("OddsPapi historical source chooses last known point before decision, preserving actual retrieval time", async () => {
  const future = "2026-10-02T06:00:01.000Z",
    retrieved = "2026-10-03T06:00:00.000Z";
  const rows = (price: number) => [
    { price, active: true, createdAt: now, exchangeMeta: null },
    { price: 99, active: true, createdAt: future, exchangeMeta: null },
  ];
  const archive = {
    fixtureId: mapping.fixtureId,
    bookmakers: {
      "fixture-book": {
        markets: {
          "fictional-market": {
            outcomes: {
              "11": { players: { "0": rows(2) } },
              "22": { players: { "0": rows(1.9) } },
            },
          },
        },
      },
    },
  };
  const result = await new OddsPapi(
    options,
    fake(archive),
    () => new Date(retrieved),
  ).fetch("basketball_nba", now);
  assert.equal(result.quotes[0].prices["Fictional A"], "2");
  assert.equal(result.quotes[0].receivedAt, retrieved);
  assert.equal(result.snapshotAt, now);
  assert.equal(result.lastRequestCost, 0);
  assert.ok(result.historicalSnapshotId);
  const ambiguous = structuredClone(archive);
  ambiguous.bookmakers["fixture-book"].markets["fictional-market"].outcomes[
    "11"
  ].players["0"].push({
    price: 9,
    active: true,
    createdAt: "2026-10-02T16:00:00.000+10:00",
    exchangeMeta: null,
  });
  const rejected = await new OddsPapi(
    options,
    fake(ambiguous),
    () => new Date(retrieved),
  ).fetch("basketball_nba", now);
  assert.equal(rejected.quotes.length, 0);
  assert.ok(
    rejected.stats.errors.includes(
      "missing_inactive_ambiguous_or_exchange_outcome",
    ),
  );
});
test("comparison distinguishes missing data, actual failures, mapping disagreement, source ages and matched-price outliers", async () => {
  const first = await runProviderTrial(
    new OddsPapi(options, fake(payload()), () => new Date(now)),
    "basketball_nba",
    undefined,
    () => new Date(now),
  );
  const second = structuredClone(first);
  second.provider = "the-odds-api";
  second.result!.quotes[0].prices["Fictional A"] = "2.5";
  const missing = {
    ...structuredClone(first),
    provider: "absent",
    status: "NOT_CONFIGURED" as const,
    result: null,
  };
  const failed = {
    ...structuredClone(first),
    status: "ERROR" as const,
    result: null,
    errorCode: "FETCH_FAILED",
  };
  const report = compareProviderTrials([first, second, missing, failed], {
    eventIds: [rules.eventId, "missing-event"],
    marketKeys: [`${rules.eventId}:${hash(rules)}`],
  });
  assert.equal(
    report.providers.find((p) => p.provider === "oddspapi")!
      .observedErrorFraction,
    0.5,
  );
  assert.equal(
    report.providers.find((p) => p.provider === "absent")!
      .medianSourceAgeSeconds,
    null,
  );
  assert.equal(
    report.providers.find((p) => p.provider === "absent")!
      .observedQuotaConsumed,
    null,
  );
  assert.equal(
    report.providers.find((p) => p.provider === "oddspapi")!.eventCoverage,
    0.5,
  );
  assert.ok(
    report.comparisons.some(
      (c) => c.selection === "Fictional A" && c.outlier === true,
    ),
  );
  second.result!.quotes[0].rules.overtime = false;
  assert.ok(
    compareProviderTrials([first, second], { eventIds: [] }).comparisons.every(
      (c) => !c.mappingAgreement && c.relativeDifference === null,
    ),
  );
  const malformed = { ...first, completedAt: "invalid" } as ProviderTrial;
  assert.throws(() => compareProviderTrials([malformed], { eventIds: [] }));
  assert.equal(compareProviderTrials([], { eventIds: [] }).providers.length, 0);
});
