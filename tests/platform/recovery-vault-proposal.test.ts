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
});
