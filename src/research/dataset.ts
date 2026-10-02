import { z } from "zod";
import { hash, type Strategy, strategyV1 } from "@/core/pricing";
import type { HistoricalEvent, Manifest } from "./replay";

const time = z.string().datetime({ offset: true });
const text = z.string().trim().min(1);
export const rulesSchema = z.object({
  eventId: text,
  competition: text,
  participants: z.array(text).length(2),
  market: z.enum(["football_1x2", "nba_moneyline"]),
  period: z.literal("full_game"),
  overtime: z.boolean(),
  draw: z.boolean(),
  line: z.null(),
  settlement: text,
  outcomes: z.array(text).min(2).max(3),
});
export const resultSchema = z.object({
  source: text,
  sourceEventId: text,
  revision: text,
  authorised: z.boolean(),
  eventId: text,
  status: z.enum([
    "final",
    "cancelled",
    "postponed",
    "rescheduled",
    "abandoned",
    "disputed",
    "manual_review",
    "void",
  ]),
  rules: rulesSchema,
  scores: z.record(z.string(), z.number().int().nonnegative()),
  observedAt: time,
  scheduledStartAt: time.optional(),
  supersedesRevision: text.optional(),
  reason: text.optional(),
  settlementBasis: text.optional(),
});
const quoteSchema = z.object({
  id: text,
  bookmaker: text,
  operator: text,
  approved: z.boolean(),
  rules: rulesSchema,
  prices: z.record(
    text,
    z.string().refine((x) => Number.isFinite(Number(x)) && Number(x) > 1),
  ),
  sourceAt: time,
  snapshotAt: time,
  receivedAt: time,
  suspended: z.boolean(),
});
const eventsSchema = z.array(
  z.object({
    rules: rulesSchema,
    startAt: time,
    snapshots: z.array(
      z.object({
        observedAt: time,
        quotes: z.array(quoteSchema),
        archiveRetrievedAt: time.optional(),
        availabilityEvidence: text.optional(),
      }),
    ),
    result: resultSchema.nullable(),
  }),
);
const manifestSchema = z.object({
  datasetId: text,
  evidence: z.enum(["retrospective_backtest", "demo"]),
  oddsRights: text,
  resultsRights: text,
  retentionAllowed: z.boolean(),
  configHash: text,
  dataHash: text,
  codeCommit: text,
  seed: z.number().int(),
  split: z.enum(["development", "validation", "held_out", "subsequent"]),
  contaminated: z.boolean(),
  frozenAt: text,
  from: text,
  to: text,
  historicalUniverseEvidence: text,
  fixture: z.boolean().optional(),
  provider: z.object({ odds: text, results: text }).optional(),
  datasetHashes: z
    .object({
      canonical: text,
      rawFiles: z.array(z.object({ name: text, sha256: text })),
    })
    .optional(),
  freezeArtifactHash: text.optional(),
  reviewedBy: text.optional(),
  sourceResolutionSeconds: z.number().int().positive().optional(),
  holdoutProvenance: text.optional(),
});
export const defaultStudySplits = [
  {
    split: "development",
    from: "2022-01-01T00:00:00.000Z",
    to: "2024-01-01T00:00:00.000Z",
  },
  {
    split: "validation",
    from: "2024-01-01T00:00:00.000Z",
    to: "2025-01-01T00:00:00.000Z",
  },
  {
    split: "held_out",
    from: "2025-01-01T00:00:00.000Z",
    to: "2026-01-01T00:00:00.000Z",
  },
  {
    split: "subsequent",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-10-03T00:00:00.000Z",
  },
];
export function validateDataset(
  events: HistoricalEvent[],
  manifest: Manifest,
  config: Strategy = strategyV1,
) {
  const errors: string[] = [],
    warnings: string[] = [];
  const zero = {
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
  if (!manifestSchema.safeParse(manifest).success)
    return {
      valid: false,
      errors: [
        "Invalid manifest schema: explicit retrospective/demo evidence, rights and provenance are required",
      ],
      warnings,
      coverage: zero,
    };
  if (!eventsSchema.safeParse(events).success)
    errors.push(
      "Dataset schema invalid: timestamps require an explicit timezone and canonical complete objects",
    );
  if (!manifest || typeof manifest !== "object")
    throw new Error("Manifest object required");
  if (
    !manifest.datasetId?.trim() ||
    !manifest.codeCommit?.trim() ||
    !Number.isSafeInteger(manifest.seed)
  )
    errors.push("Dataset identity, code commit and integer seed required");
  if (
    !["development", "validation", "held_out", "subsequent"].includes(
      manifest.split,
    )
  )
    errors.push("Invalid study split");
  const from = Date.parse(manifest.from),
    to = Date.parse(manifest.to),
    frozen = Date.parse(manifest.frozenAt);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from >= to ||
    !Number.isFinite(frozen)
  )
    errors.push("Invalid study range or freeze timestamp");
  if (!["retrospective_backtest", "demo"].includes(manifest.evidence))
    errors.push("Replay cannot create forward or live evidence");
  if (
    !manifest.oddsRights?.trim() ||
    !manifest.resultsRights?.trim() ||
    !manifest.retentionAllowed ||
    !manifest.historicalUniverseEvidence?.trim()
  )
    errors.push("Dataset rights and historical universe evidence required");
  if (
    manifest.configHash !== hash(config) ||
    manifest.dataHash !== hash(events)
  )
    errors.push("Manifest hash mismatch");
  if (manifest.evidence !== "demo") {
    if (
      manifest.fixture !== false ||
      !manifest.provider?.odds?.trim() ||
      !manifest.provider?.results?.trim() ||
      !manifest.reviewedBy?.trim() ||
      !manifest.freezeArtifactHash ||
      !/^[a-f0-9]{64}$/.test(manifest.freezeArtifactHash) ||
      !Number.isInteger(manifest.sourceResolutionSeconds) ||
      manifest.sourceResolutionSeconds! <= 0
    )
      errors.push(
        "Real research requires reviewed provider, fixture=false, source resolution and frozen artifact provenance",
      );
    if (
      manifest.datasetHashes?.canonical !== manifest.dataHash ||
      !manifest.datasetHashes.rawFiles.length ||
      manifest.datasetHashes.rawFiles.some(
        (r) => !r.name.trim() || !/^[a-f0-9]{64}$/.test(r.sha256),
      )
    )
      errors.push(
        "Real research requires canonical and original source-file hashes",
      );
    if (
      ["held_out", "subsequent"].includes(manifest.split) &&
      !manifest.contaminated &&
      !manifest.holdoutProvenance?.trim()
    )
      errors.push(
        "Untouched holdout claim requires independently reviewable provenance",
      );
  }
  if (errors.some((e) => e.startsWith("Dataset schema")))
    return { valid: false, errors, warnings, coverage: zero };
  const coverage = { ...zero, events: events.length };
  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.rules.eventId))
      errors.push(`Duplicate canonical event: ${e.rules.eventId}`);
    ids.add(e.rules.eventId);
    const start = Date.parse(e.startAt);
    if (start < from || start >= to) coverage.eventsOutsideSplit++;
    coverage.from =
      coverage.from === null || start < Date.parse(coverage.from)
        ? e.startAt
        : coverage.from;
    coverage.to =
      coverage.to === null || start > Date.parse(coverage.to)
        ? e.startAt
        : coverage.to;
    coverage.competitionCoverage[e.rules.competition] =
      (coverage.competitionCoverage[e.rules.competition] ?? 0) + 1;
    if (!e.result) coverage.resultsMissing++;
    else {
      if (!e.result.authorised) coverage.resultsUnauthorised++;
      if (e.result.eventId !== e.rules.eventId) coverage.eventMappingFailures++;
      if (hash(e.result.rules) !== hash(e.rules))
        coverage.marketMappingFailures++;
      if (
        e.result.status === "final" &&
        Date.parse(e.result.observedAt) < start
      )
        errors.push(`Final result predates start: ${e.rules.eventId}`);
    }
    const observed = new Set<number>();
    for (const s of e.snapshots) {
      const at = Date.parse(s.observedAt);
      if (observed.has(at))
        errors.push(`Ambiguous duplicate snapshot time: ${e.rules.eventId}`);
      observed.add(at);
      coverage.snapshots++;
      for (const q of s.quotes) {
        coverage.quotes++;
        coverage.bookmakerCoverage[q.bookmaker] =
          (coverage.bookmakerCoverage[q.bookmaker] ?? 0) + 1;
        if (q.rules.eventId !== e.rules.eventId)
          coverage.eventMappingFailures++;
        if (hash(q.rules) !== hash(e.rules)) coverage.marketMappingFailures++;
        const times = [q.sourceAt, q.snapshotAt, q.receivedAt].map(Date.parse);
        if (
          times.some((t) => t > at) ||
          times[0] > times[1] ||
          times[1] > times[2]
        )
          errors.push(
            `Look-ahead or timestamp order in snapshot: ${e.rules.eventId}/${q.id}`,
          );
        if (at - times[0] > config.maxAgeSeconds * 1000) coverage.staleQuotes++;
      }
    }
  }
  if (!events.length)
    warnings.push(
      "No events supplied; no historical performance can be calculated",
    );
  if (coverage.resultsMissing || coverage.resultsUnauthorised)
    warnings.push("Missing or unauthorised outcomes remain pending");
  if (coverage.eventMappingFailures || coverage.marketMappingFailures)
    errors.push("Canonical event or market mapping mismatch");
  if (manifest.contaminated)
    warnings.push(
      "Outcome contamination disclosed; do not describe this as an untouched test",
    );
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    coverage,
  };
}
