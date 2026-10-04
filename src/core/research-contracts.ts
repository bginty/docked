import { z } from "zod";
import {
  researchConfidence,
  researchFactTypes,
  researchId,
  researchTeamId,
  researchInstant,
  researchSha,
  researchSourceSchema,
  type ResearchSource,
  type MatchResearchFile,
} from "./research-engine";
import {
  researchFeatureSchema,
  type ResearchFeature,
} from "./research-features";

const reason = z.string().trim().min(12).max(2000);
export const researchPolicySchema = z
  .object({
    version: researchId,
    jurisdiction: researchId,
    requiredFactTypes: z
      .array(z.enum(researchFactTypes))
      .min(1)
      .refine((v) => new Set(v).size === v.length),
    maxFactAgeSeconds: z.number().int().min(1).max(31536000),
    windowsSeconds: z
      .array(z.number().int().min(60).max(604800))
      .min(1)
      .max(12)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict();
export type ResearchPolicy = z.infer<typeof researchPolicySchema>;
export const researchContentTypes = [
  "DOCKED_RESEARCH",
  "MATCH_UPDATE",
  "LINEUP_UPDATE",
] as const;
export const researchActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("source_review"),
      configuration: researchSourceSchema,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("feature_review"),
      configuration: researchFeatureSchema,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("policy_review"),
      configuration: researchPolicySchema,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("fact_record"),
      sourceReviewId: z.uuid(),
      eventId: researchId,
      type: z.enum(researchFactTypes),
      teamId: researchTeamId.nullable(),
      playerId: researchId.nullable(),
      value: z.record(z.string(), z.unknown()),
      sourceItemId: researchId,
      sourceRevision: researchId,
      sourcePublishedAt: researchInstant.nullable(),
      sourceObservedAt: researchInstant,
      effectiveAt: researchInstant,
      expiresAt: researchInstant,
      confidence: z.enum(researchConfidence),
      evidenceUrl: z.string().url().max(2000),
      evidenceHash: researchSha,
      supersedesId: researchId.nullable(),
      recordState: z.enum(["ASSERTED", "WITHDRAWN"]).default("ASSERTED"),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("snapshot"),
      eventId: researchId,
      policyId: z.uuid(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("content_draft"),
      snapshotId: z.uuid(),
      type: z.enum(researchContentTypes),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("content_review"),
      id: z.uuid(),
      publish: z.boolean(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("schedule"),
      sourceReviewId: z.uuid(),
      policyId: z.uuid(),
      enabled: z.boolean(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("enqueue"),
      scheduleId: z.uuid(),
      eventId: researchId,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("recalculate"),
      snapshotId: z.uuid(),
      modelVersion: researchId,
      reason,
    })
    .strict(),
]);
export type ResearchAction = z.infer<typeof researchActionSchema>;
export type ResearchCapabilities = {
  govern: boolean;
  recordFacts: boolean;
  editorial: boolean;
  enqueue: boolean;
};
export type ResearchMatchOption = {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  startAt: string;
  status: string;
};
export type ResearchDashboard = {
  status: "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";
  message: string;
  capabilities: ResearchCapabilities;
  automationEnabled: boolean;
  sources: {
    id: string;
    configuration: ResearchSource;
    createdAt: string;
    current: boolean;
    health: {
      lastSuccess: string | null;
      lastFailure: string | null;
      errorCode: string | null;
      requestsToday: number;
      reservedRequests: number;
      lastHttpStatus: number | null;
      lastMeasured: Record<string, unknown> | null;
    };
  }[];
  features: { id: string; configuration: ResearchFeature; current: boolean }[];
  policies: { id: string; configuration: ResearchPolicy }[];
  models: { id: string }[];
  matches: ResearchMatchOption[];
  schedules: {
    id: string;
    sourceReviewId: string;
    policyId: string;
    enabled: boolean;
    nextRun: string | null;
  }[];
  jobs: { id: string; state: string; attempts: number; createdAt: string }[];
  content: {
    id: string;
    eventId: string;
    snapshotId: string;
    type: (typeof researchContentTypes)[number];
    headline: string;
    status: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
    createdAt: string;
  }[];
  counts: { facts: number; snapshots: number; pendingJobs: number } | null;
};
export type MatchResearchEnvelope = {
  status: "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";
  message: string;
  event: ResearchMatchOption | null;
  file: MatchResearchFile | null;
  snapshots: { id: string; asOfTime: string; hash: string }[];
  dashboard: ResearchDashboard;
};
export type ReviewedResearchItem = {
  id: string;
  eventId: string;
  type: (typeof researchContentTypes)[number];
  headline: string;
  updatedAt: string;
  snapshotId: string;
  file: MatchResearchFile;
  disclaimer: "DISPLAY_CONTEXT_ONLY";
};
export type ReviewedResearch = {
  status: "READY" | "NOT_CONFIGURED" | "RESTRICTED" | "UNAVAILABLE";
  items: ReviewedResearchItem[];
};
