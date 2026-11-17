/** Offline authority checks. An attestation is evidence, never execution approval. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type postgres from "postgres";
export const communicationAction = "FOUNDER_PRIOR_COMMUNICATION_ATTESTED";
export const retirementScope =
  "contain-and-soft-retire-three-beta-customers-retain-two-owners";
const sha = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
export type CohortAccount = { id: string; kind: string; originalRole: string };
export type CommunicationPackage = {
  schemaVersion: number;
  source: string;
  accountManifestSha256: string;
  communicationRequirement: string;
  communicationEvidence: { path: string; sha256: string };
};
export type RetirementApproval = {
  packageSha256: string;
  source: string;
  approvedAt: string;
  expiresAt: string;
  scope: string;
  communicationEvidenceSha256: string;
};
export function validatePriorCommunication(
  pkg: CommunicationPackage,
  manifest: CohortAccount[],
  evidenceBytes: Buffer,
) {
  assert.equal(
    pkg.schemaVersion,
    2,
    "Superseded notice-delivery package rejected",
  );
  assert.equal(
    pkg.communicationRequirement,
    "founder-attested-prior-direct-communication",
  );
  assert.equal(sha(JSON.stringify(manifest)), pkg.accountManifestSha256);
  assert.equal(
    sha(evidenceBytes),
    pkg.communicationEvidence.sha256,
    "Attestation bytes changed",
  );
  const evidence = JSON.parse(evidenceBytes.toString("utf8"));
  const founder = manifest.filter(
    (a) => a.kind === "owner" && a.originalRole === "owner",
  );
  assert.equal(founder.length, 1);
  assert.equal(evidence.evidenceType, "founder-attestation");
  assert.equal(
    evidence.subject,
    "prior-direct-communication-of-beta-retirement",
  );
  assert.equal(evidence.attestorAccountReference, founder[0].id.slice(0, 8));
  assert.equal(evidence.accountManifestSha256, pkg.accountManifestSha256);
  assert.deepEqual(
    evidence.customerReferences,
    manifest
      .filter((a) => a.kind === "customer")
      .map((a) => a.id.slice(0, 8))
      .sort(),
  );
  assert.equal(evidence.customerReferences.length, 3);
  assert.equal(
    evidence.communicationOccurredAt,
    null,
    "Do not invent communication dates",
  );
  assert.equal(
    evidence.retirementNotBefore,
    null,
    "No scheduled notice delay is authorised",
  );
  assert.equal(evidence.newNotificationEmailsAuthorised, false);
  assert.equal(evidence.newNotificationEmailsSent, 0);
  assert.deepEqual(evidence.deliveryReceipts, []);
  assert.equal(evidence.customerCommercialConsentRecorded, false);
  assert.equal(evidence.grantsExecutionAuthority, false);
  assert.equal(typeof evidence.statement, "string");
  assert(evidence.statement.length > 50);
  return {
    evidenceType: "founder-attestation",
    subject: evidence.subject as string,
    evidenceSha256: pkg.communicationEvidence.sha256,
    accountManifestSha256: pkg.accountManifestSha256,
    attestorAccountReference: founder[0].id.slice(0, 8),
    communicationOccurredAt: null,
    newNotificationEmailsSent: 0,
    customerCommercialConsentRecorded: false,
    recordedBy: "reviewed-release-operator",
  };
}
export function validateRetirementApproval(
  approval: RetirementApproval,
  pkg: CommunicationPackage,
  packageSha256: string,
  now = Date.now(),
) {
  assert(
    approval && typeof approval === "object",
    "Separate exact execution approval required",
  );
  assert(
    !Object.hasOwn(approval, "noticeDelivered"),
    "Legacy noticeDelivered flag is not evidence",
  );
  assert.equal(approval.packageSha256, packageSha256);
  assert.equal(approval.source, pkg.source);
  assert.equal(approval.scope, retirementScope);
  assert.equal(
    approval.communicationEvidenceSha256,
    pkg.communicationEvidence.sha256,
  );
  const start = Date.parse(approval.approvedAt),
    end = Date.parse(approval.expiresAt);
  assert(
    Number.isFinite(start) &&
      end > start &&
      end - start <= 86400000 &&
      now >= start &&
      now < end,
    "Exact approval expired or invalid",
  );
}

/** Caller supplies one transaction. prepare() holds the existing financial lock. */
export async function containWithCommunication(
  tx: postgres.TransactionSql,
  manifest: CohortAccount[],
  expectedSource: string,
  packageSha256: string,
  noticeSha256: string,
  communication: ReturnType<typeof validatePriorCommunication>,
) {
  const [row] =
    await tx`select launch_transition.prepare(${tx.json(manifest)},${expectedSource},${packageSha256},${noticeSha256}) batch`;
  const events =
    await tx`select detail from launch_transition.events where batch=${row.batch} and action=${communicationAction}`;
  if (events.length) {
    assert.equal(events.length, 1);
    assert.deepEqual(
      events[0].detail,
      communication,
      "Communication checkpoint drift",
    );
  } else {
    await tx`insert into launch_transition.events(batch,action,detail) values(${row.batch},${communicationAction},${tx.json(communication)})`;
  }
  return row.batch as string;
}
