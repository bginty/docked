import Decimal from "decimal.js";
import {
  binaryPrice,
  decisionWindow,
  hash,
  strategyV1,
  validateStrategy,
  type Strategy,
  type Rules,
} from "./pricing";
import {
  buildMarketReference,
  marketReferenceV1,
  validateMarketReferenceConfig,
  type MarketReferenceConfig,
  type MarketReference,
  type MarketSourceObservation,
  type ReferenceRejection,
} from "./market-reference";

export type ReferenceStrategy = Omit<
  Strategy,
  "method" | "aggregation" | "selectionRule"
> & {
  method: "market-reference-independent-cohorts";
  aggregation: "market-reference-v1";
  selectionRule: "EV-desc-selection-ascending";
  marketReference: MarketReferenceConfig;
};
export function validateReferenceStrategy(value: unknown): ReferenceStrategy {
  if (!value || typeof value !== "object")
    throw new Error("Reference strategy configuration required");
  const { marketReference, method, aggregation, selectionRule, ...rest } =
    value as Record<string, unknown>;
  if (
    method !== "market-reference-independent-cohorts" ||
    aggregation !== "market-reference-v1" ||
    selectionRule !== "EV-desc-selection-ascending"
  )
    throw new Error("Unsupported reference strategy algorithm");
  const base = validateStrategy({
    ...rest,
    method: strategyV1.method,
    aggregation: strategyV1.aggregation,
    selectionRule: strategyV1.selectionRule,
  });
  if (
    !base.version.startsWith("market-reference-edge-") ||
    new Decimal(base.minEV).lt("0.03")
  )
    throw new Error(
      "A new reference strategy version and release threshold are required",
    );
  const reference = validateMarketReferenceConfig(marketReference);
  if (
    reference.maxAgeSeconds > base.maxAgeSeconds ||
    reference.maxSkewSeconds > base.maxSkewSeconds ||
    new Decimal(reference.maxProbabilityDisagreement).gt(
      base.maxDisagreement,
    ) ||
    reference.cutoffSeconds < base.safetySeconds
  )
    throw new Error("Reference controls cannot weaken strategy controls");
  return Object.freeze({
    ...base,
    method,
    aggregation,
    selectionRule,
    marketReference: reference,
  });
}
export const referenceStrategyV2 = validateReferenceStrategy({
  ...strategyV1,
  version: "market-reference-edge-v2.0.0",
  method: "market-reference-independent-cohorts",
  aggregation: "market-reference-v1",
  selectionRule: "EV-desc-selection-ascending",
  marketReference: marketReferenceV1,
});
export type ReferenceCandidate = ReturnType<typeof binaryPrice> & {
  eventId: string;
  selection: string;
  reference: MarketReference;
  decisionAt: string;
  startAt: string;
  configHash: string;
  window: number;
};
export function evaluateReference(
  input: {
    rules: Rules;
    startAt: string;
    decisionAt: string;
    sources: MarketSourceObservation[];
    evidenceMode?: "current" | "research";
  },
  configuration: ReferenceStrategy = referenceStrategyV2,
) {
  const config = validateReferenceStrategy(configuration);
  const rejections: ReferenceRejection[] = [],
    eligibleCandidates: ReferenceCandidate[] = [],
    universe: { selection: string; reference: MarketReference }[] = [];
  const window = decisionWindow(input.startAt, input.decisionAt, config);
  if (window === null || !config.competitions.includes(input.rules.competition))
    return {
      candidates: [],
      eligibleCandidates,
      universe,
      rejections: [
        { sourceId: "market", reason: "outside_strategy_universe_or_window" },
      ],
    };
  for (const selection of input.rules.outcomes) {
    const result = buildMarketReference(
      {
        rules: input.rules,
        startAt: input.startAt,
        observedAt: input.decisionAt,
        selection,
        sources: input.sources,
        evidenceMode: input.evidenceMode,
      },
      config.marketReference,
    );
    rejections.push(...result.rejections);
    if (result.status !== "READY") continue;
    const reference = result.reference;
    if (!reference.pricing) {
      rejections.push({
        sourceId: "pricing",
        reason: "probability_reference_unavailable",
      });
      continue;
    }
    universe.push({ selection, reference });
    const odds = new Decimal(reference.decimalPrice);
    if (odds.lt(config.minOdds) || odds.gt(config.maxOdds)) continue;
    const price = binaryPrice(
      reference.pricing.probability,
      reference.decimalPrice,
      config.minEV,
      config.tick,
    );
    if (new Decimal(price.ev).gt(config.maxEV)) {
      rejections.push({
        sourceId: "market",
        reason: "suspicious_edge_requires_review",
      });
      continue;
    }
    if (new Decimal(price.ev).lt(config.minEV) || odds.lt(price.minimumOdds))
      continue;
    eligibleCandidates.push({
      ...price,
      eventId: input.rules.eventId,
      selection,
      reference,
      decisionAt: input.decisionAt,
      startAt: input.startAt,
      window,
      configHash: hash(config),
    });
  }
  eligibleCandidates.sort(
    (a, b) =>
      new Decimal(b.ev).cmp(a.ev) ||
      (a.selection < b.selection ? -1 : a.selection > b.selection ? 1 : 0),
  );
  return {
    candidates: eligibleCandidates.slice(0, 1),
    eligibleCandidates,
    universe,
    rejections,
  };
}

export type ReferenceEdgeStatus =
  "ACTIVE" | "PRICE BELOW MINIMUM" | "EXPIRED" | "SUSPENDED" | "SETTLED";
/** Publication benchmark never changes; a recovered quote does not create another bet or reactivate V1. */
export function referenceEdgeStatus(input: {
  minimumEdgePrice: string;
  currentMarketReference: string | null;
  previousStatus: ReferenceEdgeStatus;
  now: string;
  startAt: string;
  settled: boolean;
  available: boolean;
  allowReactivation?: false;
}): ReferenceEdgeStatus {
  if (input.settled || input.previousStatus === "SETTLED") return "SETTLED";
  const now = Date.parse(input.now),
    start = Date.parse(input.startAt);
  if (!Number.isFinite(now) || !Number.isFinite(start)) return "SUSPENDED";
  if (now >= start || input.previousStatus === "EXPIRED") return "EXPIRED";
  if (!input.available || input.currentMarketReference === null)
    return "SUSPENDED";
  try {
    const current = new Decimal(input.currentMarketReference),
      minimum = new Decimal(input.minimumEdgePrice);
    if (
      !current.isFinite() ||
      !minimum.isFinite() ||
      current.lte(1) ||
      minimum.lte(1)
    )
      return "SUSPENDED";
    if (current.lt(minimum)) return "PRICE BELOW MINIMUM";
    if (input.previousStatus === "PRICE BELOW MINIMUM") return "SUSPENDED";
    if (input.previousStatus !== "ACTIVE") return input.previousStatus;
    return "ACTIVE";
  } catch {
    return "SUSPENDED";
  }
}
