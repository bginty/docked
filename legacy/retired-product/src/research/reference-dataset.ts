import { z } from "zod";
import { hash, type Rules } from "@/core/pricing";
import {
  supportedReferenceRules,
  type MarketSourceObservation,
} from "@/core/market-reference";
import {
  validateReferenceStrategy,
  type ReferenceStrategy,
} from "@/core/reference-pricing";
import { rulesSchema, resultSchema } from "./dataset";
import type { Manifest } from "./replay";

const time = z.string().datetime({ offset: true });
const text = z.string().trim().min(1);
const interval = { effectiveFrom: time, effectiveTo: time, knownAt: time };
const sourceSchema = z
  .object({
    id: text,
    provider: text,
    bookmaker: text,
    sourceType: z.enum(["bookmaker", "exchange"]),
    prices: z.record(
      text,
      z
        .string()
        .refine(
          (v) =>
            Number.isFinite(Number(v)) && Number(v) > 1 && Number(v) <= 1000,
        ),
    ),
    sourceAt: time,
    snapshotAt: time,
    archiveAvailableAt: time,
    archiveRetrievedAt: time,
    availabilityEvidence: text,
    suspended: z.boolean(),
    rights: z
      .object({
        reference: text,
        ...interval,
        retention: z.literal(true),
        research: z.literal(true),
      })
      .strict(),
    ownership: z
      .object({ operator: text, reference: text, ...interval })
      .strict(),
    classification: z
      .object({
        priceClass: z.enum([
          "STANDARD_VERIFIED",
          "PROMOTIONAL_EXCLUDED",
          "UNKNOWN_REVIEW",
        ]),
        version: text,
        evidence: text,
        promotionFlags: z.array(text),
        ...interval,
      })
      .strict(),
    mapping: z
      .object({
        reference: text,
        eventId: text,
        rulesHash: z.string().regex(/^[0-9a-f]{64}$/),
        ...interval,
      })
      .strict(),
    eligibility: z
      .object({ reference: text, region: text, ...interval })
      .strict(),
    feed: z
      .object({ healthy: z.boolean(), observedAt: time, evidence: text })
      .strict(),
  })
  .strict();
const eventSchema = z
  .object({
    rules: rulesSchema,
    startAt: time,
    schedule: z.object({ knownAt: time, reference: text }).strict(),
    snapshots: z.array(
      z
        .object({
          observedAt: time,
          eventStatus: z
            .object({
              status: z.enum([
                "scheduled",
                "cancelled",
                "postponed",
                "rescheduled",
                "abandoned",
                "completed",
                "unknown",
                "manual_review",
              ]),
              knownAt: time,
              evidence: text,
            })
            .strict(),
          sources: z.array(sourceSchema),
        })
        .strict(),
    ),
    result: resultSchema.nullable(),
  })
  .strict();
export type HistoricalReferenceSource = z.infer<typeof sourceSchema>;
export type HistoricalReferenceEvent = z.infer<typeof eventSchema>;
export type HistoricalReferenceSnapshot =
  HistoricalReferenceEvent["snapshots"][number];
const effective = (
  v: { effectiveFrom: string; effectiveTo: string; knownAt: string },
  at: number,
) =>
  Date.parse(v.knownAt) <= at &&
  Date.parse(v.effectiveFrom) <= at &&
  Date.parse(v.effectiveTo) > at;

/** Research-only normalisation. receivedAt is the independently evidenced archive
 * availability time, NEVER today's download relabelled as an earlier receipt.
 * Original download and availability evidence remain in the hashed source dataset. */
export function toReferenceSources(
  snapshot: HistoricalReferenceSnapshot,
  rules: Rules,
  decisionAt: string,
  fixture: boolean,
  configuration: ReferenceStrategy,
  referenceRegion: string,
): MarketSourceObservation[] {
  const at = Date.parse(decisionAt);
  return snapshot.sources.map((source) => ({
    id: source.id,
    provider: source.provider,
    bookmaker: source.bookmaker,
    operator: source.ownership.operator,
    rules,
    prices: source.prices,
    sourceAt: source.sourceAt,
    snapshotAt: source.snapshotAt,
    receivedAt: source.archiveAvailableAt,
    suspended: source.suspended,
    sourceKind: source.sourceType,
    approved:
      effective(source.ownership, at) &&
      effective(source.eligibility, at) &&
      (!configuration.marketReference.availabilityBookmakers.includes(
        source.bookmaker,
      ) ||
        source.eligibility.region === referenceRegion),
    licensed:
      effective(source.rights, at) &&
      source.rights.retention &&
      source.rights.research,
    rightsReference: source.rights.reference,
    ownershipEvidence: source.ownership.reference,
    mappingVerified:
      effective(source.mapping, at) &&
      source.mapping.eventId === rules.eventId &&
      source.mapping.rulesHash === hash(rules),
    feedHealthy:
      source.feed.healthy &&
      Date.parse(source.feed.observedAt) <= at &&
      at - Date.parse(source.feed.observedAt) <=
        configuration.marketReference.maxAgeSeconds * 1000,
    priceClass: effective(source.classification, at)
      ? source.classification.priceClass
      : "UNKNOWN_REVIEW",
    classificationVersion: source.classification.version,
    classificationEvidence: source.classification.evidence,
    promotionFlags: source.classification.promotionFlags,
    provenance: fixture ? "fixture" : "historical",
  }));
}

export function validateReferenceDataset(
  events: HistoricalReferenceEvent[],
  manifest: Manifest,
  configuration: ReferenceStrategy,
) {
  const config = validateReferenceStrategy(configuration);
  const errors: string[] = [],
    warnings: string[] = [];
  const coverage = {
    events: 0,
    snapshots: 0,
    quotes: 0,
    resultsMissing: 0,
    resultsUnauthorised: 0,
    eventsOutsideSplit: 0,
    eventMappingFailures: 0,
    marketMappingFailures: 0,
    staleQuotes: 0,
    bookmakerCoverage: {} as Record<string, number>,
    competitionCoverage: {} as Record<string, number>,
    from: null as string | null,
    to: null as string | null,
  };
  const parsed = z.array(eventSchema).safeParse(events);
  if (!parsed.success)
    return {
      valid: false,
      errors: [
        "Reference dataset requires complete dated rights, ownership, classification, mapping and historical availability evidence",
      ],
      warnings,
      coverage,
    };
  if (!manifest?.referenceRegion?.trim())
    errors.push("Explicit reference-region context required");
  if (
    !manifest ||
    !["demo", "retrospective_backtest"].includes(manifest.evidence)
  )
    errors.push("Explicit research-only evidence required");
  if (
    !manifest ||
    ![manifest.from, manifest.to, manifest.frozenAt].every(
      (v) => time.safeParse(v).success,
    ) ||
    Date.parse(manifest.from) >= Date.parse(manifest.to)
  )
    errors.push("Valid study and freeze instants required");
  if (
    !manifest ||
    !["development", "validation", "held_out", "subsequent"].includes(
      manifest.split,
    ) ||
    !Number.isSafeInteger(manifest.seed) ||
    typeof manifest.contaminated !== "boolean"
  )
    errors.push("Explicit split, seed and contamination status required");
  if (
    !manifest?.datasetId?.trim() ||
    !manifest.oddsRights?.trim() ||
    !manifest.resultsRights?.trim() ||
    !manifest.historicalUniverseEvidence?.trim() ||
    manifest.retentionAllowed !== true
  )
    errors.push(
      "Reviewed dataset identity, odds/results rights and universe evidence required",
    );
  if (
    manifest?.configHash !== hash(config) ||
    manifest?.dataHash !== hash(events)
  )
    errors.push("Reference manifest configuration/dataset hash mismatch");
  if (manifest?.evidence === "demo" && manifest.fixture !== true)
    errors.push(
      "Authored reference fixtures must explicitly declare fixture=true",
    );
  if (manifest?.evidence === "retrospective_backtest") {
    if (
      manifest.fixture !== false ||
      !manifest.reviewedBy?.trim() ||
      !manifest.provider?.odds?.trim() ||
      !manifest.provider.results?.trim() ||
      !/^[a-f0-9]{40}$/.test(manifest.codeCommit) ||
      !/^[a-f0-9]{64}$/.test(manifest.freezeArtifactHash ?? "") ||
      !Number.isInteger(manifest.sourceResolutionSeconds) ||
      manifest.sourceResolutionSeconds! <= 0
    )
      errors.push(
        "Real reference research requires reviewed providers, frozen commit/artifact and source resolution",
      );
    if (
      manifest.datasetHashes?.canonical !== manifest.dataHash ||
      !manifest.datasetHashes?.rawFiles.length ||
      manifest.datasetHashes.rawFiles.some(
        (f) => !f.name.trim() || !/^[a-f0-9]{64}$/.test(f.sha256),
      )
    )
      errors.push(
        "Canonical and original licensed source-file hashes required",
      );
    if (
      ["held_out", "subsequent"].includes(manifest.split) &&
      !manifest.contaminated &&
      !manifest.holdoutProvenance?.trim()
    )
      errors.push("Independent untouched-holdout provenance required");
  }
  if (errors.length) return { valid: false, errors, warnings, coverage };
  if (new Set(events.map((e) => e.rules.eventId)).size !== events.length)
    errors.push("Duplicate canonical reference event");
  for (const event of parsed.data) {
    coverage.events++;
    coverage.competitionCoverage[event.rules.competition] =
      (coverage.competitionCoverage[event.rules.competition] ?? 0) + 1;
    if (!supportedReferenceRules(event.rules as Rules)) {
      errors.push("Unsupported reference settlement rules");
      coverage.marketMappingFailures++;
    }
    if (
      Date.parse(event.startAt) < Date.parse(manifest.from) ||
      Date.parse(event.startAt) >= Date.parse(manifest.to)
    )
      coverage.eventsOutsideSplit++;
    if (!event.result) coverage.resultsMissing++;
    else {
      if (!event.result.authorised) coverage.resultsUnauthorised++;
      if (
        event.result.eventId !== event.rules.eventId ||
        hash(event.result.rules) !== hash(event.rules) ||
        (event.result.status === "final" &&
          Date.parse(event.result.observedAt) < Date.parse(event.startAt))
      )
        errors.push("Result mapping or observation time mismatch");
    }
    if (
      new Set(event.snapshots.map((s) => Date.parse(s.observedAt))).size !==
      event.snapshots.length
    )
      errors.push("Ambiguous simultaneous reference snapshots");
    for (const snapshot of event.snapshots) {
      coverage.snapshots++;
      if (
        Date.parse(snapshot.eventStatus.knownAt) >
        Date.parse(snapshot.observedAt)
      )
        errors.push(
          "Future event lifecycle evidence cannot describe an earlier snapshot",
        );
      if (
        new Set(snapshot.sources.map((s) => s.id)).size !==
        snapshot.sources.length
      )
        errors.push("Duplicate reference evidence ID in snapshot");
      for (const source of snapshot.sources) {
        coverage.quotes++;
        coverage.bookmakerCoverage[source.bookmaker] =
          (coverage.bookmakerCoverage[source.bookmaker] ?? 0) + 1;
        const times = [
          source.sourceAt,
          source.snapshotAt,
          source.archiveAvailableAt,
          snapshot.observedAt,
          source.archiveRetrievedAt,
        ].map(Date.parse);
        if (times.some((v, i) => i > 0 && times[i - 1] > v))
          errors.push(
            "Reference source, archive availability, observation and retrieval times must be ordered; no backdated download receipt",
          );
        if (
          Date.parse(source.feed.observedAt) >
          Date.parse(source.archiveAvailableAt)
        )
          errors.push(
            "Future feed-health evidence cannot describe an earlier source",
          );
        for (const v of [
          source.rights,
          source.ownership,
          source.classification,
          source.mapping,
          source.eligibility,
        ])
          if (Date.parse(v.effectiveFrom) >= Date.parse(v.effectiveTo))
            errors.push("Invalid historical approval interval");
        if (
          source.mapping.eventId !== event.rules.eventId ||
          source.mapping.rulesHash !== hash(event.rules)
        ) {
          errors.push("Historical reference source mapping mismatch");
          coverage.eventMappingFailures++;
        }
        if (
          Object.keys(source.prices).sort().join("\0") !==
          [...event.rules.outcomes].sort().join("\0")
        ) {
          errors.push("Incomplete historical reference market");
          coverage.marketMappingFailures++;
        }
        if (
          Date.parse(snapshot.observedAt) - Date.parse(source.sourceAt) >
          config.marketReference.maxAgeSeconds * 1000
        )
          coverage.staleQuotes++;
      }
    }
  }
  const starts = events
    .map((e) => e.startAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  coverage.from = starts[0] ?? null;
  coverage.to = starts.at(-1) ?? null;
  if (!events.length)
    warnings.push("Empty dataset: no empirical validation possible");
  if (coverage.resultsMissing) warnings.push("Missing outcomes stay pending");
  if (coverage.staleQuotes)
    warnings.push(
      "Stale sources remain in coverage and are rejected by the common engine",
    );
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    coverage,
  };
}
