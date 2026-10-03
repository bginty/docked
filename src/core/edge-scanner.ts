import { z } from "zod";
import { hash } from "./pricing";

export const scannerPurposes = ["research", "paper", "live"] as const;
export const scannerStatuses = [
  "CANDIDATE",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "INVALIDATED",
] as const;
export type ScannerPurpose = (typeof scannerPurposes)[number];
export type ScannerStatus = (typeof scannerStatuses)[number];
export const scannerScheduleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    enabled: z.boolean(),
    provider: z.enum(["the-odds-api", "odds-papi"]),
    sport: z.string().min(2).max(80),
    competition: z.string().min(2).max(100),
    strategyId: z.string().min(3).max(120),
    regionPolicyId: z.uuid(),
    purpose: z.enum(scannerPurposes).default("research"),
    intervalSeconds: z.number().int().min(300).max(86400),
    nearEventSeconds: z.number().int().min(600).max(86400),
    nearIntervalSeconds: z.number().int().min(60).max(86400),
    horizonSeconds: z.number().int().min(600).max(604800),
    minQuotaRemaining: z.number().int().min(0).max(100000000),
  })
  .strict()
  .refine(
    (v) =>
      v.nearIntervalSeconds <= v.intervalSeconds &&
      v.nearEventSeconds <= v.horizonSeconds,
  );
export type ScannerSchedule = z.infer<typeof scannerScheduleSchema>;
export const scannerRejectionReasons = [
  "data_concern",
  "market_moved",
  "model_concern",
  "duplicate",
  "market_rule_concern",
  "editorial_operational",
  "other",
] as const;
export const scannerActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("run_now"),
      scheduleId: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      action: z.enum(["pause", "resume"]),
      reason: z.string().min(12).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("schedule"),
      schedule: scannerScheduleSchema,
      reason: z.string().min(12).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("manual_candidate"),
      marketId: z.string().min(1).max(200),
      selection: z.string().min(1).max(100),
      strategyId: z.string().min(1).max(120),
      regionPolicyId: z.uuid(),
      purpose: z.enum(scannerPurposes).default("research"),
      reason: z.string().min(12).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      id: z.uuid(),
      reason: z.string().min(12).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("reject"),
      id: z.uuid(),
      category: z.enum(scannerRejectionReasons),
      reason: z.string().min(3).max(1000),
    })
    .strict(),
]);
export function scannerCadence(
  schedule: ScannerSchedule,
  now: string,
  startAt: string | null,
  remaining: number | null,
) {
  const config = scannerScheduleSchema.parse(schedule),
    at = Date.parse(now);
  if (!Number.isFinite(at)) throw Error("Valid scanner clock required");
  const until = startAt === null ? Infinity : (Date.parse(startAt) - at) / 1000;
  // Unknown quota never justifies faster scans. Scanning reads cached data and spends no provider credits.
  const low = remaining === null || remaining < config.minQuotaRemaining;
  const interval = low
    ? config.intervalSeconds
    : until > 600 && until <= config.nearEventSeconds
      ? config.nearIntervalSeconds
      : config.intervalSeconds;
  return {
    intervalSeconds: interval,
    nextAt: new Date(at + interval * 1000).toISOString(),
    quotaKnown: remaining !== null,
  };
}
export function scannerSlot(id: string, at: string, interval: number) {
  if (
    !Number.isInteger(interval) ||
    interval < 60 ||
    !Number.isFinite(Date.parse(at))
  )
    throw Error("Valid durable scan slot required");
  return `edge-scan:${id}:${Math.floor(Date.parse(at) / (interval * 1000))}`;
}
export function scannerCandidateKey(input: {
  marketId: string;
  strategyId: string;
  strategyHash: string;
  selection: string;
  purpose: ScannerPurpose;
  sourceIds: string[];
  windowSeconds: number;
  regionPolicyId: string;
}) {
  return hash({ ...input, sourceIds: [...input.sourceIds].sort() });
}
export function scannerStrategyAllowed(
  purpose: ScannerPurpose,
  state: {
    lifecycle: string;
    active: boolean;
    frozen: boolean;
    researchApproved: boolean;
    paperApproved: boolean;
    ownerApproved: boolean;
  },
) {
  if (purpose === "research")
    return [
      "RESEARCH",
      "VALIDATED",
      "FROZEN_FOR_FORWARD_PAPER",
      "FORWARD_PAPER",
      "APPROVED_FOR_LIVE",
    ].includes(state.lifecycle);
  if (!state.active || !state.frozen || !state.researchApproved) return false;
  return purpose === "paper"
    ? state.lifecycle === "FORWARD_PAPER"
    : state.lifecycle === "APPROVED_FOR_LIVE" &&
        state.paperApproved &&
        state.ownerApproved;
}
export function scannerExpiry(input: {
  sourceAt: string;
  startAt: string;
  scannedAt: string;
  maxAgeSeconds: number;
  cutoffSeconds: number;
}) {
  const expiry = Math.min(
    Date.parse(input.sourceAt) + Math.min(180, input.maxAgeSeconds) * 1000,
    Date.parse(input.startAt) - Math.max(600, input.cutoffSeconds) * 1000,
    Date.parse(input.scannedAt) + 120000,
  );
  if (!Number.isFinite(expiry) || expiry <= Date.parse(input.scannedAt))
    throw Error("Fresh pre-event scanner evidence required");
  return new Date(expiry).toISOString();
}
export type ScannerCandidate = {
  id: string;
  purpose: ScannerPurpose;
  status: ScannerStatus;
  sport: string;
  competition: string;
  event: string;
  eventId: string;
  market: string;
  marketId: string;
  selection: string;
  probability: string;
  fairOdds: string;
  minimumOdds: string;
  requiredEV: string;
  currentMarketReference: string;
  estimatedEV: string;
  sourceCount: number;
  dataAgeSeconds: number;
  strategyVersion: string;
  modelVersion: string;
  scannedAt: string;
  startAt: string;
  expiresAt: string;
  warnings: string[];
  publicationId: string | null;
};
export type ScannerMetrics = {
  events: number | null;
  markets: number | null;
  fresh: number | null;
  stale: number | null;
  unknownFreshness?: number | null;
  candidates: number | null;
  qualified: number | null;
  rejected: number | null;
  errors: number | null;
};
export function scannerMetrics(value: unknown): ScannerMetrics {
  const v =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const metric = (key: string) =>
    typeof v[key] === "number" && Number.isFinite(v[key]) && Number(v[key]) >= 0
      ? Number(v[key])
      : null;
  return {
    events: metric("events"),
    markets: metric("markets"),
    fresh: metric("fresh"),
    stale: metric("stale"),
    unknownFreshness: metric("unknownFreshness"),
    candidates: metric("candidates"),
    qualified: metric("qualified"),
    rejected: metric("rejected"),
    errors: metric("errors"),
  };
}
export type ScannerDashboard = {
  dataOnly?: {
    status: "NOT_RUN" | "MARKET_DATA_READY" | "MARKET_DATA_UNAVAILABLE";
    modelStatus: "MODEL_PROBABILITY_UNAVAILABLE";
    observedAt: string | null;
    marketsEvaluated: number | null;
  };
  configured: boolean;
  status: "RUNNING" | "PAUSED" | "DEGRADED";
  lastSuccessfulScan: string | null;
  nextScheduledScan: string | null;
  provider: string | null;
  quotaRemaining: number | null;
  metrics: ScannerMetrics;
  schedules: (ScannerSchedule & { nextAt: string | null })[];
  runs: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    metrics: ScannerMetrics;
  }[];
  alerts: {
    id: string;
    kind: string;
    severity: string;
    message: string;
    createdAt: string;
    href: string | null;
  }[];
};
