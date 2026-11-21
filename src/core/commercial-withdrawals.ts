import { z } from "zod";
import {
  assertCommercialApproval,
  commercialCashPolicyVersion,
  type BillingEnvironment,
} from "./commercial-billing";

/** This is a separate, unapproved release policy. The closed-loop policy cannot
 * authorise cash redemption merely because a feature flag was changed. */
export { commercialCashPolicyVersion } from "./commercial-billing";

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reference = z.string().trim().min(8).max(240);
const reason = z.string().trim().min(12).max(600);
const timestamp = z.iso.datetime({ offset: true });
const revision = z.number().int().positive();
const uuid = z.uuid();

/** No commercial rate, limit, bank arrangement or approval is defaulted here.
 * A published policy must explicitly supply every value before activation. */
export const commercialWithdrawalPolicySchema = z
  .object({
    version: reference,
    environment: z.enum(["commercial", "acceptance"]),
    currency: z.literal("AUD"),
    eligibleSource: z.literal("settled-sale-proceeds-only"),
    rate: z.object({ credits: positive, audCents: positive }).strict(),
    minimumCredits: positive,
    maximumCredits: positive,
    dailyMaximumCredits: positive,
    feeCents: nonnegative,
    identityMaxAgeMs: positive,
    approvals: z
      .object({
        owner: reference,
        legalAssessment: reference,
        playAssessment: reference,
        payoutBank: reference,
        privacy: reference,
        refundRecovery: reference,
        validUntil: timestamp,
      })
      .strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.minimumCredits > p.maximumCredits ||
      p.maximumCredits > p.dailyMaximumCredits
    )
      ctx.addIssue({
        code: "custom",
        message: "Withdrawal limits are inconsistent",
      });
  });

export type CommercialWithdrawalPolicy = z.infer<
  typeof commercialWithdrawalPolicySchema
>;

export const commercialWithdrawalIdentitySchema = z
  .object({
    provider: z.literal("sumsub"),
    providerEnvironment: z.enum(["acceptance", "production"]),
    providerApplicantId: z.string().min(1).max(160),
    providerReviewId: z.string().min(1).max(160).nullable(),
    providerReviewedAt: timestamp.nullable(),
    checkedAt: timestamp,
    status: z.enum(["pending", "approved", "rejected"]),
    country: z.string().max(3).nullable(),
    adult: z.boolean(),
    evidenceReference: reference,
    legalNameHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (
      e.status === "approved" &&
      (!e.providerReviewId ||
        !e.providerReviewedAt ||
        !e.legalNameHash ||
        e.country !== "AU" ||
        !e.adult)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Approved identity requires verified adult Australian evidence",
      });
  });
export type CommercialWithdrawalIdentityEvidence = z.infer<
  typeof commercialWithdrawalIdentitySchema
>;

export const commercialWithdrawalDestinationSchema = z
  .object({
    id: uuid,
    identityRevision: revision,
    ciphertext: z.string().min(80).max(8192),
    mask: z.string().regex(/^\*{4}\d{4}$/),
  })
  .strict();

export const commercialWithdrawalMemberEnvelope = z
  .object({
    request: uuid,
    command: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("request"),
          credits: positive,
          destination: uuid,
          identityRevision: revision,
          policyVersion: reference,
        })
        .strict(),
      z
        .object({
          kind: z.literal("cancel"),
          id: uuid,
          expectedRevision: revision,
        })
        .strict(),
    ]),
  })
  .strict();

const existing = { id: uuid, expectedRevision: revision };
export const commercialWithdrawalOwnerEnvelope = z
  .object({
    request: uuid,
    command: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("stop"), reason }).strict(),
      z
        .object({
          kind: z.literal("review"),
          ...existing,
          decision: z.enum(["start", "approve", "reject"]),
          reason,
        })
        .strict(),
      z.object({ kind: z.literal("claim"), ...existing }).strict(),
      z.object({ kind: z.literal("exception"), ...existing, reason }).strict(),
      z
        .object({
          kind: z.literal("record-sent"),
          ...existing,
          bankReference: reference,
          evidenceReference: reference,
          confirmed: z.literal(true),
        })
        .strict(),
      z
        .object({
          kind: z.literal("reconcile"),
          ...existing,
          evidenceReference: reference,
        })
        .strict(),
      z
        .object({
          kind: z.literal("release-unpaid"),
          ...existing,
          evidenceReference: reference,
          reason,
        })
        .strict(),
      z
        .object({
          kind: z.literal("returned"),
          ...existing,
          bankReference: reference,
          evidenceReference: reference,
          reason,
        })
        .strict(),
      z
        .object({
          kind: z.literal("verify-destination"),
          destination: uuid,
          identityRevision: revision,
          verified: z.boolean(),
          evidenceReference: reference,
          reason,
        })
        .strict(),
      z
        .object({
          kind: z.literal("record-funding"),
          receipt: z.string().regex(/^[a-f0-9]{64}$/),
          netCashCents: positive,
          bankReference: reference,
          evidenceReference: reference,
          settledAt: timestamp,
          availableAt: timestamp,
        })
        .strict(),
      z
        .object({
          kind: z.literal("revoke-funding"),
          funding: uuid,
          evidenceReference: reference,
          reason,
        })
        .strict(),
      z
        .object({
          kind: z.literal("resolve-exposure"),
          allocation: uuid,
          evidenceReference: reference,
          reason,
        })
        .strict(),
    ]),
  })
  .strict();

export type CommercialWithdrawalMemberCommand = z.infer<
  typeof commercialWithdrawalMemberEnvelope
>["command"];
export type CommercialWithdrawalOwnerCommand = z.infer<
  typeof commercialWithdrawalOwnerEnvelope
>["command"];
export type CommercialWithdrawalStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PAYMENT_IN_PROGRESS"
  | "EXCEPTION"
  | "SENT"
  | "RECONCILED"
  | "REJECTED"
  | "CANCELLED"
  | "RELEASED"
  | "RETURNED";

export class CommercialWithdrawalRejected extends Error {}

export function withdrawalCreditQuantum(policy: CommercialWithdrawalPolicy) {
  let a = BigInt(policy.rate.credits),
    b = BigInt(policy.rate.audCents);
  while (b) [a, b] = [b, a % b];
  return Number(BigInt(policy.rate.credits) / a);
}

export function withdrawalAudCents(
  credits: number,
  policy: CommercialWithdrawalPolicy,
) {
  nonnegative.parse(credits);
  const numerator = BigInt(credits) * BigInt(policy.rate.audCents);
  const denominator = BigInt(policy.rate.credits);
  if (numerator % denominator !== 0n)
    throw new CommercialWithdrawalRejected(
      "Amount does not convert to whole Australian cents.",
    );
  const cents = numerator / denominator;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CommercialWithdrawalRejected(
      "Withdrawal amount exceeds the accounting limit.",
    );
  return Number(cents);
}

export function assertWithdrawalPolicy(
  value: unknown,
  environment: BillingEnvironment,
  now = Date.now(),
): CommercialWithdrawalPolicy {
  const policy = commercialWithdrawalPolicySchema.parse(value);
  if (policy.environment !== environment)
    throw new CommercialWithdrawalRejected("Withdrawal environment mismatch.");
  if (Date.parse(policy.approvals.validUntil) <= now)
    throw new CommercialWithdrawalRejected("Withdrawal approval has expired.");
  assertWithdrawalAmount(policy.minimumCredits, policy);
  withdrawalAudCents(policy.maximumCredits, policy);
  return policy;
}

export function assertCashCommercialPolicy(
  control: {
    environment: BillingEnvironment;
    policy_version: string;
    approvals: Record<string, unknown>;
  },
  environment: BillingEnvironment,
) {
  assertCommercialApproval(control, environment);
  if (
    control.policy_version !== commercialCashPolicyVersion ||
    control.approvals.withdrawals !== true ||
    control.approvals.prizes !== false ||
    control.approvals.paidEntry !== false ||
    control.approvals.nba !== false
  )
    throw new CommercialWithdrawalRejected(
      "Cash-capable commercial release approval is pending.",
    );
}

export function assertWithdrawalAmount(
  credits: number,
  policy: CommercialWithdrawalPolicy,
) {
  positive.parse(credits);
  if (credits < policy.minimumCredits || credits > policy.maximumCredits)
    throw new CommercialWithdrawalRejected(
      "Amount is outside the published withdrawal limits.",
    );
  const gross = withdrawalAudCents(credits, policy);
  if (gross <= policy.feeCents)
    throw new CommercialWithdrawalRejected(
      "Amount must exceed the published withdrawal fee.",
    );
  return gross;
}

export function isReservedWithdrawal(status: string) {
  return [
    "REQUESTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PAYMENT_IN_PROGRESS",
    "EXCEPTION",
  ].includes(status);
}

export function withdrawalUsesBacking(status: string) {
  return (
    isReservedWithdrawal(status) || ["SENT", "RECONCILED"].includes(status)
  );
}
