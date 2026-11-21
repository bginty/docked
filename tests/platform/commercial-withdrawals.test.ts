import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assertCashCommercialPolicy,
  assertWithdrawalAmount,
  assertWithdrawalPolicy,
  commercialCashPolicyVersion,
  commercialWithdrawalIdentitySchema,
  commercialWithdrawalMemberEnvelope,
  commercialWithdrawalOwnerEnvelope,
  withdrawalAudCents,
  withdrawalCreditQuantum,
  type CommercialWithdrawalPolicy,
} from "../../src/core/commercial-withdrawals";
import { commercialPolicyVersion } from "../../src/core/commercial-billing";

export const withdrawalTestPolicy: CommercialWithdrawalPolicy = {
  version: "ISOLATED-withdrawal-fixture-v1",
  environment: "acceptance",
  currency: "AUD",
  eligibleSource: "settled-sale-proceeds-only",
  rate: { credits: 1, audCents: 1 },
  minimumCredits: 100,
  maximumCredits: 2000,
  dailyMaximumCredits: 10000,
  feeCents: 0,
  identityMaxAgeMs: 3600000,
  approvals: {
    owner: "ISOLATED OWNER FIXTURE",
    legalAssessment: "ISOLATED LEGAL FIXTURE",
    playAssessment: "ISOLATED OWNER ADVICE FIXTURE",
    payoutBank: "ISOLATED BANK FIXTURE",
    privacy: "ISOLATED PRIVACY FIXTURE",
    refundRecovery: "ISOLATED REFUND FIXTURE",
    validUntil: "2099-01-01T00:00:00Z",
  },
};

test("Cash policy is separately bound and cannot reinterpret the closed-loop approval", () => {
  const approvals = {
    ...Object.fromEntries(
      [
        "owner",
        "legal",
        "googlePlay",
        "privacy",
        "retention",
        "refundRecovery",
        "playerRights",
        "supplyReconciliation",
      ].map((key) => [key, "ISOLATED EXISTING POLICY"]),
    ),
    validUntil: "2099-01-01T00:00:00Z",
    prizes: false,
    paidEntry: false,
    nba: false,
    withdrawals: false,
  };
  assert.throws(
    () =>
      assertCashCommercialPolicy(
        {
          environment: "acceptance",
          policy_version: commercialPolicyVersion,
          approvals,
        },
        "acceptance",
      ),
    /Cash-capable/,
  );
  const cash = {
    environment: "acceptance" as const,
    policy_version: commercialCashPolicyVersion,
    approvals: {
      ...approvals,
      withdrawals: true,
      withdrawalPolicyVersion: withdrawalTestPolicy.version,
      ownerDecision: "ISOLATED OWNER DECISION",
      legalAssessment: "ISOLATED ADVICE BASIS",
      playAssessment: "ISOLATED ADVICE BASIS",
      withdrawalAssessmentBasis: "owner-reviewed-advice",
    },
  };
  assert.doesNotThrow(() => assertCashCommercialPolicy(cash, "acceptance"));
  assert.throws(
    () => assertCashCommercialPolicy(cash, "commercial"),
    /mismatch/,
  );
  assert.throws(
    () =>
      assertCashCommercialPolicy(
        {
          ...cash,
          approvals: {
            ...cash.approvals,
            withdrawalAssessmentBasis: "guaranteed-no-review-needed",
          },
        },
        "acceptance",
      ),
    /assessment basis/,
  );
});

test("Withdrawal terms require explicit source/rate/limits/fees and current scoped evidence", () => {
  assert.equal(
    assertWithdrawalPolicy(withdrawalTestPolicy, "acceptance").feeCents,
    0,
  );
  assert.throws(() => assertWithdrawalPolicy({}, "acceptance"));
  assert.throws(() =>
    assertWithdrawalPolicy(
      { ...withdrawalTestPolicy, eligibleSource: "purchased-credits" },
      "acceptance",
    ),
  );
  assert.throws(
    () =>
      assertWithdrawalPolicy(
        { ...withdrawalTestPolicy, minimumCredits: 2001 },
        "acceptance",
      ),
    /limits/,
  );
  assert.throws(
    () =>
      assertWithdrawalPolicy(
        {
          ...withdrawalTestPolicy,
          approvals: {
            ...withdrawalTestPolicy.approvals,
            validUntil: "2020-01-01T00:00:00Z",
          },
        },
        "acceptance",
      ),
    /expired/,
  );
  assert.throws(
    () => assertWithdrawalPolicy(withdrawalTestPolicy, "commercial"),
    /environment/,
  );
});

test("Conversion preserves whole cents and rejects hidden rounding or integer overflow", () => {
  const fractional = {
    ...withdrawalTestPolicy,
    rate: { credits: 3, audCents: 2 },
  };
  assert.equal(withdrawalCreditQuantum(fractional), 3);
  assert.equal(withdrawalAudCents(6, fractional), 4);
  assert.throws(
    () => withdrawalAudCents(1, fractional),
    /whole Australian cents/,
  );
  assert.throws(
    () =>
      withdrawalAudCents(Number.MAX_SAFE_INTEGER, {
        ...withdrawalTestPolicy,
        rate: { credits: 1, audCents: 2 },
      }),
    /accounting limit/,
  );
  assert.throws(
    () => assertWithdrawalAmount(99, withdrawalTestPolicy),
    /limits/,
  );
  assert.throws(
    () => assertWithdrawalAmount(2001, withdrawalTestPolicy),
    /limits/,
  );
  assert.throws(
    () =>
      assertWithdrawalAmount(100, { ...withdrawalTestPolicy, feeCents: 100 }),
    /exceed/,
  );
});

test("Client commands cannot smuggle a bank payload, KYC approval, cash eligibility or a payment amount", () => {
  const request = randomUUID(),
    command = {
      kind: "request",
      credits: 700,
      destination: randomUUID(),
      identityRevision: 1,
      policyVersion: withdrawalTestPolicy.version,
    };
  assert.doesNotThrow(() =>
    commercialWithdrawalMemberEnvelope.parse({ request, command }),
  );
  for (const extra of [
    { verified: true },
    { purchasedCredits: true },
    { bankAccount: "123456789" },
    { audCents: 99999 },
  ])
    assert.throws(() =>
      commercialWithdrawalMemberEnvelope.parse({
        request,
        command: { ...command, ...extra },
      }),
    );
  assert.throws(() =>
    commercialWithdrawalMemberEnvelope.parse({
      request,
      command: { kind: "claim", id: randomUUID(), expectedRevision: 1 },
    }),
  );
  assert.throws(() =>
    commercialWithdrawalOwnerEnvelope.parse({
      request,
      command: {
        kind: "record-sent",
        id: randomUUID(),
        expectedRevision: 1,
        bankReference: "BANK-REFERENCE",
        evidenceReference: "BANK-EVIDENCE",
        confirmed: false,
      },
    }),
  );
});

test("Provider identity approval needs a real review, adult AU result and keyed name evidence", () => {
  const identity = {
    provider: "sumsub",
    providerEnvironment: "acceptance",
    providerApplicantId: "synthetic-applicant",
    providerReviewId: null,
    providerReviewedAt: null,
    checkedAt: new Date().toISOString(),
    status: "pending",
    country: null,
    adult: false,
    evidenceReference: "ISOLATED RESULT",
    legalNameHash: null,
  };
  assert.doesNotThrow(() => commercialWithdrawalIdentitySchema.parse(identity));
  assert.throws(() =>
    commercialWithdrawalIdentitySchema.parse({
      ...identity,
      status: "approved",
    }),
  );
  assert.doesNotThrow(() =>
    commercialWithdrawalIdentitySchema.parse({
      ...identity,
      status: "approved",
      providerReviewId: "synthetic-review",
      providerReviewedAt: new Date().toISOString(),
      country: "AU",
      adult: true,
      legalNameHash: "a".repeat(64),
    }),
  );
  assert.throws(() =>
    commercialWithdrawalIdentitySchema.parse({
      ...identity,
      rawDocument: "must never cross this boundary",
    }),
  );
});
