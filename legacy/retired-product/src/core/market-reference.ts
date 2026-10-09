import Decimal from "decimal.js";
import { z } from "zod";
import {
  canonical,
  hash,
  removeMargin,
  type Quote,
  type Rules,
} from "./pricing";

export type MarketSourceObservation = Quote & {
  provider: string;
  sourceKind: "bookmaker" | "exchange";
  licensed: boolean;
  rightsReference: string;
  ownershipEvidence: string;
  mappingVerified: boolean;
  feedHealthy: boolean;
  priceClass: "STANDARD_VERIFIED" | "PROMOTIONAL_EXCLUDED" | "UNKNOWN_REVIEW";
  classificationVersion: string;
  classificationEvidence: string;
  promotionFlags: string[];
  provenance: "current_provider" | "historical" | "fixture";
};
const fraction = (maximum: string) =>
  z.string().refine((v) => {
    try {
      const d = new Decimal(v);
      return d.isFinite() && d.gte(0) && d.lte(maximum);
    } catch {
      return false;
    }
  });
const schema = z
  .object({
    version: z
      .string()
      .regex(/^market-reference-v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9-]+)?$/),
    validationStatus: z.literal("UNVALIDATED"),
    pricingMethod: z.literal("proportional-equal-independent-disjoint"),
    availabilityMethod: z.literal("independent-lower-median"),
    pricingBookmakers: z.array(z.string().min(1)).max(100),
    availabilityBookmakers: z.array(z.string().min(1)).max(100),
    minPricingSources: z.number().int().min(2).max(20),
    minAvailabilitySources: z.number().int().min(2).max(20),
    maxAgeSeconds: z.number().int().min(1).max(180),
    maxSkewSeconds: z.number().int().min(0).max(90),
    maxProbabilityDisagreement: fraction("0.08"),
    maxAvailabilityDeviation: fraction("0.20"),
    maxAvailabilitySpread: fraction("0.10"),
    cutoffSeconds: z.number().int().min(600),
    tick: z.literal("0.01"),
    exchangeSupport: z.literal(false),
    allowReactivation: z.literal(false),
  })
  .strict()
  .refine(
    (c) =>
      new Set(c.pricingBookmakers).size === c.pricingBookmakers.length &&
      new Set(c.availabilityBookmakers).size ===
        c.availabilityBookmakers.length &&
      !c.pricingBookmakers.some((b) => c.availabilityBookmakers.includes(b)),
    "Disjoint unique source cohorts required",
  );
export type MarketReferenceConfig = z.infer<typeof schema>;
export function validateMarketReferenceConfig(
  value: unknown,
): MarketReferenceConfig {
  const parsed = schema.parse(value);
  Object.freeze(parsed.pricingBookmakers);
  Object.freeze(parsed.availabilityBookmakers);
  return Object.freeze(parsed);
}
export const marketReferenceV1 = validateMarketReferenceConfig({
  version: "market-reference-v1.0.0",
  validationStatus: "UNVALIDATED",
  pricingMethod: "proportional-equal-independent-disjoint",
  availabilityMethod: "independent-lower-median",
  pricingBookmakers: [],
  availabilityBookmakers: [],
  minPricingSources: 2,
  minAvailabilitySources: 2,
  maxAgeSeconds: 180,
  maxSkewSeconds: 90,
  maxProbabilityDisagreement: "0.08",
  maxAvailabilityDeviation: "0.20",
  maxAvailabilitySpread: "0.10",
  cutoffSeconds: 600,
  tick: "0.01",
  exchangeSupport: false,
  allowReactivation: false,
});
export type MarketReference = {
  methodologyVersion: string;
  configHash: string;
  rulesHash: string;
  selection: string;
  decimalPrice: string;
  observedAt: string;
  sourceAt: string;
  snapshotAt: string;
  receivedAt: string;
  pricing: {
    probability: string;
    fairPrice: string;
    sourceIds: string[];
    operators: string[];
  } | null;
  availability: {
    sourceIds: string[];
    operators: string[];
    sourceCount: number;
  };
  evidenceHash: string;
  evidenceMode: "current" | "research";
};
export type ReferenceRejection = { sourceId: string; reason: string };
export type MarketReferenceResult =
  | {
      status: "READY";
      reference: MarketReference;
      rejections: ReferenceRejection[];
    }
  | {
      status: "NOT_CONFIGURED" | "UNAVAILABLE";
      reference: null;
      rejections: ReferenceRejection[];
    };
export type MarketReferenceInput = {
  rules: Rules;
  startAt: string;
  observedAt: string;
  selection: string;
  sources: MarketSourceObservation[];
  evidenceMode?: "current" | "research";
};
const instant = (v: string) =>
  typeof v === "string" &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
const ordered = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const lowerMedian = (prices: Decimal[]) =>
  [...prices].sort((a, b) => a.cmp(b))[Math.floor((prices.length - 1) / 2)];
export function supportedReferenceRules(r: Rules) {
  if (
    !r.eventId?.trim() ||
    r.participants.length !== 2 ||
    new Set(r.participants).size !== 2 ||
    r.participants.some((p) => !p.trim()) ||
    r.period !== "full_game" ||
    r.line !== null
  )
    return false;
  if (r.market === "football_1x2")
    return (
      ["soccer_epl", "soccer_spain_la_liga"].includes(r.competition) &&
      !r.overtime &&
      r.draw &&
      r.settlement === "regulation_90_plus_stoppage" &&
      canonical([...r.outcomes].sort()) ===
        canonical([...r.participants, "Draw"].sort())
    );
  return (
    r.market === "nba_moneyline" &&
    r.competition === "basketball_nba" &&
    r.overtime &&
    !r.draw &&
    r.settlement === "full_game_including_overtime" &&
    canonical([...r.outcomes].sort()) === canonical([...r.participants].sort())
  );
}
/** Current mode never promotes historical/fictional evidence. Research results retain that distinction. */
export function buildMarketReference(
  input: MarketReferenceInput,
  configuration: MarketReferenceConfig = marketReferenceV1,
): MarketReferenceResult {
  const config = validateMarketReferenceConfig(configuration);
  const rejections: ReferenceRejection[] = [];
  const reject = (sourceId: string, reason: string) => {
    rejections.push({ sourceId, reason });
  };
  const unavailable = (
    reason: string,
    status: "UNAVAILABLE" | "NOT_CONFIGURED" = "UNAVAILABLE",
  ): MarketReferenceResult => {
    reject("market", reason);
    return { status, reference: null, rejections };
  };
  if (
    input.evidenceMode !== undefined &&
    !["current", "research"].includes(input.evidenceMode)
  )
    return unavailable("unknown_evidence_mode");
  if (!config.availabilityBookmakers.length)
    return unavailable("availability_cohort_not_configured", "NOT_CONFIGURED");
  if (
    !supportedReferenceRules(input.rules) ||
    !input.rules.outcomes.includes(input.selection)
  )
    return unavailable("unsupported_or_mismatched_rules");
  if (!instant(input.observedAt) || !instant(input.startAt))
    return unavailable("invalid_timestamp");
  const now = Date.parse(input.observedAt);
  if (now >= Date.parse(input.startAt) - config.cutoffSeconds * 1000)
    return unavailable("post_cutoff");
  const raw = input.sources.filter(
    (s) =>
      config.pricingBookmakers.includes(s.bookmaker) ||
      config.availabilityBookmakers.includes(s.bookmaker),
  );
  const duplicate = (s: MarketSourceObservation) =>
    raw.filter((other) => other.id === s.id || other.bookmaker === s.bookmaker)
      .length > 1;
  const valid = raw.filter((source) => {
    let reason: string | null = null;
    if (duplicate(source)) reason = "duplicate_source";
    else if (
      ![
        source.id,
        source.bookmaker,
        source.operator,
        source.provider,
        source.rightsReference,
        source.ownershipEvidence,
        source.classificationVersion,
        source.classificationEvidence,
      ].every((v) => typeof v === "string" && v.trim().length > 0)
    )
      reason = "missing_provenance";
    else if (
      !source.licensed ||
      !source.approved ||
      !source.mappingVerified ||
      !source.feedHealthy
    )
      reason = "unapproved_or_unhealthy";
    else if (source.sourceKind !== "bookmaker") reason = "exchange_unsupported";
    else if (source.suspended) reason = "suspended";
    else if (
      source.priceClass !== "STANDARD_VERIFIED" ||
      !Array.isArray(source.promotionFlags) ||
      source.promotionFlags.length
    )
      reason = "not_standard_price";
    else if (
      (input.evidenceMode ?? "current") === "current" &&
      source.provenance !== "current_provider"
    )
      reason = "non_current_evidence";
    else if (
      !["current_provider", "historical", "fixture"].includes(source.provenance)
    )
      reason = "unknown_provenance";
    else if (hash(source.rules) !== hash(input.rules))
      reason = "market_mismatch";
    else if (
      canonical(Object.keys(source.prices).sort()) !==
      canonical([...input.rules.outcomes].sort())
    )
      reason = "incomplete_market";
    else if (
      ![source.sourceAt, source.snapshotAt, source.receivedAt].every(instant)
    )
      reason = "invalid_timestamp";
    else {
      const times = [source.sourceAt, source.snapshotAt, source.receivedAt].map(
        Date.parse,
      );
      if (times[0] > times[1] || times[1] > times[2] || times[2] > now)
        reason = "future_or_disordered_timestamp";
      else if (times.some((t) => now - t > config.maxAgeSeconds * 1000))
        reason = "stale";
      else
        try {
          if (
            Object.values(source.prices).some(
              (p) =>
                !new Decimal(p).isFinite() ||
                new Decimal(p).lte(1) ||
                new Decimal(p).gt(1000),
            )
          )
            throw new Error();
          const total = Object.values(source.prices).reduce(
            (s, p) => s.plus(new Decimal(1).div(p)),
            new Decimal(0),
          );
          if (total.lt("0.95") || total.gt("1.25"))
            reason = "implausible_market";
        } catch {
          reason = "invalid_price";
        }
    }
    if (reason) reject(source.id, reason);
    return !reason;
  });
  const independent = (sources: MarketSourceObservation[]) => {
    const seen = new Set<string>();
    return [...sources]
      .sort((a, b) => ordered(a.bookmaker, b.bookmaker))
      .filter((s) => {
        if (seen.has(s.operator)) {
          reject(s.id, "shared_operator");
          return false;
        }
        seen.add(s.operator);
        return true;
      });
  };
  const pricing = independent(
    valid.filter((s) => config.pricingBookmakers.includes(s.bookmaker)),
  );
  // Exclude the complete configured pricing ownership cohort, including sources rejected for freshness.
  const pricingOperators = new Set(
    raw
      .filter((s) => config.pricingBookmakers.includes(s.bookmaker))
      .map((s) => s.operator),
  );
  let availability = independent(
    valid
      .filter((s) => config.availabilityBookmakers.includes(s.bookmaker))
      .filter((s) => {
        if (pricingOperators.has(s.operator)) {
          reject(s.id, "pricing_operator_excluded");
          return false;
        }
        return true;
      }),
  );
  if (availability.length < config.minAvailabilitySources)
    return unavailable("insufficient_independent_availability");
  const centre = lowerMedian(
    availability.map((s) => new Decimal(s.prices[input.selection])),
  );
  availability = availability.filter((s) => {
    if (
      new Decimal(s.prices[input.selection])
        .div(centre)
        .minus(1)
        .abs()
        .gt(config.maxAvailabilityDeviation)
    ) {
      reject(s.id, "availability_outlier");
      return false;
    }
    return true;
  });
  if (availability.length < config.minAvailabilitySources)
    return unavailable("insufficient_availability_after_outliers");
  const prices = availability.map(
    (s) => new Decimal(s.prices[input.selection]),
  );
  const median = lowerMedian(prices);
  if (median.div(config.tick).floor().mul(config.tick).lte(1))
    return unavailable("price_below_supported_tick");
  if (
    Decimal.max(...prices)
      .minus(Decimal.min(...prices))
      .div(median)
      .gt(config.maxAvailabilitySpread)
  )
    return unavailable("availability_disagreement");
  const skew = (sources: MarketSourceObservation[]) =>
    Math.max(...sources.map((s) => Date.parse(s.sourceAt))) -
    Math.min(...sources.map((s) => Date.parse(s.sourceAt)));
  if (skew(availability) > config.maxSkewSeconds * 1000)
    return unavailable("availability_source_skew");
  let model: MarketReference["pricing"] = null;
  if (
    pricing.length >= config.minPricingSources &&
    skew([...pricing, ...availability]) <= config.maxSkewSeconds * 1000
  ) {
    const vectors = pricing.map((s) => removeMargin(s.prices));
    if (
      input.rules.outcomes.every((outcome) =>
        Decimal.max(...vectors.map((v) => v[outcome]))
          .minus(Decimal.min(...vectors.map((v) => v[outcome])))
          .lte(config.maxProbabilityDisagreement),
      )
    ) {
      const probability = vectors
        .reduce((sum, v) => sum.plus(v[input.selection]), new Decimal(0))
        .div(vectors.length);
      model = {
        probability: probability.toString(),
        fairPrice: new Decimal(1).div(probability).toString(),
        sourceIds: pricing.map((s) => s.id),
        operators: pricing.map((s) => s.operator),
      };
    } else reject("pricing", "pricing_disagreement");
  } else reject("pricing", "insufficient_or_skewed_pricing_sources");
  const retained = [...availability, ...(model ? pricing : [])];
  const oldest = (key: "sourceAt" | "snapshotAt" | "receivedAt") =>
    new Date(
      Math.min(...retained.map((s) => Date.parse(s[key]))),
    ).toISOString();
  const reference: MarketReference = {
    methodologyVersion: config.version,
    configHash: hash(config),
    rulesHash: hash(input.rules),
    selection: input.selection,
    decimalPrice: median.div(config.tick).floor().mul(config.tick).toFixed(2),
    observedAt: input.observedAt,
    sourceAt: oldest("sourceAt"),
    snapshotAt: oldest("snapshotAt"),
    receivedAt: oldest("receivedAt"),
    pricing: model,
    availability: {
      sourceIds: availability.map((s) => s.id),
      operators: availability.map((s) => s.operator),
      sourceCount: availability.length,
    },
    evidenceHash: hash({
      config,
      input: {
        rules: input.rules,
        startAt: input.startAt,
        observedAt: input.observedAt,
        selection: input.selection,
        evidenceMode: input.evidenceMode ?? "current",
      },
      sources: [...retained].sort((a, b) => ordered(a.id, b.id)),
    }),
    evidenceMode: input.evidenceMode ?? "current",
  };
  return { status: "READY", reference, rejections };
}
