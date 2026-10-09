import {
  buildMarketReference,
  validateMarketReferenceConfig,
  type MarketReferenceConfig,
  type MarketReferenceInput,
} from "@/core/market-reference";
import { hash } from "@/core/pricing";
import { phase5Hash } from "@/core/phase5-hash";

export type ModelRequest = MarketReferenceInput & {
  asOfTime: string;
  generatedAt: string;
  codeCommit: string;
};
export type ModelEstimate = {
  status: "READY";
  modelId: string;
  modelVersion: string;
  modelHash: string;
  configHash: string;
  codeCommit: string;
  purpose: "RESEARCH_BASELINE";
  validationStatus: "UNVALIDATED";
  method: "market-reference-baseline";
  advantageClaim: false;
  referenceHash: string;
  eventId: string;
  selection: string;
  probability: string;
  fairPrice: string;
  asOfTime: string;
  generatedAt: string;
  sourceIds: string[];
  sourceEvidenceHash: string;
  uncertainty: null;
  independentPredictiveModel: false;
};
export type ModelResult =
  ModelEstimate | { status: "NOT_CONFIGURED" | "UNAVAILABLE"; reason: string };
export interface ModelProvider {
  readonly id: string;
  readonly version: string;
  estimate(input: ModelRequest): ModelResult;
}

/** This reproduces the shared de-vig reference probability. It is not independent predictive alpha. */
export class MarketBaselineModel implements ModelProvider {
  readonly id = "market-reference-baseline";
  readonly version = "market-reference-baseline-v1";
  private readonly config: MarketReferenceConfig;
  constructor(configuration: MarketReferenceConfig) {
    this.config = validateMarketReferenceConfig(configuration);
  }
  estimate(input: ModelRequest): ModelResult {
    const asOf = Date.parse(input.asOfTime),
      generated = Date.parse(input.generatedAt);
    if (
      !Number.isFinite(asOf) ||
      !Number.isFinite(generated) ||
      generated < asOf ||
      input.observedAt !== input.asOfTime ||
      !/^[a-f0-9]{40}$/.test(input.codeCommit)
    )
      return {
        status: "UNAVAILABLE",
        reason: "Invalid model provenance or as-of time",
      };
    // A later genuine archive download is permitted only by the historical adapter,
    // which validates archive availability, dated rights and all feature knownAt times.
    const result = buildMarketReference(input, this.config);
    if (result.status !== "READY")
      return {
        status: result.status,
        reason: "Complete eligible as-of reference evidence is unavailable",
      };
    if (!result.reference.pricing)
      return {
        status: "UNAVAILABLE",
        reason: "Independent pricing cohort is unavailable",
      };
    const configHash = hash(this.config);
    return {
      status: "READY",
      modelId: this.id,
      modelVersion: this.version,
      modelHash: phase5Hash({
        id: this.id,
        version: this.version,
        configHash,
        codeCommit: input.codeCommit,
      }),
      configHash,
      codeCommit: input.codeCommit,
      purpose: "RESEARCH_BASELINE",
      validationStatus: "UNVALIDATED",
      method: "market-reference-baseline",
      advantageClaim: false,
      referenceHash: result.reference.evidenceHash,
      eventId: input.rules.eventId,
      selection: input.selection,
      probability: result.reference.pricing.probability,
      fairPrice: result.reference.pricing.fairPrice,
      asOfTime: input.asOfTime,
      generatedAt: input.generatedAt,
      sourceIds: result.reference.pricing.sourceIds,
      sourceEvidenceHash: result.reference.evidenceHash,
      uncertainty: null,
      independentPredictiveModel: false,
    };
  }
}
