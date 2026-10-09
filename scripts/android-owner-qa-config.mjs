// Owner QA is a protected Preview attachment, never a live beta release receipt.
export function validateOwnerQaManifest(input, now = Date.now()) {
  const fail = () => {
    throw Error("Current exact protected owner-QA receipt required");
  };
  if (
    !input ||
    input.schemaVersion !== 1 ||
    input.kind !== "docked-android-owner-qa" ||
    input.environment !== "protected-preview" ||
    input.applicationId !== "au.com.docked.app.preview" ||
    input.supabaseProjectRef !== "pojoymtniryarxxunyvz" ||
    input.projectId !== "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST" ||
    input.teamId !== "team_tf6xweKKyVCj9bTppUKttJ4l" ||
    !/^https:\/\/docked-production-[a-z0-9]+-briant-s-projects\.vercel\.app$/.test(
      input.origin ?? "",
    ) ||
    !/^dpl_[A-Za-z0-9]+$/.test(input.deploymentId ?? "") ||
    !/^[a-f0-9]{40}$/.test(input.commit ?? "")
  )
    fail();
  const at = Date.parse(input.verifiedAt);
  if (
    !Number.isFinite(at) ||
    !Number.isFinite(now) ||
    at > now + 60000 ||
    now - at > 86400000
  )
    fail();
  if (
    input.ownerOnly !== true ||
    input.protected !== true ||
    input.externalAdmission !== false ||
    input.registration !== false ||
    input.payments !== false ||
    input.physicalAcceptance !== "PENDING"
  )
    fail();
  return Object.freeze({
    schemaVersion: 1,
    kind: input.kind,
    environment: input.environment,
    applicationId: input.applicationId,
    supabaseProjectRef: input.supabaseProjectRef,
    projectId: input.projectId,
    teamId: input.teamId,
    origin: input.origin,
    deploymentId: input.deploymentId,
    commit: input.commit,
    verifiedAt: input.verifiedAt,
    ownerOnly: true,
    protected: true,
    externalAdmission: false,
    registration: false,
    payments: false,
    physicalAcceptance: "PENDING",
  });
}
