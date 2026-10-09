import { z } from "zod";
import { phase5Hash } from "./phase5-hash";
import {
  researchFactTypes,
  researchId,
  researchInstant,
  researchSha,
  researchFactHash,
  researchFactKey,
  resolveResearchFacts,
  sourceUseDecision,
  type ResearchFact,
  type ResearchSource,
  type ResearchFactAncestry,
} from "./research-engine";

export const researchFeatureStates = [
  "DISPLAY_ONLY",
  "MODEL_ELIGIBLE",
  "MODEL_ACTIVE",
] as const;
export const researchFeatureSchema = z
  .object({
    schemaVersion: z.literal("research-feature-v1"),
    featureId: researchId,
    version: researchId,
    state: z.enum(researchFeatureStates),
    inputKind: z.literal("STRUCTURED_SPORTING_FACT"),
    factTypes: z
      .array(z.enum(researchFactTypes))
      .min(1)
      .refine((v) => new Set(v).size === v.length),
    transformId: researchId,
    transformVersion: researchId,
    modelVersion: researchId.nullable(),
    modelConfigHash: researchSha.nullable(),
    causalRationale: z.string().trim().min(20).max(2000),
    limitations: z.string().trim().min(1).max(2000),
    acceptedConfidence: z
      .array(z.enum(["CONFIRMED", "REPORTED"]))
      .min(1)
      .refine((v) => new Set(v).size === v.length),
    maxAgeSeconds: z.number().int().positive(),
    trainingCutoff: researchInstant.nullable(),
    reviewedAt: researchInstant,
    effectiveFrom: researchInstant,
    effectiveTo: researchInstant,
    reviewReference: z.string().trim().min(1).max(1000),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (Date.parse(f.effectiveTo) <= Date.parse(f.effectiveFrom))
      ctx.addIssue({
        code: "custom",
        message: "Invalid feature effective interval",
      });
    if (
      f.state !== "DISPLAY_ONLY" &&
      (!f.modelVersion || !f.modelConfigHash || !f.trainingCutoff)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Model eligibility requires immutable model/config/training cutoff",
      });
    if (
      f.trainingCutoff &&
      Date.parse(f.trainingCutoff) > Date.parse(f.reviewedAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Future training cutoff forbidden",
      });
  });
export type ResearchFeature = z.infer<typeof researchFeatureSchema>;
export const validateResearchFeature = (value: unknown): ResearchFeature =>
  researchFeatureSchema.parse(value);
export const researchFeatureHash = (value: unknown) =>
  phase5Hash(validateResearchFeature(value));
/** Computational definition can be frozen into model config without a modelHash ↔ featureHash cycle.
 * Governance row version/state/model binding/review clocks remain in researchFeatureHash. */
export function researchFeatureDefinitionHash(value: unknown): string {
  const f = validateResearchFeature(value);
  return phase5Hash({
    schemaVersion: "research-feature-definition-v1",
    featureId: f.featureId,
    inputKind: f.inputKind,
    factTypes: [...f.factTypes].sort(),
    transformId: f.transformId,
    transformVersion: f.transformVersion,
    causalRationale: f.causalRationale,
    limitations: f.limitations,
    acceptedConfidence: [...f.acceptedConfidence].sort(),
    maxAgeSeconds: f.maxAgeSeconds,
    trainingCutoff: f.trainingCutoff,
  });
}
export type ResearchRecalculation = {
  status:
    | "NO_ACTIVE_FEATURE_CHANGE"
    | "BLOCKED_DATA"
    | "MODEL_NOT_CONFIGURED"
    | "ELIGIBLE_FOR_RECALCULATION";
  reason: string;
  eventId: string;
  asOfTime: string;
  modelVersion: string;
  priorPredictionId: string | null;
  triggerFactIds: string[];
  featureVersions: { featureId: string; version: string; configHash: string }[];
  inputHash: string;
  probabilityOverride: false;
};
/** Eligibility creates a request only; it cannot fit/activate an estimator, create a prediction, or change calibration cohorts. */
export function assessResearchRecalculation(input: {
  eventId: string;
  startAt: string;
  asOfTime: string;
  jurisdiction: string;
  modelVersion: string;
  modelConfigHash: string;
  modelAvailable: boolean;
  priorPredictionId: string | null;
  changedFactIds: string[];
  facts: ResearchFact[];
  ancestry?: ResearchFactAncestry[];
  sources: ResearchSource[];
  features: ResearchFeature[];
}): ResearchRecalculation {
  const now = Date.parse(researchInstant.parse(input.asOfTime));
  const features = input.features
    .map(validateResearchFeature)
    .filter(
      (f) =>
        f.state === "MODEL_ACTIVE" &&
        f.modelVersion === input.modelVersion &&
        f.modelConfigHash === input.modelConfigHash &&
        Date.parse(f.reviewedAt) <= now &&
        Date.parse(f.effectiveFrom) <= now &&
        Date.parse(f.effectiveTo) > now,
    );
  if (new Set(features.map((f) => f.featureId)).size !== features.length)
    throw Error("Only one current feature version per model allowed");
  const resolved = resolveResearchFacts(
    input.facts,
    input.sources,
    {
      asOfTime: input.asOfTime,
      jurisdiction: input.jurisdiction,
      purpose: "MODEL",
    },
    input.ancestry,
  );
  const triggers = resolved.facts.filter(
    (r) =>
      [r.fact.id, ...r.conflictingIds].some((id) =>
        input.changedFactIds.includes(id),
      ) && features.some((f) => f.factTypes.includes(r.fact.type)),
  );
  const accepted: ResearchFact[] = [];
  let blocked =
    now >= Date.parse(researchInstant.parse(input.startAt)) ||
    input.facts.some((f) => f.eventId !== input.eventId);
  if (
    resolved.ancestry.some(
      (a) =>
        input.changedFactIds.includes(a.id) &&
        a.supersedesId !== null &&
        !input.facts.some((f) => f.id === a.id) &&
        input.facts.some(
          (f) =>
            researchFactKey(f) === a.factKey &&
            features.some((v) => v.factTypes.includes(f.type)),
        ),
    )
  )
    blocked = true;
  for (const r of triggers) {
    const fact = r.fact,
      feature = features.filter((f) => f.factTypes.includes(fact.type));
    const source = input.sources.find(
      (s) => s.sourceId === fact.sourceId && s.version === fact.sourceVersion,
    );
    const current = input.sources
      .filter(
        (s) => s.sourceId === fact.sourceId && Date.parse(s.reviewedAt) <= now,
      )
      .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))[0];
    if (
      r.status === "CONFLICTING_EVIDENCE" ||
      !source ||
      !current ||
      !sourceUseDecision(source, {
        asOfTime: input.asOfTime,
        jurisdiction: input.jurisdiction,
        purpose: "MODEL",
      }).allowed ||
      !sourceUseDecision(current, {
        asOfTime: input.asOfTime,
        jurisdiction: input.jurisdiction,
        purpose: "MODEL",
      }).allowed ||
      feature.some(
        (f) =>
          !f.acceptedConfidence.includes(
            fact.confidence as "CONFIRMED" | "REPORTED",
          ) ||
          now - Date.parse(fact.sourcePublishedAt ?? fact.sourceObservedAt) >
            f.maxAgeSeconds * 1000,
      )
    )
      blocked = true;
    else accepted.push(fact);
  }
  // Withdrawing/staling a previously active input must not be mistaken for a harmless display-only change.
  if (
    input.facts.some(
      (f) =>
        input.changedFactIds.includes(f.id) &&
        features.some((v) => v.factTypes.includes(f.type)),
    ) &&
    !triggers.length &&
    !input.facts
      .filter(
        (f) =>
          input.changedFactIds.includes(f.id) &&
          features.some((v) => v.factTypes.includes(f.type)),
      )
      .every((f) =>
        resolved.facts.some(
          (r) =>
            r.status !== "CONFLICTING_EVIDENCE" &&
            r.fact.id !== f.id &&
            r.corroboratingIds.includes(f.id),
        ),
      )
  )
    blocked = true;
  const featureVersions = features.map((f) => ({
    featureId: f.featureId,
    version: f.version,
    configHash: researchFeatureHash(f),
  }));
  const status = blocked
    ? "BLOCKED_DATA"
    : !triggers.length
      ? "NO_ACTIVE_FEATURE_CHANGE"
      : !input.modelAvailable
        ? "MODEL_NOT_CONFIGURED"
        : "ELIGIBLE_FOR_RECALCULATION";
  return {
    status,
    reason:
      status === "ELIGIBLE_FOR_RECALCULATION"
        ? "Approved active sporting inputs changed; a separately governed model executor must record any new prediction"
        : status,
    eventId: input.eventId,
    asOfTime: input.asOfTime,
    modelVersion: input.modelVersion,
    priorPredictionId: input.priorPredictionId,
    triggerFactIds: accepted.map((f) => f.id).sort(),
    featureVersions,
    inputHash: phase5Hash({
      eventId: input.eventId,
      asOfTime: input.asOfTime,
      modelVersion: input.modelVersion,
      modelConfigHash: input.modelConfigHash,
      featureVersions,
      facts: accepted.map(researchFactHash).sort(),
    }),
    probabilityOverride: false,
  };
}
/** A rationale is not an estimated numerical contribution. Only fitted executor evidence may supply one later. */
export function explainResearchFeatures(features: ResearchFeature[]) {
  return features.map(validateResearchFeature).map((f) => ({
    featureId: f.featureId,
    version: f.version,
    state: f.state,
    rationale: f.causalRationale,
    limitations: f.limitations,
    numericalContribution: null,
    label:
      f.state === "MODEL_ACTIVE"
        ? "ACTIVE_FEATURE_DEFINITION_NOT_A_MEASURED_CONTRIBUTION"
        : "DISPLAY_CONTEXT_ONLY",
  }));
}
