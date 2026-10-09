import type { MarketReferenceResult } from "./market-reference";
import type { ProviderTrialHealth } from "./provider-trial-health";

type Diagnostic = ProviderTrialHealth["references"]["diagnostics"][number] & {
  sourceMetricsMeasured?: boolean;
};

/** Legacy preflight sentinels are not observations; keep immutable storage, correct its presentation. */
export function normalizeTrialReferenceDiagnostic(
  value: Diagnostic,
): Diagnostic {
  if (
    value.status === "READY" ||
    (value.status !== "NOT_CONFIGURED" && value.sourceMetricsMeasured === true)
  )
    return value;
  return {
    ...value,
    sourceMetricsMeasured: false,
    availabilityPrice: null,
    availabilitySources: null,
    pricingSources: null,
    eligibleObservations: null,
    excludedObservations: null,
    staleObservations: null,
    outliers: null,
    sourceAgeSeconds: null,
  };
}

/** Only actual loaded source identities may contribute to observation counts. */
export function projectTrialReferenceDiagnostic(input: {
  marketId: string;
  selection: string;
  methodVersion: string;
  observedAt: string;
  result: MarketReferenceResult;
  sourceIds: string[];
  authorityAllowed: boolean;
}): Diagnostic {
  const r = input.authorityAllowed ? input.result.reference : null;
  const ids = new Set(input.sourceIds);
  const rejected = input.result.rejections.filter((x) => ids.has(x.sourceId));
  const measured =
    input.authorityAllowed &&
    input.result.status !== "NOT_CONFIGURED" &&
    (r !== null || rejected.length > 0);
  const count = (reason?: string) =>
    new Set(
      rejected
        .filter((x) => !reason || x.reason.includes(reason))
        .map((x) => x.sourceId),
    ).size;
  return normalizeTrialReferenceDiagnostic({
    marketId: input.marketId,
    selection: input.selection,
    methodVersion: input.methodVersion,
    status:
      !input.authorityAllowed && input.result.status === "READY"
        ? "UNAVAILABLE"
        : input.result.status,
    sourceMetricsMeasured: measured,
    availabilityPrice: r?.decimalPrice ?? null,
    availabilitySources: r?.availability.sourceCount ?? null,
    pricingSources: r?.pricing?.sourceIds.length ?? null,
    eligibleObservations: r
      ? new Set([...r.availability.sourceIds, ...(r.pricing?.sourceIds ?? [])])
          .size
      : null,
    excludedObservations: measured ? count() : null,
    staleObservations: measured ? count("stale") : null,
    outliers: measured ? count("outlier") : null,
    sourceAgeSeconds: r
      ? Math.max(
          0,
          (Date.parse(input.observedAt) - Date.parse(r.sourceAt)) / 1000,
        )
      : null,
  });
}
