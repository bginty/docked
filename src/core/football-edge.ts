import Decimal from "decimal.js";
import { z } from "zod";
import { validateFootballProbabilities } from "./football-model";
import {
  binaryPrice,
  decisionWindow,
  hash,
  strategyV1,
  validateStrategy,
  type Rules,
  type Strategy,
} from "./pricing";
import {
  supportedReferenceRules,
  validateMarketReferenceConfig,
  type MarketReference,
  type MarketReferenceConfig,
} from "./market-reference";

/** No default threshold or fitted model is activated by this schema. */
export type FootballEdgeStrategy = Omit<
  Strategy,
  "method" | "aggregation" | "selectionRule"
> & {
  method: "football-independent-model";
  aggregation: "independent-sport-model-v1";
  selectionRule: "EV-desc-selection-ascending";
  modelVersion: string;
  maxSportDataAgeSeconds: number;
  maxEdgesPerEvent: 1;
  stakeUnits: "1.00";
  marketReference: MarketReferenceConfig;
};
export function validateFootballEdgeStrategy(
  value: unknown,
): FootballEdgeStrategy {
  const extra = z
    .object({
      method: z.literal("football-independent-model"),
      aggregation: z.literal("independent-sport-model-v1"),
      selectionRule: z.literal("EV-desc-selection-ascending"),
      modelVersion: z.string().regex(/^football-[a-z0-9.-]+$/),
      maxSportDataAgeSeconds: z.number().int().positive().max(604800),
      maxEdgesPerEvent: z.literal(1),
      stakeUnits: z.literal("1.00"),
      marketReference: z.unknown(),
    })
    .passthrough()
    .parse(value);
  const {
    modelVersion,
    maxSportDataAgeSeconds,
    maxEdgesPerEvent,
    stakeUnits,
    marketReference,
    ...rest
  } = extra;
  const base = validateStrategy({
    ...rest,
    method: strategyV1.method,
    aggregation: strategyV1.aggregation,
    selectionRule: strategyV1.selectionRule,
  });
  const reference = validateMarketReferenceConfig(marketReference);
  if (
    !base.version.startsWith("football-independent-edge-") ||
    base.competitions.some(
      (c) => !["soccer_epl", "soccer_spain_la_liga"].includes(c),
    ) ||
    new Decimal(base.minEV).lt("0.03") ||
    reference.maxAgeSeconds > base.maxAgeSeconds ||
    reference.maxSkewSeconds > base.maxSkewSeconds ||
    reference.cutoffSeconds < base.safetySeconds ||
    new Decimal(reference.maxProbabilityDisagreement).gt(base.maxDisagreement)
  )
    throw Error(
      "Versioned football strategy must preserve existing safety controls",
    );
  return Object.freeze({
    ...base,
    method: extra.method,
    aggregation: extra.aggregation,
    selectionRule: extra.selectionRule,
    modelVersion,
    maxSportDataAgeSeconds,
    maxEdgesPerEvent,
    stakeUnits,
    marketReference: reference,
  });
}

/** A database-retained prospective prediction. There is deliberately no market input. */
export type FootballPredictionEvidence = {
  id: string;
  eventId: string;
  modelVersion: string;
  codeCommit: string;
  configHash: string;
  inputHash: string;
  asOfTime: string;
  calculatedAt: string;
  recordedAt: string;
  dataCutoff: string;
  startAt: string;
  homeTeam: string;
  awayTeam: string;
  probabilities: { home: string; draw: string; away: string };
  quality: "READY";
};
export type FootballEdgeCandidate = ReturnType<typeof binaryPrice> & {
  eventId: string;
  selection: string;
  reference: MarketReference;
  predictionId: string;
  modelVersion: string;
  modelInputHash: string;
  modelDataCutoff: string;
  decisionAt: string;
  startAt: string;
  configHash: string;
  window: number;
};
const instant = (s: string) =>
  typeof s === "string" &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  Number.isFinite(Date.parse(s));
export function compareFootballPrediction(
  input: {
    prediction: FootballPredictionEvidence;
    rules: Rules;
    decisionAt: string;
    references: readonly MarketReference[];
  },
  configuration: unknown,
): {
  candidates: FootballEdgeCandidate[];
  rejections: { selection: string | null; reason: string }[];
} {
  const cfg = validateFootballEdgeStrategy(configuration),
    p = input.prediction;
  const rejected = (reason: string) => ({
    candidates: [],
    rejections: [{ selection: null, reason }],
  });
  if (
    !supportedReferenceRules(input.rules) ||
    input.rules.market !== "football_1x2" ||
    !cfg.competitions.includes(input.rules.competition) ||
    p.eventId !== input.rules.eventId ||
    p.homeTeam !== input.rules.participants[0] ||
    p.awayTeam !== input.rules.participants[1]
  )
    return rejected("unsupported_or_mismatched_football_rules");
  if (
    p.quality !== "READY" ||
    p.modelVersion !== cfg.modelVersion ||
    !p.id ||
    !/^[a-f0-9]{40}$/.test(p.codeCommit) ||
    ![p.configHash, p.inputHash].every((s) => /^[a-f0-9]{64}$/.test(s))
  )
    return rejected("retained_independent_prediction_required");
  if (
    ![
      p.asOfTime,
      p.calculatedAt,
      p.recordedAt,
      p.dataCutoff,
      p.startAt,
      input.decisionAt,
    ].every(instant)
  )
    return rejected("invalid_model_clock");
  const now = Date.parse(input.decisionAt);
  if (
    Date.parse(p.dataCutoff) > Date.parse(p.asOfTime) ||
    Date.parse(p.asOfTime) > Date.parse(p.calculatedAt) ||
    Date.parse(p.calculatedAt) > Date.parse(p.recordedAt) ||
    Date.parse(p.recordedAt) > now ||
    now - Date.parse(p.dataCutoff) > cfg.maxSportDataAgeSeconds * 1000 ||
    now >= Date.parse(p.startAt) - cfg.safetySeconds * 1000
  )
    return rejected("model_data_stale_or_not_prospective");
  let vector: Decimal[];
  try {
    validateFootballProbabilities(p.probabilities);
    vector = [
      p.probabilities.home,
      p.probabilities.draw,
      p.probabilities.away,
    ].map((v) => new Decimal(v));
    // Valid boundary probabilities remain in the complete retained vector and
    // calibration ledger. binaryPrice rejects only an unpriceable selection;
    // it must not prevent evaluating the other outcomes in the same event.
  } catch {
    return rejected("invalid_probability_vector");
  }
  const window = decisionWindow(p.startAt, input.decisionAt, cfg);
  if (window === null) return rejected("outside_frozen_decision_window");
  const probabilities: Record<string, Decimal> = {
    [p.homeTeam]: vector[0],
    Draw: vector[1],
    [p.awayTeam]: vector[2],
  };
  const candidates: FootballEdgeCandidate[] = [],
    rejections: { selection: string | null; reason: string }[] = [];
  for (const selection of input.rules.outcomes) {
    const matching = input.references.filter((r) => r.selection === selection);
    const r = matching[0];
    if (
      matching.length !== 1 ||
      !r ||
      r.evidenceMode !== "current" ||
      r.rulesHash !== hash(input.rules) ||
      r.configHash !== hash(cfg.marketReference) ||
      r.methodologyVersion !== cfg.marketReference.version ||
      ![r.observedAt, r.sourceAt, r.snapshotAt, r.receivedAt].every(instant) ||
      Date.parse(r.observedAt) < Date.parse(p.recordedAt) ||
      Date.parse(r.observedAt) > now ||
      Date.parse(r.sourceAt) > Date.parse(r.snapshotAt) ||
      Date.parse(r.snapshotAt) > Date.parse(r.receivedAt) ||
      Date.parse(r.receivedAt) > Date.parse(r.observedAt) ||
      now - Date.parse(r.sourceAt) > cfg.maxAgeSeconds * 1000 ||
      r.availability.sourceCount < cfg.marketReference.minAvailabilitySources
    ) {
      rejections.push({
        selection,
        reason: "eligible_current_reference_unavailable",
      });
      continue;
    }
    try {
      // Football 1X2 has three mutually exclusive outcomes, but the selected bet
      // pays win/loss with no push. The COMPLETE independent vector is required.
      const price = binaryPrice(
        probabilities[selection].toString(),
        r.decimalPrice,
        cfg.minEV,
        cfg.tick,
      );
      if (
        new Decimal(r.decimalPrice).lt(price.minimumOdds) ||
        new Decimal(r.decimalPrice).lt(cfg.minOdds) ||
        new Decimal(r.decimalPrice).gt(cfg.maxOdds) ||
        new Decimal(price.ev).gt(cfg.maxEV)
      ) {
        rejections.push({ selection, reason: "threshold_or_price_bounds" });
        continue;
      }
      candidates.push({
        ...price,
        eventId: p.eventId,
        selection,
        reference: r,
        predictionId: p.id,
        modelVersion: p.modelVersion,
        modelInputHash: p.inputHash,
        modelDataCutoff: p.dataCutoff,
        decisionAt: input.decisionAt,
        startAt: p.startAt,
        configHash: hash(cfg),
        window,
      });
    } catch {
      rejections.push({ selection, reason: "invalid_market_price" });
    }
  }
  candidates.sort(
    (a, b) =>
      new Decimal(b.ev).cmp(a.ev) ||
      (a.selection < b.selection ? -1 : a.selection > b.selection ? 1 : 0),
  );
  return { candidates: candidates.slice(0, cfg.maxEdgesPerEvent), rejections };
}

/** A market failure cannot erase the already committed prediction or abstention. */
export async function predictThenCompare<P, R>(ports: {
  predictAndPersist: () => Promise<P>;
  comparisonPermitted: (prediction: P) => boolean;
  compareMarket: (prediction: P) => Promise<R>;
}): Promise<{ prediction: P; comparison: R | null }> {
  const prediction = await ports.predictAndPersist();
  if (!ports.comparisonPermitted(prediction))
    return { prediction, comparison: null };
  return { prediction, comparison: await ports.compareMarket(prediction) };
}
