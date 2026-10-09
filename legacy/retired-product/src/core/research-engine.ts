import { z } from "zod";
import { phase5Hash } from "./phase5-hash";

export const researchFactTypes = [
  "PLAYER_INJURY",
  "PLAYER_SUSPENSION",
  "PLAYER_RETURN",
  "EXPECTED_LINEUP",
  "CONFIRMED_LINEUP",
  "MANAGER_CHANGE",
  "TEAM_FORM_UPDATE",
  "PLAYER_FORM_UPDATE",
  "MATCH_RESULT",
  "TEAM_STAT_UPDATE",
  "PLAYER_STAT_UPDATE",
  "REST_ADVANTAGE",
  "SCHEDULE_CONGESTION",
  "WEATHER_UPDATE",
  "VENUE_CHANGE",
  "MATCH_POSTPONED",
  "MATCH_CANCELLED",
] as const;
export const researchRightsStates = [
  "APPROVED_AUTOMATED",
  "APPROVED_MANUAL_ONLY",
  "PERMISSION_REQUIRED",
  "REVIEW_REQUIRED",
  "PROHIBITED",
] as const;
export const researchReliability = [
  "TIER_1_CONFIRMED_OFFICIAL",
  "TIER_2_AUTHORISED_STRUCTURED",
  "TIER_3_RELIABLE_REPORTED",
  "TIER_4_UNCONFIRMED",
] as const;
export const researchConfidence = [
  "CONFIRMED",
  "REPORTED",
  "RUMOUR",
  "MODEL_DERIVED",
] as const;
export const researchId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
/** Current canonical events identify participants by exact provider-mapped label, not an inferred slug. */
export const researchTeamId = z
  .string()
  .min(1)
  .max(160)
  .refine(
    (v) => v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v),
    "Exact canonical participant label required",
  );
export const researchInstant = z.iso.datetime({ offset: true });
export const researchSha = z.string().regex(/^[a-f0-9]{64}$/);
const permission = z.enum(["ALLOWED", "UNKNOWN", "DENIED"]);
const unique = <T>(items: T[]) => new Set(items).size === items.length;
const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      !u.search &&
      !u.port &&
      !/^(localhost|.*\.localhost|.*\.local|[\d.]+|\[.*\])$/i.test(u.hostname)
    );
  }, "Public HTTPS URL without credentials required");
export const researchSourceSchema = z
  .object({
    schemaVersion: z.literal("research-source-v1"),
    sourceId: researchId,
    version: researchId,
    name: z.string().trim().min(1).max(200),
    domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
    category: z.enum([
      "OFFICIAL",
      "STRUCTURED_DATA",
      "NEWS",
      "WEATHER",
      "DERIVED",
    ]),
    accessMethod: z.enum(["API", "FEED", "PAGE", "MANUAL", "DATASET"]),
    endpoint: httpsUrl,
    rightsState: z.enum(researchRightsStates),
    commercialUse: permission,
    publicDisplay: permission,
    storage: z
      .object({
        permission,
        maxDays: z.number().int().positive().max(36500).nullable(),
        immutableEvidenceAllowed: z.boolean(),
      })
      .strict(),
    derivedUse: permission,
    modelUse: permission,
    automation: permission,
    robots: z.enum(["ALLOWED", "DISALLOWED", "UNKNOWN", "NOT_APPLICABLE"]),
    etiquette: z
      .object({
        minimumIntervalSeconds: z.number().int().positive().nullable(),
        maximumRequestsPerDay: z.number().int().positive().nullable(),
      })
      .strict(),
    attribution: z
      .object({ label: z.string().trim().min(1).max(200), url: httpsUrl })
      .strict(),
    dataTypes: z.array(z.enum(researchFactTypes)).min(1).refine(unique),
    reliability: z.enum(researchReliability),
    jurisdictions: z.array(researchId).min(1).refine(unique),
    reviewedAt: researchInstant,
    reviewDueAt: researchInstant,
    effectiveFrom: researchInstant,
    effectiveTo: researchInstant,
    evidenceUrls: z.array(httpsUrl).min(1).max(20),
    notes: z.string().max(2000),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (new URL(s.endpoint).hostname !== s.domain)
      ctx.addIssue({
        code: "custom",
        message: "Endpoint must match reviewed domain",
      });
    if (
      Date.parse(s.reviewDueAt) <= Date.parse(s.reviewedAt) ||
      Date.parse(s.effectiveTo) <= Date.parse(s.effectiveFrom)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid source approval interval",
      });
    if (s.storage.permission === "ALLOWED" && s.storage.maxDays === null)
      ctx.addIssue({
        code: "custom",
        message: "Explicit retention limit required",
      });
  });
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchFactType = (typeof researchFactTypes)[number];
export const validateResearchSource = (value: unknown): ResearchSource =>
  researchSourceSchema.parse(value);
export const researchSourceHash = (value: unknown) =>
  phase5Hash(validateResearchSource(value));
export type ResearchUse = {
  purpose: "DISPLAY" | "MODEL" | "AUTOMATED_FETCH";
  asOfTime: string;
  jurisdiction: string;
  retainUntil?: string;
};
/** Permission check only. Caller must also authenticate, lock the current review and enforce network quotas. */
export function sourceUseDecision(
  value: ResearchSource,
  request: ResearchUse,
): { allowed: boolean; reasons: string[] } {
  const s = validateResearchSource(value),
    now = Date.parse(researchInstant.parse(request.asOfTime));
  const reasons: string[] = [];
  if (!["APPROVED_AUTOMATED", "APPROVED_MANUAL_ONLY"].includes(s.rightsState))
    reasons.push("SOURCE_NOT_APPROVED");
  if (
    Date.parse(s.reviewedAt) > now ||
    Date.parse(s.effectiveFrom) > now ||
    Date.parse(s.reviewDueAt) <= now ||
    Date.parse(s.effectiveTo) <= now
  )
    reasons.push("SOURCE_REVIEW_NOT_CURRENT");
  if (!s.jurisdictions.includes(request.jurisdiction))
    reasons.push("JURISDICTION_NOT_APPROVED");
  if (
    s.commercialUse !== "ALLOWED" ||
    s.storage.permission !== "ALLOWED" ||
    !s.storage.immutableEvidenceAllowed
  )
    reasons.push("RETENTION_OR_COMMERCIAL_RIGHTS_UNAVAILABLE");
  if (request.retainUntil) {
    const until = Date.parse(researchInstant.parse(request.retainUntil));
    if (
      until < now ||
      s.storage.maxDays === null ||
      until > now + s.storage.maxDays * 86400000 ||
      until > Date.parse(s.effectiveTo)
    )
      reasons.push("RETENTION_LIMIT_EXCEEDED");
  }
  if (request.purpose === "DISPLAY" && s.publicDisplay !== "ALLOWED")
    reasons.push("PUBLIC_DISPLAY_NOT_APPROVED");
  if (
    request.purpose === "MODEL" &&
    (s.modelUse !== "ALLOWED" ||
      s.derivedUse !== "ALLOWED" ||
      s.reliability === "TIER_4_UNCONFIRMED")
  )
    reasons.push("MODEL_RIGHTS_UNAVAILABLE");
  if (
    request.purpose === "AUTOMATED_FETCH" &&
    (s.rightsState !== "APPROVED_AUTOMATED" ||
      s.automation !== "ALLOWED" ||
      !["ALLOWED", "NOT_APPLICABLE"].includes(s.robots) ||
      s.accessMethod === "MANUAL" ||
      !s.etiquette.minimumIntervalSeconds ||
      !s.etiquette.maximumRequestsPerDay)
  )
    reasons.push("AUTOMATION_NOT_APPROVED");
  if (
    request.purpose === "AUTOMATED_FETCH" &&
    s.accessMethod === "PAGE" &&
    s.robots !== "ALLOWED"
  )
    reasons.push("PAGE_ROBOTS_NOT_APPROVED");
  return { allowed: reasons.length === 0, reasons };
}

const decimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .max(60);
export const researchMetric = z.enum([
  "goals",
  "goals_conceded",
  "shots",
  "shots_on_target",
  "assists",
  "minutes",
  "xg",
  "xg_conceded",
  "xg_per_90",
  "goals_per_90",
  "points",
  "wins",
  "draws",
  "losses",
  "clean_sheets",
  "possession_pct",
  "passes",
  "tackles",
  "saves",
]);
const stat = z
  .object({
    metric: researchMetric,
    value: decimal.refine(
      (v) => !v.startsWith("-"),
      "Sporting counts/rates cannot be negative",
    ),
    unit: z.enum(["count", "minutes", "per_90", "percent", "per_match"]),
    competitionId: researchId,
    season: researchId,
    venue: z.enum(["HOME", "AWAY", "ALL"]),
    periodStart: researchInstant,
    periodEnd: researchInstant,
    sampleMatches: z.number().int().positive(),
    sampleMinutes: z.number().int().nonnegative().nullable(),
    opponentAdjustment: z.enum(["UNADJUSTED", "ADJUSTED"]),
    adjustmentVersion: researchId.nullable(),
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.periodStart) < Date.parse(v.periodEnd) &&
      (v.unit !== "percent" || Number(v.value) <= 100) &&
      (v.metric !== "possession_pct" || v.unit === "percent") &&
      (!v.metric.endsWith("_per_90") || v.unit === "per_90") &&
      (v.opponentAdjustment === "UNADJUSTED"
        ? v.adjustmentVersion === null
        : v.adjustmentVersion !== null),
    "Invalid statistic context",
  );
const availability = z
  .object({
    status: z.enum(["OUT", "DOUBTFUL", "AVAILABLE", "UNKNOWN"]),
    reason: z.enum(["INJURY", "SUSPENSION", "RETURN", "OTHER", "UNKNOWN"]),
  })
  .strict();
const lineup = z
  .object({
    playerIds: z.array(researchId).min(1).max(11).refine(unique),
    formation: z
      .string()
      .regex(/^\d(?:-\d){1,4}$/)
      .nullable(),
  })
  .strict();
const factValues = {
  PLAYER_INJURY: availability,
  PLAYER_SUSPENSION: availability,
  PLAYER_RETURN: availability,
  EXPECTED_LINEUP: lineup,
  CONFIRMED_LINEUP: lineup.refine(
    (v) => v.playerIds.length === 11,
    "Confirmed eleven required",
  ),
  MANAGER_CHANGE: z
    .object({
      previousManagerId: researchId.nullable(),
      newManagerId: researchId,
    })
    .strict(),
  TEAM_FORM_UPDATE: stat,
  PLAYER_FORM_UPDATE: stat,
  TEAM_STAT_UPDATE: stat,
  PLAYER_STAT_UPDATE: stat,
  MATCH_RESULT: z
    .object({
      homeGoals: z.number().int().min(0).max(100),
      awayGoals: z.number().int().min(0).max(100),
      period: z.literal("REGULATION"),
      status: z.literal("FINAL"),
    })
    .strict(),
  REST_ADVANTAGE: z
    .object({
      restHours: decimal.refine((v) => !v.startsWith("-")),
      opponentRestHours: decimal.refine((v) => !v.startsWith("-")),
      previousEventId: researchId,
      opponentPreviousEventId: researchId,
    })
    .strict(),
  SCHEDULE_CONGESTION: z
    .object({
      windowStart: researchInstant,
      windowEnd: researchInstant,
      eventIds: z.array(researchId).min(1).refine(unique),
    })
    .strict(),
  WEATHER_UPDATE: z
    .object({
      temperatureCelsius: decimal.nullable(),
      windKph: decimal.refine((v) => !v.startsWith("-")).nullable(),
      precipitationMm: decimal.refine((v) => !v.startsWith("-")).nullable(),
      forecastFor: researchInstant,
    })
    .strict()
    .refine(
      (v) =>
        v.temperatureCelsius !== null ||
        v.windKph !== null ||
        v.precipitationMm !== null,
      "At least one observed/forecast weather value required",
    ),
  VENUE_CHANGE: z
    .object({ previousVenueId: researchId.nullable(), venueId: researchId })
    .strict(),
  MATCH_POSTPONED: z
    .object({
      status: z.literal("POSTPONED"),
      newStartAt: researchInstant.nullable(),
    })
    .strict(),
  MATCH_CANCELLED: z.object({ status: z.literal("CANCELLED") }).strict(),
};
const factEnvelope = z
  .object({
    schemaVersion: z.literal("research-fact-v1"),
    id: researchId,
    type: z.enum(researchFactTypes),
    eventId: researchId,
    teamId: researchTeamId.nullable(),
    playerId: researchId.nullable(),
    value: z.unknown(),
    sourceId: researchId,
    sourceVersion: researchId,
    sourceItemId: researchId,
    sourceRevision: researchId,
    sourcePublishedAt: researchInstant.nullable(),
    sourceObservedAt: researchInstant,
    ingestedAt: researchInstant,
    effectiveAt: researchInstant,
    expiresAt: researchInstant,
    confidence: z.enum(researchConfidence),
    reliability: z.enum(researchReliability),
    evidenceUrl: httpsUrl,
    evidenceHash: researchSha,
    supersedesId: researchId.nullable(),
    recordState: z.enum(["ASSERTED", "WITHDRAWN"]),
    correctionReason: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();
export type ResearchFact = Omit<z.infer<typeof factEnvelope>, "value"> & {
  value: Record<string, unknown>;
};
export function validateResearchFact(value: unknown): ResearchFact {
  const f = factEnvelope.parse(value),
    parsed = factValues[f.type].parse(f.value);
  if (
    (f.sourcePublishedAt !== null &&
      Date.parse(f.sourcePublishedAt) > Date.parse(f.sourceObservedAt)) ||
    Date.parse(f.sourceObservedAt) > Date.parse(f.ingestedAt) ||
    Date.parse(f.expiresAt) <= Date.parse(f.ingestedAt) ||
    Date.parse(f.expiresAt) <= Date.parse(f.effectiveAt)
  )
    throw Error("Invalid fact observation or expiry");
  if (
    f.supersedesId === f.id ||
    (f.supersedesId === null) !== (f.correctionReason === null) ||
    (f.recordState === "WITHDRAWN" && !f.supersedesId)
  )
    throw Error("Correction requires predecessor and reason");
  if (f.type.startsWith("PLAYER_") && (!f.playerId || !f.teamId))
    throw Error("Player and team mapping required");
  if (
    (f.type.startsWith("TEAM_") ||
      f.type.includes("LINEUP") ||
      ["MANAGER_CHANGE", "REST_ADVANTAGE", "SCHEDULE_CONGESTION"].includes(
        f.type,
      )) &&
    !f.teamId
  )
    throw Error("Team mapping required");
  if (f.type === "CONFIRMED_LINEUP" && f.confidence !== "CONFIRMED")
    throw Error("Confirmed lineup needs confirmed evidence");
  if (f.reliability === "TIER_4_UNCONFIRMED" && f.confidence === "CONFIRMED")
    throw Error("Unconfirmed source cannot assert confirmation");
  if (
    "periodEnd" in parsed &&
    Date.parse(parsed.periodEnd as string) > Date.parse(f.effectiveAt)
  )
    throw Error("Statistic period must be completed by effective time");
  return { ...f, value: parsed };
}
export const researchFactHash = (value: unknown) =>
  phase5Hash(validateResearchFact(value));
export const researchFactKey = (f: ResearchFact) =>
  phase5Hash({
    eventId: f.eventId,
    teamId: f.teamId,
    playerId: f.playerId,
    type: f.type,
    context:
      "metric" in f.value
        ? {
            metric: f.value.metric,
            unit: f.value.unit,
            competitionId: f.value.competitionId,
            season: f.value.season,
            venue: f.value.venue,
            periodStart: f.value.periodStart,
            periodEnd: f.value.periodEnd,
            opponentAdjustment: f.value.opponentAdjustment,
            adjustmentVersion: f.value.adjustmentVersion,
          }
        : null,
  });
export type ResolvedResearchFact = {
  key: string;
  status: "VERIFIED" | "REPORTED" | "CONFLICTING_EVIDENCE";
  fact: ResearchFact;
  corroboratingIds: string[];
  conflictingIds: string[];
  preferredFactId: string | null;
};
const ancestrySchema = z
  .object({
    id: researchId,
    eventId: researchId,
    sourceId: researchId,
    factKey: researchSha,
    ingestedAt: researchInstant,
    effectiveAt: researchInstant,
    supersedesId: researchId.nullable(),
  })
  .strict();
/** Trusted immutable ledger metadata only; never substitutes for a retained licensed fact value. */
export type ResearchFactAncestry = z.infer<typeof ancestrySchema>;
const normaliseAncestry = (
  value: ResearchFactAncestry,
): ResearchFactAncestry => ({
  ...value,
  ingestedAt: new Date(value.ingestedAt).toISOString(),
  effectiveAt: new Date(value.effectiveAt).toISOString(),
});
export const researchFactAncestry = (
  value: ResearchFact,
): ResearchFactAncestry =>
  normaliseAncestry({
    id: value.id,
    eventId: value.eventId,
    sourceId: value.sourceId,
    factKey: researchFactKey(value),
    ingestedAt: value.ingestedAt,
    effectiveAt: value.effectiveAt,
    supersedesId: value.supersedesId,
  });
export type ResearchResolution = {
  facts: ResolvedResearchFact[];
  rejected: { id: string; reason: string }[];
  timeline: ResearchFact[];
  ancestry: ResearchFactAncestry[];
};
/** Does not choose a favourable assertion. Conflicts are retained even when official evidence is preferred for display. */
export function resolveResearchFacts(
  values: ResearchFact[],
  sources: ResearchSource[],
  request: Omit<ResearchUse, "purpose"> & { purpose?: "DISPLAY" | "MODEL" },
  ancestry: ResearchFactAncestry[] = [],
): ResearchResolution {
  const now = Date.parse(researchInstant.parse(request.asOfTime)),
    rejected: ResearchResolution["rejected"] = [];
  sources.forEach(validateResearchSource);
  if (
    new Set(sources.map((s) => `${s.sourceId}:${s.version}`)).size !==
      sources.length ||
    new Set(sources.map((s) => `${s.sourceId}:${Date.parse(s.reviewedAt)}`))
      .size !== sources.length
  )
    throw Error("Ambiguous source review versions");
  const all = values.map(validateResearchFact),
    byId = new Map<string, ResearchFactAncestry>();
  for (const value of ancestry) {
    const metadata = normaliseAncestry(ancestrySchema.parse(value));
    if (byId.has(metadata.id))
      throw Error("Duplicate immutable ancestry identity");
    byId.set(metadata.id, metadata);
  }
  const payloadIds = new Set<string>();
  for (const f of all) {
    if (payloadIds.has(f.id)) throw Error("Duplicate immutable fact identity");
    payloadIds.add(f.id);
    const metadata = researchFactAncestry(f),
      existing = byId.get(f.id);
    if (existing && phase5Hash(existing) !== phase5Hash(metadata))
      throw Error("Fact payload does not match retained ancestry");
    byId.set(f.id, metadata);
  }
  const known = all.filter(
    (f) =>
      Date.parse(f.ingestedAt) <= now &&
      (f.sourcePublishedAt === null ||
        Date.parse(f.sourcePublishedAt) <= now) &&
      Date.parse(f.sourceObservedAt) <= now &&
      Date.parse(f.effectiveAt) <= now,
  );
  const knownAncestry = [...byId.values()].filter(
    (f) => Date.parse(f.ingestedAt) <= now && Date.parse(f.effectiveAt) <= now,
  );
  const superseded = new Set<string>(),
    invalidChains = new Set<string>();
  for (const f of knownAncestry)
    if (f.supersedesId) {
      const prior = byId.get(f.supersedesId);
      if (
        !prior ||
        !knownAncestry.includes(prior) ||
        prior.sourceId !== f.sourceId ||
        prior.eventId !== f.eventId ||
        prior.factKey !== f.factKey ||
        Date.parse(prior.ingestedAt) >= Date.parse(f.ingestedAt) ||
        knownAncestry.filter((x) => x.supersedesId === prior.id).length > 1
      ) {
        invalidChains.add(f.id);
        if (prior) invalidChains.add(prior.id);
      } else superseded.add(prior.id);
    }
  // A later correction cannot repair missing/branched ancestry by merely naming the invalid row.
  for (let pass = 0; pass < knownAncestry.length; pass++)
    for (const f of knownAncestry)
      if (f.supersedesId && invalidChains.has(f.supersedesId))
        invalidChains.add(f.id);
  const valid: ResearchFact[] = [];
  for (const f of known) {
    let reason: string | null = null;
    const s = sources.find(
      (s) => s.sourceId === f.sourceId && s.version === f.sourceVersion,
    );
    const current = sources
      .filter(
        (s) => s.sourceId === f.sourceId && Date.parse(s.reviewedAt) <= now,
      )
      .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))[0];
    if (invalidChains.has(f.id)) reason = "INVALID_CORRECTION_CHAIN";
    else if (superseded.has(f.id) || f.recordState === "WITHDRAWN")
      reason = "SUPERSEDED_OR_WITHDRAWN";
    else if (Date.parse(f.expiresAt) <= now) reason = "STALE";
    else if (
      !s ||
      !current ||
      current.version !== f.sourceVersion ||
      !sourceUseDecision(s, {
        ...request,
        purpose: request.purpose ?? "DISPLAY",
      }).allowed ||
      !sourceUseDecision(current, {
        ...request,
        purpose: request.purpose ?? "DISPLAY",
      }).allowed ||
      !s.dataTypes.includes(f.type) ||
      f.reliability !== s.reliability
    )
      reason = "SOURCE_AUTHORITY_UNAVAILABLE";
    else if (
      s.storage.maxDays === null ||
      Date.parse(f.expiresAt) >
        Date.parse(f.ingestedAt) + s.storage.maxDays * 86400000 ||
      Date.parse(f.expiresAt) > Date.parse(s.effectiveTo)
    )
      reason = "RETENTION_LIMIT_EXCEEDED";
    else if (
      Date.parse(s.reviewedAt) > Date.parse(f.ingestedAt) ||
      Date.parse(s.effectiveFrom) > Date.parse(f.ingestedAt)
    )
      reason = "SOURCE_APPROVAL_NOT_KNOWN_AT_INGESTION";
    if (reason) rejected.push({ id: f.id, reason });
    else valid.push(f);
  }
  for (const f of all.filter((f) => !known.includes(f)))
    rejected.push({ id: f.id, reason: "FUTURE_EVIDENCE" });
  const groups = new Map<string, ResearchFact[]>();
  for (const f of valid) {
    const k = researchFactKey(f);
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const facts = [...groups.entries()]
    .map(([key, group]): ResolvedResearchFact => {
      group.sort(
        (a, b) =>
          Number(b.confidence === "CONFIRMED") -
            Number(a.confidence === "CONFIRMED") ||
          a.reliability.localeCompare(b.reliability) ||
          Date.parse(a.ingestedAt) - Date.parse(b.ingestedAt) ||
          a.id.localeCompare(b.id),
      );
      const official = group.filter(
        (f) =>
          f.confidence === "CONFIRMED" &&
          f.reliability === "TIER_1_CONFIRMED_OFFICIAL",
      );
      const selected = official[0] ?? group[0],
        distinct = new Set(group.map((f) => phase5Hash(f.value)));
      return {
        key,
        status:
          distinct.size > 1
            ? "CONFLICTING_EVIDENCE"
            : group.some((f) => f.confidence === "CONFIRMED")
              ? "VERIFIED"
              : "REPORTED",
        fact: selected,
        corroboratingIds: group
          .filter((f) => phase5Hash(f.value) === phase5Hash(selected.value))
          .map((f) => f.id),
        conflictingIds: group
          .filter((f) => phase5Hash(f.value) !== phase5Hash(selected.value))
          .map((f) => f.id),
        preferredFactId:
          official.length &&
          new Set(official.map((f) => phase5Hash(f.value))).size === 1
            ? selected.id
            : null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    facts,
    rejected,
    ancestry: knownAncestry.sort((a, b) => a.id.localeCompare(b.id)),
    timeline: known.sort(
      (a, b) =>
        Date.parse(a.ingestedAt) - Date.parse(b.ingestedAt) ||
        a.id.localeCompare(b.id),
    ),
  };
}

export const matchResearchSections = [
  "TEAM_STRENGTH",
  "RECENT_FORM",
  "HOME_AWAY_FORM",
  "HEAD_TO_HEAD",
  "EXPECTED_GOALS",
  "ATTACK_DEFENCE",
  "PLAYER_FORM",
  "PLAYER_AVAILABILITY",
  "EXPECTED_LINEUP",
  "CONFIRMED_LINEUP",
  "REST_SCHEDULE",
  "WEATHER_VENUE",
  "RESULTS",
] as const;
export type MatchResearchSection = (typeof matchResearchSections)[number];
const sectionFor: Record<ResearchFactType, MatchResearchSection> = {
  PLAYER_INJURY: "PLAYER_AVAILABILITY",
  PLAYER_SUSPENSION: "PLAYER_AVAILABILITY",
  PLAYER_RETURN: "PLAYER_AVAILABILITY",
  EXPECTED_LINEUP: "EXPECTED_LINEUP",
  CONFIRMED_LINEUP: "CONFIRMED_LINEUP",
  MANAGER_CHANGE: "TEAM_STRENGTH",
  TEAM_FORM_UPDATE: "RECENT_FORM",
  PLAYER_FORM_UPDATE: "PLAYER_FORM",
  MATCH_RESULT: "RESULTS",
  TEAM_STAT_UPDATE: "ATTACK_DEFENCE",
  PLAYER_STAT_UPDATE: "PLAYER_FORM",
  REST_ADVANTAGE: "REST_SCHEDULE",
  SCHEDULE_CONGESTION: "REST_SCHEDULE",
  WEATHER_UPDATE: "WEATHER_VENUE",
  VENUE_CHANGE: "WEATHER_VENUE",
  MATCH_POSTPONED: "WEATHER_VENUE",
  MATCH_CANCELLED: "WEATHER_VENUE",
};
export type PublicResearchFact = {
  id: string;
  type: ResearchFactType;
  teamId: string | null;
  playerId: string | null;
  value: Record<string, unknown>;
  confidence: ResearchFact["confidence"];
  status: ResolvedResearchFact["status"];
  sourceLabel: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  sourceObservedAt: string;
  ingestedAt: string;
  effectiveAt: string;
  expiresAt: string;
  corroboratingIds: string[];
  conflictingIds: string[];
};
export type MatchResearchFile = {
  schemaVersion: "match-research-v1";
  event: {
    eventId: string;
    competitionId: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamId: string;
    awayTeamId: string;
    startAt: string;
    venue: string | null;
    status: "scheduled" | "postponed" | "cancelled" | "completed";
  };
  asOfTime: string;
  policyVersion: string;
  status: "NOT_CONFIGURED" | "READY" | "PARTIAL" | "INSUFFICIENT" | "STALE";
  missing: ResearchFactType[];
  sections: {
    key: MatchResearchSection;
    status: "AVAILABLE" | "DATA_NOT_AVAILABLE";
    facts: PublicResearchFact[];
  }[];
  modelStatus: "NOT_CONFIGURED";
  marketStatus: "SEPARATE_MARKET_DATA";
  factIds: string[];
  snapshotHash: string;
};
export function buildMatchResearchFile(input: {
  event: MatchResearchFile["event"];
  asOfTime: string;
  sources: ResearchSource[];
  facts: ResearchFact[];
  ancestry?: ResearchFactAncestry[];
  policy: {
    version: string;
    jurisdiction: string;
    requiredFactTypes: ResearchFactType[];
    maxFactAgeSeconds: number;
  };
}): MatchResearchFile {
  const asOf = Date.parse(researchInstant.parse(input.asOfTime));
  if (
    input.event.competitionId !== "soccer_epl" ||
    input.event.homeTeamId === input.event.awayTeamId
  )
    throw Error(
      "Initial research scope requires a mapped EPL match with distinct teams",
    );
  if (
    !Number.isFinite(input.policy.maxFactAgeSeconds) ||
    input.policy.maxFactAgeSeconds <= 0 ||
    !input.policy.requiredFactTypes.length ||
    !unique(input.policy.requiredFactTypes)
  )
    throw Error("Explicit completeness and freshness policy required");
  if (input.facts.some((f) => f.eventId !== input.event.eventId))
    throw Error("Research facts must match canonical event");
  if (input.ancestry?.some((f) => f.eventId !== input.event.eventId))
    throw Error("Research ancestry must match canonical event");
  if (input.facts.some((f) => f.type === "MATCH_RESULT"))
    throw Error(
      "Target-match results cannot enter a prematch research snapshot",
    );
  if (
    input.facts.some(
      (f) =>
        f.teamId !== null &&
        ![input.event.homeTeamId, input.event.awayTeamId].includes(f.teamId),
    )
  )
    throw Error("Research team must be a canonical participant");
  if (asOf >= Date.parse(researchInstant.parse(input.event.startAt)))
    throw Error(
      "Prematch snapshot must precede kickoff; postmatch research is separate",
    );
  const resolved = resolveResearchFacts(
    input.facts,
    input.sources,
    {
      asOfTime: input.asOfTime,
      jurisdiction: input.policy.jurisdiction,
    },
    input.ancestry,
  );
  const current = resolved.facts.filter(
    (r) =>
      asOf - Date.parse(r.fact.sourcePublishedAt ?? r.fact.sourceObservedAt) <=
      input.policy.maxFactAgeSeconds * 1000,
  );
  const missing = input.policy.requiredFactTypes.filter(
    (t) => !current.some((r) => r.fact.type === t && r.status === "VERIFIED"),
  );
  const sections = matchResearchSections.map((key) => {
    const facts = current
      .filter(
        (r) =>
          ("metric" in r.fact.value &&
          String(r.fact.value.metric).startsWith("xg")
            ? "EXPECTED_GOALS"
            : "venue" in r.fact.value && r.fact.value.venue !== "ALL"
              ? "HOME_AWAY_FORM"
              : sectionFor[r.fact.type]) === key,
      )
      .map((r) => {
        const f = r.fact,
          s = input.sources.find(
            (s) => s.sourceId === f.sourceId && s.version === f.sourceVersion,
          )!;
        return {
          id: f.id,
          type: f.type,
          teamId: f.teamId,
          playerId: f.playerId,
          value: f.value,
          confidence: f.confidence,
          status: r.status,
          sourceLabel: s.attribution.label,
          sourceUrl: s.attribution.url,
          sourcePublishedAt: f.sourcePublishedAt,
          sourceObservedAt: f.sourceObservedAt,
          ingestedAt: f.ingestedAt,
          effectiveAt: f.effectiveAt,
          expiresAt: f.expiresAt,
          corroboratingIds: r.corroboratingIds,
          conflictingIds: r.conflictingIds,
        };
      });
    return {
      key,
      status: facts.length
        ? ("AVAILABLE" as const)
        : ("DATA_NOT_AVAILABLE" as const),
      facts,
    };
  });
  const payload = {
    schemaVersion: "match-research-v1" as const,
    event: input.event,
    asOfTime: input.asOfTime,
    policyVersion: input.policy.version,
    status: !input.sources.length
      ? ("NOT_CONFIGURED" as const)
      : !current.length &&
          (resolved.facts.length > 0 ||
            resolved.rejected.some((r) => r.reason === "STALE"))
        ? ("STALE" as const)
        : !current.length
          ? ("INSUFFICIENT" as const)
          : missing.length ||
              current.some((r) => r.status === "CONFLICTING_EVIDENCE") ||
              input.event.status !== "scheduled"
            ? ("PARTIAL" as const)
            : ("READY" as const),
    missing,
    sections,
    modelStatus: "NOT_CONFIGURED" as const,
    marketStatus: "SEPARATE_MARKET_DATA" as const,
    factIds: current
      .flatMap((r) => [...r.corroboratingIds, ...r.conflictingIds])
      .sort(),
  };
  return {
    ...payload,
    snapshotHash: phase5Hash({
      ...payload,
      policy: input.policy,
      sourceHashes: input.sources
        .filter((s) => Date.parse(s.reviewedAt) <= asOf)
        .map(researchSourceHash)
        .sort(),
      factHashes: resolved.timeline.map(researchFactHash).sort(),
      ancestryHash: phase5Hash(resolved.ancestry),
    }),
  };
}
export type ResearchContentDraft = {
  type: "DOCKED_RESEARCH" | "MATCH_UPDATE" | "LINEUP_UPDATE";
  status: "DRAFT_REQUIRES_REVIEW";
  eventId: string;
  snapshotHash: string;
  asOfTime: string;
  factIds: string[];
  headline: string;
  modelLabel: "DISPLAY_CONTEXT_ONLY";
  facts: PublicResearchFact[];
};
export function researchContentDraft(
  file: MatchResearchFile,
  type: ResearchContentDraft["type"],
): ResearchContentDraft | null {
  const facts = file.sections
    .flatMap((s) => s.facts)
    .filter(
      (f) =>
        f.status !== "CONFLICTING_EVIDENCE" &&
        f.confidence !== "RUMOUR" &&
        (type !== "LINEUP_UPDATE" ||
          f.type === "CONFIRMED_LINEUP" ||
          f.type === "EXPECTED_LINEUP"),
    );
  if (!facts.length) return null;
  return {
    type,
    status: "DRAFT_REQUIRES_REVIEW",
    eventId: file.event.eventId,
    snapshotHash: file.snapshotHash,
    asOfTime: file.asOfTime,
    factIds: facts.map((f) => f.id),
    headline: `${file.event.homeTeam} v ${file.event.awayTeam}: ${type === "LINEUP_UPDATE" ? "lineup research" : "match research"}`,
    modelLabel: "DISPLAY_CONTEXT_ONLY",
    facts,
  };
}
