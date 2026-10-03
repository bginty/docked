// Static server query, also exercised against disposable PostgreSQL in tests.
// The only parameter is an exact recipient address; token hashes are never selected.
export const previewAuthReadinessQuery = `select clock_timestamp() "databaseNow",c.enabled,c.project_ref "projectRef",c.site_url "siteUrl",c.configured_at "configuredAt",c.expires_at "configurationExpiresAt",
      c.hook_verified_at "hookVerifiedAt",c.hook_verified_event_id "hookVerifiedEventId",c.hook_function_sha256 "hookFunctionSha256",
      encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex') "actualFunctionSha256",
      a.email "recipientEmail",a.approved_at "recipientApprovedAt",a.expires_at "recipientExpiresAt",a.revoked_at "recipientRevokedAt",
      p.id "proofId",p.email "proofEmail",p.action "proofAction",p.redirect_to "proofRedirect",p.received_at "proofReceivedAt",p.expires_at "proofExpiresAt",
      pa.approved_at "proofRecipientApprovedAt",pa.expires_at "proofRecipientExpiresAt",pa.revoked_at "proofRecipientRevokedAt",
      exists(select 1 from preview_auth.allowed_redirects where url='http://localhost:3000/auth/callback') "signupRedirectAllowed",
      exists(select 1 from preview_auth.allowed_redirects where url='http://localhost:3000/auth/callback?next=/reset-password') "recoveryRedirectAllowed"
      from preview_auth.configuration c join preview_auth.allowed_recipients a on a.email=$1
      join preview_auth.captured_mail p on p.id=c.hook_verified_event_id join preview_auth.allowed_recipients pa on pa.email=p.email where c.singleton`;
