import { z } from "zod";
// Browser forms use the interpreted parser; the app CSP does not allow eval.
z.config({ jitless: true });

export const commercialFlags = Object.freeze({
  PAID_PLANS_ENABLED: false,
  PRO_ENTITLEMENTS_ENABLED: false,
  COMPETITIONS_ENABLED: false,
  PRIZES_ENABLED: false,
  DEALS_ENABLED: false,
  AFFILIATES_ENABLED: false,
} as const);

export const freeEntitlements = [
  "community",
  "follows",
  "social_posts",
  "community_edges",
  "public_profile",
  "top_docked",
  "core_official_edges",
  "standard_alerts",
  "public_results",
  "methodology",
  "education",
  "basic_tracking",
  "safety_and_corrections",
] as const;
export const futureProBenefits = [
  "Additional reviewed analysis products",
  "Advanced filters and statistics",
  "Personal analytics and watchlists",
  "Additional alert controls",
  "Ad-free experience",
  "Early access to reviewed features",
] as const;
export const membershipPlans = [
  {
    id: "FREE",
    name: "Docked Free",
    available: true,
    price: "Free",
    benefits: freeEntitlements,
  },
  {
    id: "PRO",
    name: "Docked Pro",
    available: false,
    price: null,
    benefits: futureProBenefits,
  },
] as const;

export function membershipSummary(
  launchAt: string | null = null,
  now = new Date().toISOString(),
) {
  const date = launchAt === null ? null : new Date(launchAt);
  if (date && !Number.isFinite(date.getTime()))
    throw new Error("Invalid recorded launch date");
  if (!Number.isFinite(Date.parse(now)))
    throw new Error("Invalid membership timestamp");
  let freeYearEndsAt: string | null = null;
  if (date) {
    const end = new Date(date);
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const lastDay = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setUTCDate(Math.min(day, lastDay));
    freeYearEndsAt = end.toISOString();
  }
  return {
    plan: "FREE" as const,
    billingEnabled: false,
    proEnabled: false,
    autoConversion: false,
    paymentMethodRequired: false,
    freeYearEndsAt,
    growthYear:
      date === null
        ? ("NOT_STARTED" as const)
        : Date.parse(now) < date.getTime()
          ? ("NOT_STARTED" as const)
          : Date.parse(now) < Date.parse(freeYearEndsAt!)
            ? ("IN_PROGRESS" as const)
            : ("ENDED" as const),
    entitlements: freeEntitlements,
    message:
      "Free for the first 12 months from the recorded public launch. No card required and no automatic conversion. Core Free functionality remains available afterwards.",
  };
}

export function entitlementAllowed(feature: string) {
  // Membership never bypasses provider, safety, jurisdiction or validation gates.
  return (freeEntitlements as readonly string[]).includes(feature);
}

const instant = z.string().datetime({ offset: true });
const reference = z.string().trim().min(12).max(2000);
export const competitionDraftSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    description: z.string().trim().min(30).max(4000),
    country: z.string().regex(/^[A-Z]{2}$/),
    state: z.string().min(1).max(50),
    minimumAge: z.number().int().min(18).max(100),
    membership: z.enum(["FREE", "FREE_AND_PRO", "FUTURE_PRO"]),
    startsAt: instant,
    endsAt: instant,
    entryCutoff: instant,
    sports: z.array(z.string().min(1).max(60)).min(1).max(10),
    markets: z.array(z.string().min(1).max(100)).min(1).max(30),
    rankingRuleVersion: z.string().min(3).max(100),
    minimumSettled: z.number().int().min(20),
    minimumActiveDays: z.number().int().min(7),
    prize: z.string().trim().min(3).max(1000),
    prizeValue: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    sponsor: z.string().trim().min(2).max(160),
    officialRulesVersion: z.string().min(3).max(100),
    entryLimit: z.literal(1),
    tieBreaker: z.literal("NET_UNITS_ROI_SETTLED_EARLIEST"),
    exclusions: z.array(z.string().min(3).max(300)).min(1).max(30),
    mechanics: z.enum([
      "STANDARD_VERIFIED_PERFORMANCE",
      "NON_WAGER_PREDICTION",
    ]),
    reason: reference,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      Date.parse(v.endsAt) <= Date.parse(v.startsAt) ||
      Date.parse(v.entryCutoff) > Date.parse(v.startsAt)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Entry closes before the competition starts; end must follow start.",
      });
    if ((v.prizeValue === null) !== (v.currency === null))
      ctx.addIssue({
        code: "custom",
        message: "Prize value and currency must be supplied together.",
      });
  });

export const dealDraftSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    description: z.string().trim().min(30).max(4000),
    sponsor: z.string().trim().min(2).max(160),
    category: z.enum([
      "MERCHANDISE",
      "MEDIA",
      "TICKETS",
      "DOCKED_BENEFIT",
      "NON_GAMBLING",
      "BETTING_REVIEW_REQUIRED",
    ]),
    country: z.string().regex(/^[A-Z]{2}$/),
    state: z.string().min(1).max(50),
    membership: z.enum(["FREE", "FREE_AND_PRO", "FUTURE_PRO"]),
    startsAt: instant,
    endsAt: instant,
    terms: reference,
    disclosure: reference,
    trackingClass: z.enum(["NONE", "CONSENTED_AGGREGATE"]),
    reason: reference,
  })
  .strict()
  .refine(
    (v) => Date.parse(v.endsAt) > Date.parse(v.startsAt),
    "End must follow start",
  );

export const awardStates = [
  "CALCULATED",
  "INTEGRITY_REVIEW",
  "ELIGIBILITY_REVIEW",
  "APPROVED",
  "AWARDED",
  "DISQUALIFIED",
] as const;
export type AwardState = (typeof awardStates)[number];
/** Future state machine only. Storage activation and awarding remain disabled. */
export function awardTransition(
  from: AwardState,
  to: AwardState,
  reason: string,
) {
  if (reason.trim().length < 12) return false;
  const next: Record<AwardState, readonly AwardState[]> = {
    CALCULATED: ["INTEGRITY_REVIEW", "DISQUALIFIED"],
    INTEGRITY_REVIEW: ["ELIGIBILITY_REVIEW", "DISQUALIFIED"],
    ELIGIBILITY_REVIEW: ["APPROVED", "DISQUALIFIED"],
    APPROVED: ["AWARDED", "DISQUALIFIED"],
    AWARDED: [],
    DISQUALIFIED: [],
  };
  return next[from].includes(to);
}

export const commercialReviewTopics = [
  "jurisdiction",
  "rules",
  "prize_tax_permit",
  "privacy",
  "marketing",
  "sponsor",
  "responsible_design",
] as const;
