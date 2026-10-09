/** Staff-only, credential-free projection. No raw response or request URL is exposed. */
export type ProviderTrialHealth = {
  provider: "the-odds-api";
  status:
    | "NOT_CONFIGURED"
    | "READY_MANUAL"
    | "PAUSED"
    | "QUOTA_EXHAUSTED"
    | "UNAVAILABLE";
  ledgerAvailable: boolean;
  rights: {
    state:
      | "PENDING_RIGHTS"
      | "APPROVED_FOR_PREVIEW_TRIAL"
      | "REQUIRES_CLARIFICATION"
      | "NOT_PERMITTED"
      | "REVOKED"
      | "EXPIRED";
    reviewedAt: string | null;
    nextReviewAt: string | null;
    reviewer: string | null;
    evidenceLinks: string[];
  };
  pollingEnabled: boolean;
  productionApproved: false;
  requests: {
    attempted: number | null;
    successful: number | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastErrorCode: string | null;
  };
  quota: {
    trialCap: number | null;
    reservedTotal: number | null;
    reportedTotal: number | null;
    providerRemaining: number | null;
    utcDate: string | null;
    reservedToday: number | null;
    reportedToday: number | null;
  };
  /** Null until a completed observation has measured these values. */
  latestBatch: null | {
    observedAt: string;
    events: number | null;
    markets: number | null;
    sources: number | null;
    freshQuotes: number | null;
    staleQuotes: number | null;
    mappingFailures: number | null;
    timestampAnomalies: number | null;
    suspendedMarkets: number | null;
    providerErrors: number | null;
  };
  references: {
    observedAt: string | null;
    evaluated: number | null;
    availabilityReady: number | null;
    pricingReady: number | null;
    diagnostics: {
      marketId: string;
      selection: string;
      status: "READY" | "UNAVAILABLE" | "NOT_CONFIGURED";
      methodVersion: string | null;
      availabilityPrice: string | null;
      availabilitySources: number | null;
      pricingSources: number | null;
      eligibleObservations: number | null;
      excludedObservations: number | null;
      staleObservations: number | null;
      outliers: number | null;
      sourceAgeSeconds: number | null;
    }[];
  };
  historical: {
    status:
      "UNKNOWN" | "NOT_TESTED" | "AVAILABLE" | "NOT_INCLUDED" | "UNAVAILABLE";
    checkedAt: string | null;
    earliestObservedAt: string | null;
    snapshotIntervalSeconds: number | null;
    sampleCreditCost: number | null;
  };
  /** At most 20 retained canonical fixtures, read only after the staff/MFA gate. */
  fixtures?: {
    eventId: string;
    eventLabel: string;
    sport: string;
    competition: string;
    startAt: string;
    status: string;
  }[];
};

/** Zero is displayed only when it is a measured, finite nonnegative value. */
export function trialMetric(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? String(value)
    : "Unknown";
}

export function trialRequestDescription(health: ProviderTrialHealth): string {
  if (!health.ledgerAvailable || health.requests.attempted === null)
    return "Request history unavailable. No request or credit total is inferred.";
  return health.requests.attempted === 0
    ? "No request is recorded in the trial ledger. Account quota has not been inferred."
    : "Recorded manual trial attempts; reservations can exceed provider-reported charges.";
}

/** Review links are documentation, never credential-bearing provider URLs. */
export function trialEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["the-odds-api.com", "www.the-odds-api.com"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search
      ? url.href
      : null;
  } catch {
    return null;
  }
}
