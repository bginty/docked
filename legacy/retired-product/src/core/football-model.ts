import Decimal from "decimal.js";
import { z } from "zod";
import { phase5Hash } from "./phase5-hash";
// Strings are at most80 characters; keep enough precision to reject tiny sum errors.
const ProbabilityDecimal = Decimal.clone({ precision: 100 });

export const footballModelLifecycle = [
  "DRAFT",
  "RESEARCH",
  "FORWARD_CALIBRATION",
  "APPROVED_FOR_CANDIDATES",
  "APPROVED_FOR_LIVE",
  "RETIRED",
] as const;
const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const instant = z.iso.datetime({ offset: true });
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const probability = z
  .string()
  .regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/)
  .max(80);
const probabilities = z
  .object({ home: probability, draw: probability, away: probability })
  .strict();
export type FootballProbabilities = z.infer<typeof probabilities>;
/** Shape validation is not permission to register a model or publish a prediction. */
export function validateFootballProbabilities(
  value: unknown,
): FootballProbabilities {
  const parsed = probabilities.parse(value);
  if (
    !new ProbabilityDecimal(parsed.home)
      .plus(parsed.draw)
      .plus(parsed.away)
      .equals(1)
  )
    throw Error("Football probabilities must sum exactly to one");
  return parsed;
}
export const footballEventSchema = z
  .object({
    eventId: id,
    competitionId: id,
    homeTeamId: id,
    awayTeamId: id,
    sport: z.literal("football"),
    startAt: instant,
    status: z.literal("scheduled"),
    knownAt: instant,
    sourceId: id,
  })
  .strict()
  .refine((v) => v.homeTeamId !== v.awayTeamId, "Distinct teams required");
export type FootballModelEvent = z.infer<typeof footballEventSchema>;
const source = z
  .object({
    sourceId: id,
    provider: id,
    sourceVersion: id,
    rightsReference: z.string().min(1).max(1000),
    allowedPurposes: z
      .array(
        z.enum([
          "model_training",
          "derived_probabilities",
          "retained_evidence",
        ]),
      )
      .length(3),
    knownAt: instant,
    effectiveFrom: instant,
    effectiveTo: instant,
  })
  .strict();
const match = z
  .object({
    id,
    eventId: id,
    competitionId: id,
    homeTeamId: id,
    awayTeamId: id,
    startAt: instant,
    completedAt: instant,
    knownAt: instant,
    receivedAt: instant,
    sourceId: id,
    revision: z.number().int().positive(),
    status: z.literal("final"),
    regulationHomeGoals: z.number().int().min(0).max(100),
    regulationAwayGoals: z.number().int().min(0).max(100),
  })
  .strict();
const input = z
  .object({
    schemaVersion: z.literal("football-sporting-input-v1"),
    event: footballEventSchema,
    asOfTime: instant,
    calculatedAt: instant,
    codeCommit: z.string().regex(/^[a-f0-9]{40}$/),
    sourceApprovals: z.array(source).min(1).max(100),
    matches: z.array(match).min(1).max(100000),
    // Fitted features belong to a future reviewed schema; this version only retains sporting facts.
    missingRequired: z.array(id).max(100),
    missingOptional: z.array(id).max(100),
  })
  .strict();
export type FootballSportingInput = z.infer<typeof input>;
export function validateFootballSportingInput(
  value: unknown,
): FootballSportingInput {
  const v = input.parse(value),
    asOf = Date.parse(v.asOfTime),
    calculated = Date.parse(v.calculatedAt);
  if (
    Date.parse(v.event.knownAt) > asOf ||
    asOf >= Date.parse(v.event.startAt) ||
    calculated < asOf ||
    calculated >= Date.parse(v.event.startAt)
  )
    throw Error("Prospective event cutoff violated");
  const sources = new Map(v.sourceApprovals.map((s) => [s.sourceId, s]));
  if (sources.size !== v.sourceApprovals.length)
    throw Error("Duplicate source authority");
  for (const s of sources.values()) {
    if (
      new Set(s.allowedPurposes).size !== 3 ||
      Date.parse(s.knownAt) > asOf ||
      Date.parse(s.effectiveFrom) > asOf ||
      Date.parse(s.effectiveTo) <= asOf
    )
      throw Error("Source authority unavailable at cutoff");
  }
  if (!sources.has(v.event.sourceId))
    throw Error("Event source authority missing");
  const events = new Set<string>(),
    records = new Set<string>();
  for (const m of v.matches) {
    if (events.has(m.eventId) || records.has(m.id))
      throw Error("Duplicate or unresolved result revision");
    events.add(m.eventId);
    records.add(m.id);
    if (
      m.eventId === v.event.eventId ||
      m.competitionId !== v.event.competitionId ||
      m.homeTeamId === m.awayTeamId ||
      !sources.has(m.sourceId)
    )
      throw Error("Invalid sporting identity or source");
    const start = Date.parse(m.startAt),
      completed = Date.parse(m.completedAt),
      known = Date.parse(m.knownAt),
      received = Date.parse(m.receivedAt);
    if (!(
      start < completed &&
      completed <= known &&
      known <= received &&
      received <= asOf
    ))
      throw Error("Sporting input was not available at cutoff");
  }
  return v;
}
export const footballSportingInputHash = (value: unknown) =>
  phase5Hash(validateFootballSportingInput(value));
export const footballModelProposal = Object.freeze({
  modelId: "football-goals",
  modelVersion: "football-goals-v1.0.0",
  sport: "football",
  market: "regulation_1x2",
  proposedMethod: "independent-poisson-goals",
  state: "DRAFT",
  validationStatus: "UNVALIDATED",
  parameters: null,
  trainingDataHash: null,
  operationalStatus: "NOT_CONFIGURED",
  advantageClaim: false,
} as const);
export const footballModelProposalHash = phase5Hash(footballModelProposal);

export type FootballModelUnavailable = {
  status: "NOT_CONFIGURED";
  modelVersion: string;
  eventId: string;
  asOfTime: string;
  calculatedAt: string;
  dataCutoff: null;
  inputHash: null;
  configHash: null;
  probabilities: null;
  uncertainty: null;
  advantageClaim: false;
  validationStatus: "UNVALIDATED";
  quality: { status: "NO_AUTHORISED_DATA"; missingRequired: string[] };
};
/** Future implementations must be registered and approved server-side. No estimator is installed. */
export interface FootballModelProvider {
  estimate(
    event: FootballModelEvent,
    asOfTime: string,
    modelVersion: string,
  ): Promise<FootballModelUnavailable | FootballModelPrediction>;
}
export class NotConfiguredFootballModelProvider implements FootballModelProvider {
  constructor(private readonly clock: () => Date = () => new Date()) {}
  async estimate(
    event: FootballModelEvent,
    asOfTime: string,
    modelVersion: string,
  ): Promise<FootballModelUnavailable> {
    const e = footballEventSchema.parse(event);
    instant.parse(asOfTime);
    id.parse(modelVersion);
    const calculatedAt = this.clock().toISOString();
    if (
      Date.parse(e.knownAt) > Date.parse(asOfTime) ||
      Date.parse(asOfTime) >= Date.parse(e.startAt) ||
      Date.parse(calculatedAt) < Date.parse(asOfTime) ||
      Date.parse(calculatedAt) >= Date.parse(e.startAt)
    )
      throw Error("Prospective event cutoff violated");
    return {
      status: "NOT_CONFIGURED",
      modelVersion,
      eventId: e.eventId,
      asOfTime,
      calculatedAt,
      dataCutoff: null,
      inputHash: null,
      configHash: null,
      probabilities: null,
      uncertainty: null,
      advantageClaim: false,
      validationStatus: "UNVALIDATED",
      quality: {
        status: "NO_AUTHORISED_DATA",
        missingRequired: [
          "authorised_sporting_dataset",
          "reviewed_model_parameters",
          "fitted_estimator",
        ],
      },
    };
  }
}

/** Prospective evidence boundary for a future reviewed estimator; never a fitting implementation. */
export const footballPredictionSchema = z
  .object({
    eventId: id,
    modelVersion: id,
    codeCommit: z.string().regex(/^[a-f0-9]{40}$/),
    configHash: sha,
    inputHash: sha,
    asOfTime: instant,
    calculatedAt: instant,
    dataCutoff: instant,
    startAt: instant,
    probabilities,
    sourceIds: z.array(id).min(1).max(100),
    quality: z.literal("READY"),
    uncertainty: z.null(),
  })
  .strict();
export type FootballModelPrediction = z.infer<
  typeof footballPredictionSchema
> & { status: "PREDICTED" };
export function validateFootballPrediction(value: unknown) {
  const v = footballPredictionSchema.parse(value);
  validateFootballProbabilities(v.probabilities);
  if (
    new Set(v.sourceIds).size !== v.sourceIds.length ||
    Date.parse(v.dataCutoff) > Date.parse(v.asOfTime) ||
    Date.parse(v.asOfTime) > Date.parse(v.calculatedAt) ||
    Date.parse(v.calculatedAt) >= Date.parse(v.startAt)
  )
    throw Error("Invalid prospective prediction provenance");
  return v;
}
