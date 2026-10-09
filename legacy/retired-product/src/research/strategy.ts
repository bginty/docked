import { z } from "zod";
import { hash, validateStrategy, type Strategy } from "@/core/pricing";
import {
  validateReferenceStrategy,
  type ReferenceStrategy,
} from "@/core/reference-pricing";
import { validateDataset } from "./dataset";
import { replay, type HistoricalEvent, type Manifest } from "./replay";
import { sensitivity } from "./sensitivity";
import {
  validateReferenceDataset,
  type HistoricalReferenceEvent,
} from "./reference-dataset";
import { replayReference, referenceSensitivity } from "./reference-replay";

export type ResearchStrategy = Strategy | ReferenceStrategy;
export function isReferenceResearchStrategy(
  config: ResearchStrategy,
): config is ReferenceStrategy {
  return config.method === "market-reference-independent-cohorts";
}
export function validateResearchStrategy(value: unknown): ResearchStrategy {
  if (
    value &&
    typeof value === "object" &&
    "method" in value &&
    value.method === "market-reference-independent-cohorts"
  )
    return validateReferenceStrategy(value);
  return validateStrategy(value);
}
const time = z.string().datetime({ offset: true });
const splitSchema = z
  .object({
    split: z.enum(["development", "validation", "held_out", "subsequent"]),
    from: time,
    to: time,
  })
  .strict();
const freezeSchema = z
  .object({
    config: z.unknown(),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    frozenAt: time,
    codeCommit: z.string().regex(/^[a-f0-9]{40}$/),
    studySplits: z.array(splitSchema).length(4),
    referenceRegion: z.string().trim().min(1).max(100).optional(),
    status: z.literal("FROZEN_RULE_ARTIFACT_NOT_VALIDATION_APPROVAL"),
  })
  .strict();
export type ResearchFreeze = Omit<z.infer<typeof freezeSchema>, "config"> & {
  config: ResearchStrategy;
};

export function validateResearchFreeze(value: unknown): ResearchFreeze {
  const parsed = freezeSchema.parse(value);
  const config = validateResearchStrategy(parsed.config);
  if (isReferenceResearchStrategy(config) && !parsed.referenceRegion)
    throw new Error("Frozen reference-region context required");
  if (parsed.configHash !== hash(config))
    throw new Error("Frozen configuration hash mismatch");
  if (new Set(parsed.studySplits.map((s) => s.split)).size !== 4)
    throw new Error("Four distinct frozen study splits required");
  const sorted = [...parsed.studySplits].sort(
    (a, b) => Date.parse(a.from) - Date.parse(b.from),
  );
  for (let i = 0; i < sorted.length; i++) {
    if (
      Date.parse(sorted[i].from) >= Date.parse(sorted[i].to) ||
      (i > 0 && Date.parse(sorted[i - 1].to) > Date.parse(sorted[i].from))
    )
      throw new Error(
        "Frozen study splits must be ordered, nonempty and nonoverlapping",
      );
    if (
      sorted[i].split !==
      ["development", "validation", "held_out", "subsequent"][i]
    )
      throw new Error(
        "Frozen study splits must retain chronological development/validation/held-out/subsequent order",
      );
  }
  return { ...parsed, config };
}

/** Binds the actual validated configuration and split boundaries, not merely self-reported hashes. */
export function assertResearchFreeze(
  value: unknown,
  manifest: Manifest,
  requested?: ResearchStrategy,
): ResearchStrategy {
  const frozen = validateResearchFreeze(value);
  const split = frozen.studySplits.find((s) => s.split === manifest.split);
  if (
    hash(value) !== manifest.freezeArtifactHash ||
    frozen.configHash !== manifest.configHash ||
    frozen.codeCommit !== manifest.codeCommit ||
    frozen.frozenAt !== manifest.frozenAt ||
    frozen.referenceRegion !== manifest.referenceRegion ||
    !split ||
    split.from !== manifest.from ||
    split.to !== manifest.to ||
    (requested && hash(requested) !== frozen.configHash)
  )
    throw new Error(
      "Freeze artifact, configuration, timestamp or split provenance mismatch",
    );
  return frozen.config;
}

/** Explicit algorithm dispatch. Source schemas are intentionally incompatible;
 * a legacy quote cannot acquire historical reference approvals by conversion. */
export function researchWorkflow(
  operation: "validate-data" | "replay" | "stress-test",
  events: unknown,
  manifest: Manifest,
  value: unknown,
) {
  const config = validateResearchStrategy(value);
  if (isReferenceResearchStrategy(config)) {
    const input = events as HistoricalReferenceEvent[];
    if (operation === "validate-data")
      return {
        engine: "market_reference_v1",
        manifest,
        validation: validateReferenceDataset(input, manifest, config),
        label: "DATA QUALITY AUDIT ONLY — no strategy results revealed",
      };
    return operation === "stress-test"
      ? referenceSensitivity(input, manifest, config)
      : replayReference(input, manifest, config);
  }
  const input = events as HistoricalEvent[];
  if (operation === "validate-data")
    return {
      engine: "legacy_offered_book",
      manifest,
      validation: validateDataset(input, manifest, config),
      label: "DATA QUALITY AUDIT ONLY — no strategy results revealed",
    };
  return {
    engine: "legacy_offered_book",
    ...(operation === "stress-test"
      ? sensitivity(input, manifest, config)
      : replay(input, manifest, config)),
  };
}
