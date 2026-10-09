import type { ProviderTrialHealth } from "../../src/core/provider-trial-health";

/** Synthetic presentation data only. Never imported by an application path. */
export function trialHealthFixture(
  mode: "pending" | "approved" | "measured" | "unavailable" = "pending",
): ProviderTrialHealth {
  const base: ProviderTrialHealth = {
    provider: "the-odds-api",
    status: "PAUSED",
    ledgerAvailable: mode !== "unavailable",
    rights: {
      state: "PENDING_RIGHTS",
      reviewedAt: null,
      nextReviewAt: null,
      reviewer: null,
      evidenceLinks: [],
    },
    pollingEnabled: false,
    productionApproved: false,
    requests: {
      attempted: mode === "unavailable" ? null : 0,
      successful: mode === "unavailable" ? null : 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
    },
    quota: {
      trialCap: null,
      reservedTotal: null,
      reportedTotal: null,
      providerRemaining: null,
      utcDate: null,
      reservedToday: null,
      reportedToday: null,
    },
    latestBatch: null,
    references: {
      observedAt: null,
      evaluated: null,
      availabilityReady: null,
      pricingReady: null,
      diagnostics: [],
    },
    historical: {
      status: "UNKNOWN",
      checkedAt: null,
      earliestObservedAt: null,
      snapshotIntervalSeconds: null,
      sampleCreditCost: null,
    },
  };
  if (mode === "unavailable") return { ...base, status: "UNAVAILABLE" };
  if (mode === "pending") return base;
  base.rights = {
    state: "APPROVED_FOR_PREVIEW_TRIAL",
    reviewedAt: "2026-10-04T00:00:00Z",
    nextReviewAt: "2026-11-04T00:00:00Z",
    reviewer: "ISOLATED DEMO reviewer",
    evidenceLinks: ["https://the-odds-api.com/terms-and-conditions.html"],
  };
  base.status = "READY_MANUAL";
  base.quota = {
    ...base.quota,
    trialCap: 250,
    reservedTotal: 0,
    reportedTotal: 0,
    utcDate: "2026-10-04",
    reservedToday: 0,
    reportedToday: 0,
  };
  base.historical.status = "NOT_TESTED";
  if (mode === "approved") return base;
  const at = "2026-10-04T00:15:00Z";
  base.requests = {
    attempted: 2,
    successful: 1,
    lastSuccessAt: at,
    lastFailureAt: "2026-10-04T00:16:00Z",
    lastErrorCode: "DEMO_QUOTA_EXHAUSTED",
  };
  base.status = "QUOTA_EXHAUSTED";
  base.quota = {
    ...base.quota,
    reservedTotal: 4,
    reportedTotal: 2,
    reservedToday: 4,
    reportedToday: 2,
    providerRemaining: 0,
  };
  base.latestBatch = {
    observedAt: at,
    events: 1,
    markets: 1,
    sources: 3,
    freshQuotes: 2,
    staleQuotes: 1,
    mappingFailures: 0,
    timestampAnomalies: null,
    suspendedMarkets: 0,
    providerErrors: 0,
  };
  base.references = {
    observedAt: at,
    evaluated: 1,
    availabilityReady: 0,
    pricingReady: 0,
    diagnostics: [
      {
        marketId: `DEMO-market-${"abcdef0123456789".repeat(4)}`,
        selection: "DEMO selection",
        status: "UNAVAILABLE",
        methodVersion: "DEMO-reference-v1",
        availabilityPrice: null,
        availabilitySources: 1,
        pricingSources: 1,
        eligibleObservations: 2,
        excludedObservations: 1,
        staleObservations: 1,
        outliers: 0,
        sourceAgeSeconds: 200,
      },
    ],
  };
  base.fixtures = [
    {
      eventId: "DEMO-canonical-event",
      eventLabel: "DEMO Harbour vs DEMO City",
      sport: "football",
      competition: "DEMO competition",
      startAt: "2026-10-04T20:00:00Z",
      status: "scheduled",
    },
  ];
  return base;
}
