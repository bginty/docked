import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import {
  assertCommercialApproval,
  commercialCashPolicyVersion,
  commercialPolicyVersion,
} from "../../src/core/commercial-billing";
import {
  CommercialWithdrawalVault,
  withdrawalDestinationMask,
} from "../../src/server/commercial-withdrawal-vault";

const approvals = {
  owner: "fixture-owner-decision",
  legal: "fixture-existing-legal",
  googlePlay: "fixture-existing-billing",
  privacy: "fixture-privacy",
  retention: "fixture-retention",
  refundRecovery: "fixture-recovery",
  playerRights: "fixture-rights",
  supplyReconciliation: "fixture-supply",
  validUntil: "2099-01-01T00:00:00Z",
  withdrawals: false,
  prizes: false,
  paidEntry: false,
  nba: false,
};
test("cash scope requires an explicit version and truthful scoped decision record", () => {
  const control = {
    environment: "commercial" as const,
    policy_version: commercialPolicyVersion,
    approvals,
  };
  assert.doesNotThrow(() => assertCommercialApproval(control, "commercial"));
  assert.throws(() =>
    assertCommercialApproval(
      {
        ...control,
        approvals: { ...approvals, withdrawals: true },
      },
      "commercial",
    ),
  );
  const cash = {
    ...control,
    policy_version: commercialCashPolicyVersion,
    approvals: {
      ...approvals,
      withdrawals: true,
      withdrawalPolicyVersion: "fixture-cash-schedule-v1",
      ownerDecision: "fixture-scoped-owner-decision",
      legalAssessment: "fixture-reported-advice-assessment",
      playAssessment: "fixture-comparison-and-policy-review",
      withdrawalAssessmentBasis: "owner-reviewed-advice",
    },
  };
  assert.doesNotThrow(() => assertCommercialApproval(cash, "commercial"));
  assert.throws(() => assertCommercialApproval(cash, "acceptance"));
  for (const key of [
    "withdrawalPolicyVersion",
    "ownerDecision",
    "playAssessment",
    "legalAssessment",
    "withdrawalAssessmentBasis",
  ]) {
    assert.throws(() =>
      assertCommercialApproval(
        {
          ...cash,
          approvals: { ...cash.approvals, [key]: "" },
        },
        "commercial",
      ),
    );
  }
  assert.throws(() =>
    assertCommercialApproval(
      {
        ...cash,
        approvals: { ...cash.approvals, prizes: true },
      },
      "commercial",
    ),
  );
});

test("bank ciphertext is bound to environment, member, destination and identity revision", () => {
  const key = randomBytes(32);
  const binding = {
    member: "11111111-1111-4111-8111-111111111111",
    destination: "22222222-2222-4222-8222-222222222222",
    identityRevision: 1,
  };
  const bank = {
    holder: "Synthetic Member",
    bsb: "000000",
    account: "123456789",
  };
  const vault = new CommercialWithdrawalVault("acceptance", {
    active: "k1",
    values: { k1: key },
  });
  const ciphertext = vault.seal(bank, binding);
  assert.deepEqual(vault.open(ciphertext, binding), bank);
  assert.equal(ciphertext.includes(bank.account), false);
  assert.equal(withdrawalDestinationMask(bank), "****6789");
  for (const changed of [
    { ...binding, member: binding.destination },
    { ...binding, destination: binding.member },
    { ...binding, identityRevision: 2 },
  ])
    assert.throws(() => vault.open(ciphertext, changed));
  assert.throws(() =>
    new CommercialWithdrawalVault("commercial", {
      active: "k1",
      values: { k1: key },
    }).open(ciphertext, binding),
  );
  const parts = ciphertext.split(".");
  parts[4] = (parts[4][0] === "A" ? "B" : "A") + parts[4].slice(1);
  assert.throws(() => vault.open(parts.join("."), binding));
  const rotated = new CommercialWithdrawalVault("acceptance", {
    active: "k2",
    values: { k1: key, k2: randomBytes(32) },
  });
  assert.deepEqual(rotated.open(ciphertext, binding), bank);
  assert.equal(rotated.seal(bank, binding).startsWith("v1.k2."), true);
});
