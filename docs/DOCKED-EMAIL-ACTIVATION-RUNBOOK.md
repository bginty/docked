> Current owner-approval checkpoint: rc2 approval is recorded against the unchanged document hashes. A reviewed sparse CLI update resolved Auth configuration access; email sign-in and the signed hook are configured, but sender/worker/invitation switches remain false. No account, MFA factor or email was created. The managed scheduler permission gate failed and the newly added network extension was rolled back. [Current owner acceptance status](DOCKED-OWNER-ACCEPTANCE-STATUS.md) supersedes historical pending configuration steps below. Do not enroll MFA until the invitation flow is ready.
> 9 October expedited policy checkpoint: function version6 now includes the prepared exact Vercel beta-origin support and is deployed with all sending switches still closed. The active staging/owner sequence is [owner acceptance preparation](DOCKED-BETA-OWNER-ACCEPTANCE-PREP.md); older Netlify prerequisites below are historical. No policy approval, owner MFA or positive Auth delivery is inferred.

# Docked email acceptance and activation runbook

> Current authority: the owner's subsequent controlled live-beta deployment request authorizes the support-only hosted Auth test window. Item 1 below is satisfied by that instruction; do not ask again. Protected staging/policy prerequisites and actual acceptance remain required. See [live-beta acceptance](DOCKED-LIVE-BETA-ACCEPTANCE.md).

Continuation from `ec299fe7`. All activation switches remain closed. This document specifies the controlled test and rollback; it is not evidence that hosted Auth acceptance or activation has happened.

9 October readback: both email migrations are applied to `pojoymtniryarxxunyvz`; function version 5 matches all four local source files and remains disabled. `pgcrypto` and Vault are installed; `pg_cron` and `pg_net` are available but not installed. No Vault signing entry or cron job was created by this work. The website invitation/profile changes have passed local checks but are not hosted. See [acceptance continuation](DOCKED-EMAIL-ACCEPTANCE-CONTINUATION.md).

## Prepared implementation

The certificate-based Microsoft Graph outbox retains its reviewed dispatch fence. Invitations now have a separate browser confirmation page: GET/HEAD do not consume tokens; a same-origin form POST verifies an `invite` token and creates the Auth cookie session. The mail adapter requires the callback origin to match Auth `site_url`, and the application requires its configured origin. Both must be the exact staging origin during acceptance. Existing signup/recovery PKCE and secure-email-change behavior are unchanged.

After choosing a password, invited users without profiles are directed to explicit profile/Terms/Privacy/age setup. The server verifies the exact Auth access token, authoritative invitation status and existing active-session view. It records policy consent transactionally, preserves existing profiles on replay, and cannot mint cards or assign administrator roles. No new managed Auth-table grants are required. Public signup can remain disabled throughout invitation acceptance.

The production-only scheduler migration is disabled by default. It installs no extension, copies no secret and registers no cron job. Its private invoker functions are denied to anonymous, authenticated, service-role and application-runtime callers. The approved database administrator can run `private.docked_mail_tick()` and `private.docked_mail_health()`.

The scheduler cleans expired envelopes in both modes, even with sending disabled. It preserves receipts/events and never requeues ambiguous sends. When separately enabled, it signs the exact JSON body with the existing hook secret held in Vault, posts only to the fixed Docked Production worker, and limits concurrent ticks to one scheduling request per 45 seconds. The worker drains four independently leased jobs concurrently. A serialized admission wrapper limits outstanding unexpired jobs to 32; an existing idempotency receipt is still replayable at capacity. Healthy one-minute scheduling drains a full queue in eight ticks, below the 15-minute envelope lifetime. This is not a delivery SLA: outages still require monitoring and recovery.

## Prerequisites still requiring verification

1. Owner approval for the support@docked.com.au-only hosted Auth test window. Do not infer approval for friends or the public, and do not enable unrestricted sending.
2. Protected Netlify staging deployed on the existing Free site, with approved operator/policy configuration. Keep the public holding page and DNS unchanged.
3. Application `SITE_URL` and Supabase Auth `site_url` both equal `https://docked-production.netlify.app` for the window. Restrict Auth redirects to reviewed exact paths. Never add wildcards or Preview origins.
4. Verified existing production `pg_cron`, `pg_net`, `pgcrypto` and Vault availability/permissions. Do not upgrade a plan or buy anything. Verify the deployed pg_net implementation serializes `body::text` and that its request/response tables are not exposed to runtime roles. Avoid credential-bearing command text in cron history.
5. Securely copy the existing hook secret, unchanged, to a single Vault entry named `docked_auth_email_hook_existing`. Do not generate/rotate a secret, store it in a script, print it, or place it in a cron command. This is a separately reviewed security-sensitive activation step.

## Controlled acceptance sequence

- Snapshot only the dedicated project's relevant Auth settings and flag values privately. Verify no non-test queued production mail exists. Preserve the accepted diagnostic receipt; do not resend it.
- Deploy and verify the latest hook source while all mail switches remain false. Apply only reviewed production-email migrations; verify private ACL/RLS and public RPC permissions.
- Verify disabled invitation pages/POSTs and unsigned requests fail closed. Verify `DOCKED_AUTH_INVITES_READY` (website) and `DOCKED_GRAPH_INVITES_READY` (hook) are false/unset before the window.
- Start the signed worker schedule only after confirming its fixed endpoint, secret and signature. Recommended one-minute command is `select private.docked_mail_tick();`; do not embed the key in the job text. Verify a real scheduled request, cleanup and health output before setting `DOCKED_GRAPH_WORKER_READY=true`. A manual drain alone does not prove the scheduler works.
- Connect the signed Send Email hook only within the authorized window. Set `DOCKED_GRAPH_RECIPIENT_MODE=support-test`; both enqueue and actual dispatch then reject every recipient except support. An absent/unknown mode blocks all production mail. Later `approved-beta` requires an explicit exact mailbox list in `DOCKED_GRAPH_BETA_RECIPIENTS` (at most 20 addresses); do not populate it without approved invitees. No wildcard mode exists. The invitation-ready flag does not override recipient restrictions.
- Send one invitation to support, verify Inbox receipt and the actual link on mobile/desktop, establish cookies, set a password, explicitly accept current policies and finish the profile. Confirm no inventory or roles are granted merely by confirmation. Test same-link concurrent POST/replay without logging token values.
- Test real recovery, password change and login/logout with the same controlled identity. Verify genuinely expired and reused links, not just invented tokens. Public registration confirmation requires a separately controlled creation path; do not open global signup merely to test it.
- Inject pre-enqueue denial and post-enqueue provider failure, confirm actual account/session/profile state, and demonstrate safe recovery without duplicate messages or compensating identity deletion. Capacity rejection must not be reported as mail delivery. Ambiguous sends must remain held.
- Record sanitized evidence: receipt IDs, state counts, HTTP status/timings, cookie/session checks and owner-confirmed Inbox receipt. Never record Auth links, passwords, access tokens or mailbox bodies.

## Monitoring and rollback

`private.docked_mail_health()` returns only scheduler timestamps, pending age, terminal state counts and a generic scheduler error. A tick older than three minutes, scheduler error, increasing unknown/failed/expired counts, or pending mail older than five minutes requires investigation. An administrator/operations owner must be assigned to this check before beta. No paid monitoring product or additional notification recipient is configured.

On any failure: disconnect/disable the Auth hook as appropriate to the captured original settings; set `DOCKED_GRAPH_MAIL_ENABLED`, `DOCKED_GRAPH_WORKER_READY`, `DOCKED_GRAPH_TEST_ENABLED` and `DOCKED_GRAPH_INVITES_READY` false; set the website invitation flag false; disable the scheduler's sending flag and its cron job. Preserve receipts. Run a cleanup-only tick if safe. Do not reset unknown jobs to pending or replay the original Graph request. Keep signup closed, holding page and DNS unchanged.

Before beta approval, prove real hosted invitation/confirmation/recovery, email failure reconciliation, scheduler behavior, all essential gameplay/ownership tests, policy/territory operations approval and administrator MFA. The other-real-mailbox negative Exchange test remains uncompleted; the existing support-only permission configuration must not be broadened.

References checked for implementation: [Supabase email hook contract](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [email templates and confirmation tokens](https://supabase.com/docs/guides/auth/auth-email-templates), [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net serialization source](https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql).
