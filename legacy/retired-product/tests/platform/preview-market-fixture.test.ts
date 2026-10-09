import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPreviewFixture,
  assertPreviewReviewFresh,
  previewFixtureOptions,
} from "../../src/core/preview-market-fixture";
import { buildMarketReference } from "../../src/core/market-reference";
import {
  previewSubmitInput,
  previewPriceLabel,
} from "../../src/core/preview-market-contracts";
import { communityPerformance } from "../../src/core/top-docked";
import {
  weekendWatchlistSchema,
  visibleWeekendWatchlist,
  weekendWatchlist,
} from "../../src/content/weekend-watchlist";
import { hash } from "../../src/core/pricing";
const at = "2026-10-03T12:00:00.123Z",
  id = "b0000000-0000-4000-8000-000000000001";
const built = () =>
  buildPreviewFixture(
    { fixtureId: "demo-football", selection: "DEMO Harbour FC" },
    id,
    at,
  );

test("preview fixture uses the existing independent reference engine and cannot become current provider evidence", () => {
  const { payload, review } = built();
  const normal = buildMarketReference(
    {
      rules: payload.rules,
      startAt: payload.startAt,
      observedAt: at,
      selection: payload.selection,
      sources: payload.sources,
      evidenceMode: "research",
    },
    payload.configuration,
  );
  assert.equal(normal.status, "READY");
  assert.equal(review.reference.decimalPrice, normal.reference!.decimalPrice);
  assert.equal(review.reference.decimalPrice, "2.08");
  assert.equal(review.reference.evidenceMode, "preview");
  assert.equal(review.reference.fixture, true);
  assert.equal(review.label, previewPriceLabel);
  assert.equal(review.reviewToken, hash(payload));
  assert.equal(
    buildMarketReference(
      {
        rules: payload.rules,
        startAt: payload.startAt,
        observedAt: at,
        selection: payload.selection,
        sources: payload.sources,
      },
      payload.configuration,
    ).status,
    "UNAVAILABLE",
  );
  for (const option of previewFixtureOptions)
    for (const selection of option.selections)
      assert.equal(
        buildPreviewFixture({ fixtureId: option.id, selection }, id, at).review
          .label,
        previewPriceLabel,
      );
});
test("preview confirmation binds the saved reference and expires without accepting arbitrary odds, keys or selection", () => {
  const { review } = built();
  assert.doesNotThrow(() =>
    assertPreviewReviewFresh(review, Date.parse(at) + 89999),
  );
  for (const time of [Date.parse(at) - 1, Date.parse(at) + 90000, NaN])
    assert.throws(() => assertPreviewReviewFresh(review, time));
  const input = {
    reviewId: id,
    reviewToken: review.reviewToken,
    idempotencyKey: id,
    confirmed: true,
  };
  assert.equal(previewSubmitInput.safeParse(input).success, true);
  for (const unsafe of [
    { ...input, confirmed: false },
    { ...input, odds: "99.00" },
    { ...input, provider: "live" },
    { ...input, reviewToken: "short" },
  ])
    assert.equal(previewSubmitInput.safeParse(unsafe).success, false);
  assert.throws(() =>
    buildPreviewFixture(
      { fixtureId: "demo-football", selection: "A genuine team" },
      id,
      at,
    ),
  );
  assert.throws(
    () =>
      communityPerformance([
        {
          id,
          profileId: id,
          submittedAt: at,
          startAt: review.startAt,
          sport: "football",
          odds: review.reference.decimalPrice,
          units: "1.00",
          classification: "STANDARD_VERIFIED",
          ruleVersion: "community-market-reference-v2",
          verified: true,
          demo: true,
          official: false,
          integrityClear: true,
          result: "PENDING",
          settledAt: null,
          settlementId: null,
        },
      ]),
    /canonical eligible/,
  );
});
const editorial = {
  kind: "weekend_watchlist",
  version: 1,
  id: "DEMO-editorial-test",
  event: "FICTIONAL test event",
  sport: "football",
  startAt: "2026-10-04T12:00:00Z",
  whyWatch: "Fictional test explanation with no current sporting claim.",
  informationToEvaluate:
    "Review matching rules, confirmed team news and source timestamps.",
  status: "published",
  publishedAt: "2026-10-03T11:00:00Z",
  expiresAt: "2026-10-04T12:00:00Z",
  source: {
    kind: "owner_approved_manual",
    reference: "FICTIONAL local regression source",
    url: "https://example.invalid/fixture",
    authorizationReference: "FICTIONAL authorised local regression",
    reviewedBy: "DEMO reviewer",
    reviewedAt: "2026-10-03T10:00:00Z",
    observedAt: "2026-10-03T09:00:00Z",
  },
  corrections: [],
};
test("watchlist requires current reviewed factual provenance and cannot include official pricing fields", () => {
  assert.deepEqual(weekendWatchlist, []);
  assert.equal(visibleWeekendWatchlist([editorial], Date.parse(at)).length, 1);
  for (const name of ["estimatedEV", "minimumPrice", "dockedFairPrice", "odds"])
    assert.equal(
      weekendWatchlistSchema.safeParse({ ...editorial, [name]: "2.00" })
        .success,
      false,
    );
  for (const invalid of [
    { ...editorial, source: undefined },
    { ...editorial, status: "draft" },
    { ...editorial, expiresAt: at },
    {
      ...editorial,
      source: { ...editorial.source, reviewedAt: "2026-10-04T00:00:00Z" },
    },
    {
      ...editorial,
      source: { ...editorial.source, observedAt: "2026-09-01T00:00:00Z" },
    },
  ])
    assert.equal(visibleWeekendWatchlist([invalid], Date.parse(at)).length, 0);
});
