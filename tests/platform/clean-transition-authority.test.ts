import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  validatePriorCommunication,
  validateRetirementApproval,
  retirementScope,
} from "../../scripts/clean-transition-authority";
const sha = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
const manifest = [
  { id: "founder0-test", kind: "owner", originalRole: "owner" },
  { id: "owner002-test", kind: "owner", originalRole: "admin" },
  ...[1, 2, 3].map((n) => ({
    id: `member0${n}-test`,
    kind: "customer",
    originalRole: "none",
  })),
  { id: "system00-test", kind: "system", originalRole: "none" },
];
const evidence = {
  ...JSON.parse(
    readFileSync(
      "docs/qa/clean-retirement-attestation-20261117/FOUNDER_ATTESTATION.json",
      "utf8",
    ),
  ),
  attestorAccountReference: "founder0",
  accountManifestSha256: sha(JSON.stringify(manifest)),
  customerReferences: ["member01", "member02", "member03"],
};
function fixture(overrides = {}) {
  const bytes = Buffer.from(JSON.stringify({ ...evidence, ...overrides }));
  const pkg = {
    schemaVersion: 2,
    source: "a".repeat(40),
    accountManifestSha256: sha(JSON.stringify(manifest)),
    communicationRequirement: "founder-attested-prior-direct-communication",
    communicationEvidence: { path: "fixture", sha256: sha(bytes) },
  };
  return { bytes, pkg };
}
test("honest attestation is accepted without a notice email or invented communication date", () => {
  const { bytes, pkg } = fixture();
  const detail = validatePriorCommunication(pkg, manifest, bytes);
  assert.equal(detail.evidenceType, "founder-attestation");
  assert.equal(detail.newNotificationEmailsSent, 0);
  assert.equal(detail.communicationOccurredAt, null);
});
test("old package and changed attestation bytes fail closed", () => {
  const { bytes, pkg } = fixture();
  assert.throws(
    () =>
      validatePriorCommunication({ ...pkg, schemaVersion: 1 }, manifest, bytes),
    /Superseded/,
  );
  assert.throws(
    () =>
      validatePriorCommunication(
        pkg,
        manifest,
        Buffer.concat([bytes, Buffer.from(" ")]),
      ),
    /bytes changed/,
  );
});
for (const [name, change] of Object.entries({
  "communication date": { communicationOccurredAt: "2026-11-16" },
  "notice delay": { retirementNotBefore: "2026-11-19" },
  "invented receipt": { deliveryReceipts: ["invented"] },
  "email authority": { newNotificationEmailsAuthorised: true },
  "email delivery": { newNotificationEmailsSent: 1 },
  "customer consent": { customerCommercialConsentRecorded: true },
  "implicit execution": { grantsExecutionAuthority: true },
  "wrong founder": { attestorAccountReference: "owner002" },
  "missing customer": { customerReferences: ["member01", "member02"] },
  "different cohort": { accountManifestSha256: "b".repeat(64) },
}))
  test(`${name} cannot satisfy the communication guard`, () => {
    const { bytes, pkg } = fixture(change);
    assert.throws(() => validatePriorCommunication(pkg, manifest, bytes));
  });
const now = Date.parse("2026-11-17T05:00:00Z");
function approvalFixture() {
  const { pkg } = fixture();
  const hash = "c".repeat(64);
  return {
    pkg,
    hash,
    approval: {
      packageSha256: hash,
      source: pkg.source,
      approvedAt: "2026-11-17T04:59:00Z",
      expiresAt: "2026-11-18T04:59:00Z",
      scope: retirementScope,
      communicationEvidenceSha256: pkg.communicationEvidence.sha256,
    },
  };
}
test("attestation alone is not retirement approval; exact separate approval is required", () => {
  const { pkg, hash, approval } = approvalFixture();
  validateRetirementApproval(approval, pkg, hash, now);
  assert.throws(
    () => validateRetirementApproval(undefined!, pkg, hash, now),
    /Separate/,
  );
  assert.throws(() =>
    validateRetirementApproval(
      { ...approval, packageSha256: "d".repeat(64) },
      pkg,
      hash,
      now,
    ),
  );
  assert.throws(() =>
    validateRetirementApproval(
      { ...approval, source: "b".repeat(40) },
      pkg,
      hash,
      now,
    ),
  );
  assert.throws(() =>
    validateRetirementApproval(
      { ...approval, communicationEvidenceSha256: "b".repeat(64) },
      pkg,
      hash,
      now,
    ),
  );
});
test("noticeDelivered true or false is rejected rather than treated as attestation", () => {
  const { pkg, hash, approval } = approvalFixture();
  for (const value of [true, false])
    assert.throws(
      () =>
        validateRetirementApproval(
          { ...approval, ...{ noticeDelivered: value } },
          pkg,
          hash,
          now,
        ),
      /Legacy/,
    );
});
test("expired, future and overlong approvals cannot cross the Auth boundary", () => {
  const { pkg, hash, approval } = approvalFixture();
  for (const time of [
    Date.parse(approval.expiresAt),
    Date.parse(approval.approvedAt) - 1,
  ])
    assert.throws(
      () => validateRetirementApproval(approval, pkg, hash, time),
      /expired or invalid/,
    );
  assert.throws(
    () =>
      validateRetirementApproval(
        { ...approval, expiresAt: "2026-11-19T04:59:00Z" },
        pkg,
        hash,
        now,
      ),
    /expired or invalid/,
  );
});
