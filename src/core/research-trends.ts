import Decimal from "decimal.js";
import { z } from "zod";
import { phase5Hash } from "./phase5-hash";
import { researchId, researchInstant, researchMetric } from "./research-engine";

const nonnegativeDecimal = z
  .string()
  .max(60)
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const observationSchema = z
  .object({
    id: researchId,
    factId: researchId,
    entityId: researchId,
    entityType: z.enum(["TEAM", "PLAYER"]),
    eventId: researchId,
    metric: researchMetric,
    value: nonnegativeDecimal,
    unit: z.enum(["count", "minutes", "per_90", "percent", "per_match"]),
    competitionId: researchId,
    season: researchId,
    venue: z.enum(["HOME", "AWAY"]),
    opponentAdjustment: z.enum(["UNADJUSTED", "ADJUSTED"]),
    adjustmentVersion: researchId.nullable(),
    occurredAt: researchInstant,
    knownAt: researchInstant,
    ingestedAt: researchInstant,
    minutes: z.number().int().nonnegative().nullable(),
    sourceId: researchId,
    sourceVersion: researchId,
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.occurredAt) <= Date.parse(v.knownAt) &&
      Date.parse(v.knownAt) <= Date.parse(v.ingestedAt) &&
      (v.unit !== "percent" || new Decimal(v.value).lte(100)) &&
      (v.opponentAdjustment === "UNADJUSTED"
        ? v.adjustmentVersion === null
        : v.adjustmentVersion !== null),
    "Invalid trend context/time",
  );
export type ResearchTrendObservation = z.infer<typeof observationSchema>;
const window = z
  .object({
    from: researchInstant,
    to: researchInstant,
    lastN: z.number().int().positive().nullable(),
    halfLifeDays: z.number().positive().finite().nullable(),
  })
  .strict()
  .refine((v) => Date.parse(v.from) < Date.parse(v.to), "Invalid trend window");
export const researchTrendPolicySchema = z
  .object({
    schemaVersion: z.literal("research-trend-policy-v1"),
    version: researchId,
    entityId: researchId,
    entityType: z.enum(["TEAM", "PLAYER"]),
    metric: researchMetric,
    unit: observationSchema.shape.unit,
    competitionId: researchId,
    season: researchId,
    venue: z.enum(["HOME", "AWAY", "ALL"]),
    opponentAdjustment: z.enum(["UNADJUSTED", "ADJUSTED"]),
    adjustmentVersion: researchId.nullable(),
    recent: window,
    baseline: window,
    overlapPolicy: z.enum(["DISJOINT", "RECENT_INCLUDED_IN_BASELINE"]),
    minimumMatches: z.number().int().positive(),
    minimumMinutes: z.number().int().nonnegative().nullable(),
    threshold: z
      .object({
        kind: z.enum(["ABSOLUTE", "RELATIVE_PERCENT"]),
        value: nonnegativeDecimal.refine((v) => new Decimal(v).gt(0)),
      })
      .strict(),
  })
  .strict()
  .refine(
    (v) =>
      (v.overlapPolicy === "DISJOINT"
        ? Date.parse(v.baseline.to) <= Date.parse(v.recent.from)
        : Date.parse(v.baseline.from) <= Date.parse(v.recent.from) &&
          Date.parse(v.baseline.to) >= Date.parse(v.recent.to) &&
          v.baseline.lastN === null) &&
      (v.opponentAdjustment === "UNADJUSTED"
        ? v.adjustmentVersion === null
        : v.adjustmentVersion !== null),
    "Explicit disjoint or containing season baseline required; included baseline cannot truncate its recent window",
  );
export type ResearchTrendPolicy = z.infer<typeof researchTrendPolicySchema>;
export type ResearchTrend = {
  status: "READY" | "INSUFFICIENT_SAMPLE" | "ZERO_BASELINE";
  label: "ABOVE_BASELINE" | "NEAR_BASELINE" | "BELOW_BASELINE" | null;
  policyVersion: string;
  configHash: string;
  asOfTime: string;
  entityId: string;
  metric: string;
  unit: string;
  overlapPolicy: ResearchTrendPolicy["overlapPolicy"];
  recentValue: string | null;
  baselineValue: string | null;
  absoluteDifference: string | null;
  percentageDifference: string | null;
  recentMatches: number;
  baselineMatches: number;
  recentMinutes: number | null;
  baselineMinutes: number | null;
  factIds: string[];
  excludedObservationIds: string[];
  interpretation: "DESCRIPTIVE_ONLY";
};
/** Descriptive evidence only. Caller must first resolve current, authorised, non-conflicting facts. */
export function calculateResearchTrend(
  values: ResearchTrendObservation[],
  config: ResearchTrendPolicy,
  asOfTime: string,
): ResearchTrend {
  const p = researchTrendPolicySchema.parse(config),
    now = Date.parse(researchInstant.parse(asOfTime)),
    observations = values.map((v) => observationSchema.parse(v));
  if (Date.parse(p.recent.to) > now || Date.parse(p.baseline.to) > now)
    throw Error("Trend windows cannot extend beyond as-of time");
  if (new Set(observations.map((o) => o.id)).size !== observations.length)
    throw Error("Duplicate trend observation ID");
  const compatible = observations.filter(
    (o) =>
      o.entityId === p.entityId &&
      o.entityType === p.entityType &&
      o.metric === p.metric &&
      o.unit === p.unit &&
      o.competitionId === p.competitionId &&
      o.season === p.season &&
      (p.venue === "ALL" || o.venue === p.venue) &&
      o.opponentAdjustment === p.opponentAdjustment &&
      o.adjustmentVersion === p.adjustmentVersion &&
      Date.parse(o.ingestedAt) <= now &&
      Date.parse(o.knownAt) <= now,
  );
  // One measurement per event; corroborating sources must be resolved upstream, never counted as extra matches.
  if (new Set(compatible.map((o) => o.eventId)).size !== compatible.length)
    throw Error("Duplicate event measurements need fact resolution");
  const select = (w: ResearchTrendPolicy["recent"]) => {
    let rows = compatible
      .filter(
        (o) =>
          Date.parse(o.occurredAt) >= Date.parse(w.from) &&
          Date.parse(o.occurredAt) < Date.parse(w.to),
      )
      .sort(
        (a, b) =>
          Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
          a.id.localeCompare(b.id),
      );
    if (w.lastN) rows = rows.slice(0, w.lastN);
    const minutes = rows.every((o) => o.minutes !== null)
      ? rows.reduce((sum, o) => sum + o.minutes!, 0)
      : null;
    const sufficient =
      rows.length >= p.minimumMatches &&
      (p.unit !== "per_90" ||
        rows.every((o) => o.minutes !== null && o.minutes > 0)) &&
      (p.minimumMinutes === null ||
        (minutes !== null && minutes >= p.minimumMinutes));
    let weighted = new Decimal(0),
      weights = new Decimal(0);
    for (const o of rows) {
      const timeWeight =
        w.halfLifeDays === null
          ? new Decimal(1)
          : new Decimal(2).pow(
              -(Date.parse(w.to) - Date.parse(o.occurredAt)) /
                86400000 /
                w.halfLifeDays,
            );
      // Per-90 rates need exposure weighting; a five-minute cameo is not a full-match observation.
      const weight =
        p.unit === "per_90" ? timeWeight.mul(o.minutes ?? 0) : timeWeight;
      weighted = weighted.plus(new Decimal(o.value).mul(weight));
      weights = weights.plus(weight);
    }
    return {
      rows,
      minutes,
      sufficient,
      mean: weights.gt(0) ? weighted.div(weights) : null,
    };
  };
  const recent = select(p.recent),
    baseline = select(p.baseline),
    included = [...recent.rows, ...baseline.rows];
  const evidence = {
    policyVersion: p.version,
    configHash: phase5Hash(p),
    asOfTime,
    entityId: p.entityId,
    metric: p.metric,
    unit: p.unit,
    overlapPolicy: p.overlapPolicy,
    recentMatches: recent.rows.length,
    baselineMatches: baseline.rows.length,
    recentMinutes: recent.minutes,
    baselineMinutes: baseline.minutes,
    factIds: [...new Set(included.map((o) => o.factId))].sort(),
    excludedObservationIds: observations
      .filter((o) => !included.includes(o))
      .map((o) => o.id)
      .sort(),
    interpretation: "DESCRIPTIVE_ONLY" as const,
  };
  if (
    !recent.sufficient ||
    !baseline.sufficient ||
    !recent.mean ||
    !baseline.mean
  )
    return {
      ...evidence,
      status: "INSUFFICIENT_SAMPLE",
      label: null,
      recentValue: null,
      baselineValue: null,
      absoluteDifference: null,
      percentageDifference: null,
    };
  const difference = recent.mean.minus(baseline.mean),
    percentage = baseline.mean.isZero()
      ? null
      : difference.div(baseline.mean.abs()).mul(100);
  const tested = p.threshold.kind === "ABSOLUTE" ? difference : percentage;
  return {
    ...evidence,
    status: tested === null ? "ZERO_BASELINE" : "READY",
    label:
      tested === null
        ? null
        : tested.gte(p.threshold.value)
          ? "ABOVE_BASELINE"
          : tested.lte(new Decimal(p.threshold.value).neg())
            ? "BELOW_BASELINE"
            : "NEAR_BASELINE",
    recentValue: recent.mean.toFixed(),
    baselineValue: baseline.mean.toFixed(),
    absoluteDifference: difference.toFixed(),
    percentageDifference: percentage?.toFixed() ?? null,
  };
}
