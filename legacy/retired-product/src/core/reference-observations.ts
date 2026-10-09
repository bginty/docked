import { binaryPrice } from "./pricing";
import {
  buildMarketReference,
  type MarketReferenceConfig,
  type MarketReferenceInput,
} from "./market-reference";
import {
  referenceEdgeStatus,
  type ReferenceEdgeStatus,
} from "./reference-pricing";
/** Re-observe a fixed publication without making a fresh selection or changing its accounting price. */
export function observeReferencePublication(
  input: MarketReferenceInput & {
    publishedAt: string;
    publicationMarketReference: string;
    publicationProbability: string;
    minimumEdgePrice: string;
    previousStatus: ReferenceEdgeStatus;
    resolutionSeconds: number;
    settled?: boolean;
  },
  config: MarketReferenceConfig,
) {
  const now = Date.parse(input.observedAt),
    published = Date.parse(input.publishedAt),
    start = Date.parse(input.startAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(published) ||
    !Number.isFinite(start) ||
    now < published ||
    !Number.isFinite(input.resolutionSeconds) ||
    input.resolutionSeconds <= 0
  )
    return null;
  try {
    binaryPrice(input.publicationProbability, input.publicationMarketReference);
  } catch {
    return null;
  }
  const result = buildMarketReference(input, config);
  const reference = result.reference;
  const status = referenceEdgeStatus({
    minimumEdgePrice: input.minimumEdgePrice,
    currentMarketReference: reference?.decimalPrice ?? null,
    previousStatus: input.previousStatus,
    now: input.observedAt,
    startAt: new Date(
      Date.parse(input.startAt) - config.cutoffSeconds * 1000,
    ).toISOString(),
    settled: !!input.settled,
    available: !!reference?.pricing,
  });
  const elapsed = (now - published) / 1000;
  return {
    reference,
    status,
    qualifies: status === "ACTIVE",
    publicationMarketReference: input.publicationMarketReference,
    currentMarketReference: reference?.decimalPrice ?? null,
    currentEstimatedEV: reference
      ? binaryPrice(input.publicationProbability, reference.decimalPrice).ev
      : null,
    targets: [1, 5, 15, 60].filter(
      (m) =>
        input.resolutionSeconds <= m * 60 &&
        elapsed >= m * 60 &&
        elapsed <= m * 60 + 60,
    ),
    rejections: result.rejections,
  };
}
