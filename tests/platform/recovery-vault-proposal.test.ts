import test from "node:test";
import assert from "node:assert/strict";
import policy from "../../config/operations/recovery-vault.proposed.json";
test("vault proposal remains founder-scoped, unprovisioned and non-destructive", () => {
  assert.equal(policy.status, "PROPOSED_NOT_APPLIED");
  assert.equal(policy.existingProject, "docked-play-verification");
  assert.deepEqual(policy.runtimeReaders, []);
  assert(
    policy.dataAccessAuditLogsRequired &&
      policy.founderMfaVerifiedRequired &&
      policy.broadInheritedReadersMustBeReviewed,
  );
  assert(
    !policy.automaticRotation &&
      !policy.automaticDestruction &&
      !policy.newPaidServicesAuthorised,
  );
  assert(!JSON.stringify(policy).includes("allUsers"));
  assert(!policy.founderSecretRoles.includes("roles/owner"));
  assert.deepEqual(policy.founderSecretRoles, [
    "roles/secretmanager.secretAccessor",
  ]);
  assert.equal(policy.standingVersionDestructionPermission, false);
  assert.equal(policy.liveKeyImportRequiresSeparateApproval, true);
  assert.equal(
    policy.temporaryApprovedImportRole,
    "roles/secretmanager.secretVersionAdder",
  );
  assert.equal(policy.proposedVersionDestroyDelaySeconds, 30 * 24 * 60 * 60);
  assert.equal(policy.secretExpiry, null);
});
