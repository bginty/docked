import Decimal from "decimal.js";
import { z } from "zod";
import { validateFootballProbabilities } from "./football-model";
import { phase5Hash } from "./phase5-hash";

const instant = z.iso.datetime({ offset: true });
const id = z.string().min(1).max(160);
const common = {
  id,
  eventId: id,
  modelVersion: id,
  decisionWindow: id,
  asOfTime: instant,
  recordedAt: instant,
  startAt: instant,
};
const attemptSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...common,
      status: z.literal("PREDICTED"),
      probabilities: z.unknown(),
    })
    .strict(),
  z
    .object({
      ...common,
      status: z.enum(["ABSTAINED", "FAILED", "NOT_CONFIGURED"]),
      probabilities: z.null(),
    })
    .strict(),
]);
const outcomeSchema = z
  .object({
    id,
    eventId: id,
    revision: z.number().int().positive(),
    supersedesId: id.nullable(),
    knownAt: instant,
    completedAt: instant,
    sourceId: id,
    rightsReference: z.string().min(1),
    result: z.enum(["home", "draw", "away", "void", "manual_review"]),
  })
  .strict();
const requestSchema = z
  .object({
    modelVersion: id,
    decisionWindow: id,
    from: instant,
    to: instant,
    asOfTime: instant,
    attempts: z.array(attemptSchema).max(100000),
    outcomes: z.array(outcomeSchema).max(100000),
  })
  .strict();
export type FootballCalibrationRequest = z.input<typeof requestSchema>;
/** All prospective attempts in the declared model/time cohort, never an EV/edge subset.
 * Outcomes are resolved as of the reporting clock; corrections do not rewrite prior reports. */
export function footballCalibration(value: FootballCalibrationRequest) {
  const v = requestSchema.parse(value),
    from = Date.parse(v.from),
    to = Date.parse(v.to),
    asOf = Date.parse(v.asOfTime);
  if (!(from < to && to <= asOf))
    throw Error("Invalid calibration reporting window");
  const ids = new Set<string>(),
    decisions = new Set<string>();
  for (const a of v.attempts) {
    const decision = JSON.stringify([
      a.modelVersion,
      a.eventId,
      a.decisionWindow,
    ]);
    if (ids.has(a.id) || decisions.has(decision))
      throw Error("Duplicate prospective attempt");
    ids.add(a.id);
    decisions.add(decision);
    if (!(
      Date.parse(a.asOfTime) <= Date.parse(a.recordedAt) &&
      Date.parse(a.recordedAt) < Date.parse(a.startAt)
    ))
      throw Error("Attempt was not recorded prospectively");
    if (a.status === "PREDICTED")
      validateFootballProbabilities(a.probabilities);
  }
  const outcomeIds = new Set<string>(),
    chains = new Map<string, z.infer<typeof outcomeSchema>[]>();
  for (const o of v.outcomes) {
    if (
      outcomeIds.has(o.id) ||
      Date.parse(o.completedAt) > Date.parse(o.knownAt)
    )
      throw Error("Invalid outcome provenance");
    outcomeIds.add(o.id);
    const chain = chains.get(o.eventId) ?? [];
    chain.push(o);
    chains.set(o.eventId, chain);
  }
  const current = new Map<string, z.infer<typeof outcomeSchema>>();
  for (const [eventId, chain] of chains) {
    chain.sort((a, b) => a.revision - b.revision);
    for (let i = 0; i < chain.length; i++) {
      const o = chain[i],
        previous = chain[i - 1];
      if (
        o.revision !== i + 1 ||
        o.supersedesId !== (previous?.id ?? null) ||
        (previous && Date.parse(o.knownAt) < Date.parse(previous.knownAt))
      )
        throw Error("Incomplete or ambiguous outcome correction chain");
      if (Date.parse(o.knownAt) <= asOf) current.set(eventId, o);
    }
  }
  const attempts = v.attempts.filter(
    (a) =>
      a.modelVersion === v.modelVersion &&
      a.decisionWindow === v.decisionWindow &&
      Date.parse(a.asOfTime) >= from &&
      Date.parse(a.asOfTime) < to &&
      Date.parse(a.recordedAt) <= asOf,
  );
  const buckets = (["home", "draw", "away"] as const).flatMap((selection) =>
    Array.from({ length: 10 }, (_, index) => ({
      selection,
      index,
      lower: new Decimal(index).div(10).toFixed(1),
      upper: new Decimal(index + 1).div(10).toFixed(1),
      count: 0,
      total: new Decimal(0),
      actual: 0,
    })),
  );
  let brier = new Decimal(0),
    logLoss = 0,
    infiniteLogLossCount = 0,
    settled = 0,
    pending = 0,
    manualReview = 0,
    voids = 0;
  const scoredAttemptIds: string[] = [],
    outcomeEvidenceIds: string[] = [];
  for (const a of attempts) {
    if (a.status !== "PREDICTED") continue;
    const o = current.get(a.eventId);
    if (!o) {
      pending++;
      continue;
    }
    if (o.result === "manual_review") {
      pending++;
      manualReview++;
      continue;
    }
    if (
      o.result !== "void" &&
      Date.parse(o.completedAt) < Date.parse(a.startAt)
    )
      throw Error("Outcome predates event");
    if (o.result === "void") {
      voids++;
      continue;
    }
    const p = validateFootballProbabilities(a.probabilities);
    settled++;
    scoredAttemptIds.push(a.id);
    outcomeEvidenceIds.push(o.id);
    for (const selection of ["home", "draw", "away"] as const) {
      const probability = new Decimal(p[selection]),
        actual = selection === o.result ? 1 : 0;
      brier = brier.plus(probability.minus(actual).pow(2));
      const index = Math.min(9, probability.times(10).floor().toNumber());
      const bucket = buckets.find(
        (b) => b.selection === selection && b.index === index,
      )!;
      bucket.count++;
      bucket.total = bucket.total.plus(probability);
      bucket.actual += actual;
    }
    const actualProbability = new Decimal(p[o.result]);
    if (actualProbability.isZero()) infiniteLogLossCount++;
    else logLoss += -actualProbability.ln().toNumber();
  }
  const predicted = attempts.filter((a) => a.status === "PREDICTED").length;
  const abstained = attempts.filter(
    (a) => a.status === "ABSTAINED" || a.status === "NOT_CONFIGURED",
  ).length;
  const failed = attempts.filter((a) => a.status === "FAILED").length;
  return {
    schemaVersion: "football-calibration-v1",
    modelVersion: v.modelVersion,
    decisionWindow: v.decisionWindow,
    from: v.from,
    to: v.to,
    asOfTime: v.asOfTime,
    evidenceHash: phase5Hash({
      attempts,
      outcomes: [...current.values()].filter((o) =>
        attempts.some((a) => a.eventId === o.eventId),
      ),
    }),
    attempts: attempts.length,
    predicted,
    abstained,
    failed,
    settled,
    pending,
    manualReview,
    voids,
    abstentionRate: attempts.length
      ? new Decimal(abstained).div(attempts.length).toString()
      : null,
    failureRate: attempts.length
      ? new Decimal(failed).div(attempts.length).toString()
      : null,
    brierScore: settled ? brier.div(settled).toString() : null,
    // Zero-probability realised outcomes have infinite loss, not a clipped favourable score.
    logLoss: settled && !infiniteLogLossCount ? logLoss / settled : null,
    logLossStatus: !settled
      ? "UNKNOWN"
      : infiniteLogLossCount
        ? "INFINITE"
        : "FINITE",
    infiniteLogLossCount,
    scoredAttemptIds,
    outcomeEvidenceIds,
    buckets: buckets.map(({ total, actual, ...b }) => ({
      ...b,
      meanProbability: b.count ? total.div(b.count).toString() : null,
      observedFrequency: b.count
        ? new Decimal(actual).div(b.count).toString()
        : null,
    })),
    uncertainty: null,
    drift: null,
    bettingPerformance: null,
  };
}
