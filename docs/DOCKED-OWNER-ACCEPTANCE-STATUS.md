# Owner acceptance — invitation accepted; waiting for personal confirmation

**Subsequent readback:** The sole designated owner account became email-confirmed at10:59:20UTC, with a sign-in recorded at the same time. No verified MFA factor exists. The agent did not follow the invitation or confirm the account. Ask the owner to confirm Inbox receipt and their browser step before attributing the confirmation to personal acceptance. Delivery and MFA are not yet claimed.

**Latest result, 9 October 2026, 21:58 Sydney:** After fresh explicit owner approval, one Auth invitation returned200 and created the sole unconfirmed support@docked.com.au account. One signed Graph submission returned202; its queue record is accepted with attempts1. Sending was disabled immediately afterward and read back OFF. No pending jobs, MFA factors or beta administrator roles exist; testers and public signup remain closed. Inbox delivery, account confirmation, password recovery, AAL2 and gameplay acceptance are still unverified. See `qa/owner-acceptance/quota-recovery-invitation.json`. Earlier rate-limit failures below are historical, not the current blocker.

**Owner quota confirmation:** 2 emails/hour; signups/sign-ins and verification each 30 requests/5 minutes/IP; IP forwarding disabled. No settings changed. See [next supervised window](DOCKED-OWNER-INVITATION-NEXT-WINDOW.md): earliest conservative recheck 21:30 Sydney on 9 October, followed by fresh read-only checks and explicit approval immediately before one invitation. Sending remains disabled; no automatic retry is scheduled. Future email scaling is a recommendation only.

**Current status, 9 October 2026:** See [Supervised owner authentication acceptance](DOCKED-SUPERVISED-OWNER-AUTH-2026-10-09.md). The operator dispatcher removes the need for pg_net for this supervised test. The protected owner-auth deployment is READY. The real provider payload compatibility defect was fixed and verified without sending. The subsequent invitation returned HTTP429 `over_email_send_rate_limit`. No owner account or production email was created. All dispatcher switches are OFF. No automatic retry is scheduled. Account confirmation, recovery, personal MFA and positive hosted gameplay remain blocked. Historical scheduler/deployment evidence below is retained and does not describe the latest deployment.


**9 October follow-up:** the read-only investigation and prepared alternative are in [Email dispatch decision](DOCKED-EMAIL-DISPATCH-DECISION.md). Keep the historical failure evidence below. A trusted operator can invoke the existing signed worker without pg_net during a separately approved supervised owner-only window; Supabase privilege intervention is not mandatory for that proposed path. Nothing has been activated. Unattended dispatch and hosted positive acceptance remain unverified.

The owner approved all seven exact `2026-10-09-beta-rc2` documents from `da3b48a2`, subject to the existing unresolved requirements. The separate approval receipt records every version and SHA-256. The original policy bytes are unchanged. External tester admission, public signup and public-domain promotion remain unauthorized.

## Completed

- Recorded the conditional approval in both beta configuration records and the approval matrix. No official production approval flag changed.
- Added an exact-text policy page for protected beta onboarding and linked all seven policies from the consent flow. Previously that flow linked older general Terms/Privacy pages.
- Resolved the Auth configuration-access blocker through the installed CLI's sparse configuration diff/push. Only the dedicated project `pojoymtniryarxxunyvz` was targeted. A private original configuration snapshot is retained for rollback.
- Changed the Site URL and added exact callback paths for the verified protected Preview. All other pulled settings matched afterward. The first comparison flagged only a blank-line serialization difference; normalized readback passed without repeating the write.
- Enabled the email sign-in provider while retaining global signup disabled, confirmation required, 12-character minimum passwords, 900-second access-token expiry and existing TOTP controls.
- Connected the existing signed Graph Auth hook, reusing its unchanged signing secret. Sender/worker/invitation switches remain false. No email was sent and no Auth account or MFA factor was created.
- Prepared included `pg_cron` and initially installed `pg_net` for the existing private scheduler. **Rolled back that new, unused `pg_net` installation after its permission check failed**, with an empty-queue/no-job guard and RESTRICT. No existing application object or record was removed. Both preparation and rollback are recorded as migrations. The empty `pg_cron` extension and secure Vault copy of the existing signing secret remain prepared; no cron job or active scheduler exists, and no secret was rotated.

## Failed permission gate: do not schedule sending yet

The managed `net.http_request_queue` was observed to grant PUBLIC read/write access during preparation. All of `anon`, `authenticated`, `docked_app` and `docked_beta_app` had queue access. Those roles could not read `vault.decrypted_secrets`. No request containing a signature was enqueued. The subsequent rollback removed this newly introduced capability.

A signed worker request would contain a short-lived, body-bound authorization header, not the certificate/private key or raw signing secret. Nevertheless, queue access would let an unprivileged SQL role observe, delete or tamper with scheduled requests. This is not acceptable evidence of least-privilege reliable Auth delivery. No browser Data API exposure of `net` is claimed; the observed problem is SQL-role access.

Automatic approval review rejected the first broad schema/function/table revocation proposal because of its potential effect on production roles. No mutation occurred from that rejected request. Readback then established zero cron jobs and zero queued requests. A narrower, approved attempt affecting only three outbound HTTP function grants had no effective result: those objects are owned by `supabase_admin`, while the available `postgres` connection has no grant option. Readback showed the original PUBLIC execution grants still present. Do not claim permission hardening passed, change to a privileged managed role, or repeatedly retry ineffective grants.

### Exact platform-owner action

Ask Supabase support/the authorized administrator for project `pojoymtniryarxxunyvz` to provide a supported least-privilege configuration before reinstalling `pg_net`:

1. Remove PUBLIC and explicit `anon`, `authenticated`, `docked_app` and `docked_beta_app` access to the HTTP request queue, response data and outbound HTTP entrypoints.
2. Preserve managed extension operation and explicitly authorized `postgres` scheduler execution; review `service_role` access separately rather than broadly revoking it.
3. Return the effective privilege readback for these exact objects/roles. The current `postgres` role cannot grant/revoke the relevant managed-object privileges; another SQL-editor retry under the same role is not sufficient.

No plan upgrade, paid service or new Microsoft grant is authorized. If the platform cannot support this configuration, review a supported isolated worker alternative before enabling delivery.

## Next acceptance steps after that gate passes

Verify the real scheduled signed worker and its fail-closed retry handling, pin the final exact Preview callback, and enable only support@docked.com.au delivery. Create/reserve the designated owner identity and send one controlled invitation. The owner must personally confirm Inbox receipt, follow the invitation, set a private password, accept the approved policies and enroll TOTP at `/mfa`. Do not share the password, seed or codes in chat. Verify `aal2` before granting administrator capabilities.

Then complete recovery, genuinely expired/reused links, session revocation, email failure recovery and positive persisted hosted gameplay. Keep external admission and public signup closed. Android beta release waits for mandatory hosted acceptance; no physical-device testing or playable account is claimed yet.

## Final protected deployment and tests

Application commit: `bbd302b85242a45a6c5d1b06287baa9a6067fe20`.
Deployment: `dpl_GUKPib2D7KdzVa2V19MXiTaDUA3w`, READY, verified Preview target (Vercel raw target null), no aliases or custom domains.
Protected URL: https://docked-production-2c4c80cpl-briant-s-projects.vercel.app
Approved packet: https://docked-production-2c4c80cpl-briant-s-projects.vercel.app/beta-policies

- PASS: 25 focused policy/authentication tests; TypeScript and changed-source lint.
- PASS: 42 actual hosted closed-access checks, including approved policy routes, isolated database availability, authorization denials and responsive pages.
- PASS: all seven rendered policy bodies exactly matched approved text at 320px and 1366px, with no horizontal overflow. Browser emulation, not native Android/iPhone testing.
- PASS: 535-file committed export scan and 17 served browser assets scanned for known credentials/private material.
- PASS: eight signed/unsigned/expired/disabled hosted email checks after final exact-origin configuration.
- PASS: dedicated-project readback showed zero Auth users, zero MFA factors, zero cron jobs, zero outstanding mail jobs, beta/tester admission false, scheduler false and pg_net absent after rollback. Both extension preparation and rollback migrations were recorded.
- PASS: exact Auth Site URL/callback refresh; section-qualified settings comparison proved all other pulled values unchanged. A first textual comparison differed only in TOML section order, not settings; the write was not repeated.
- FAIL/BLOCKED: least-privilege managed network scheduler permissions. No sending window opened.
- NOT RUN: actual owner invitation/recovery delivery, personal MFA, positive persisted hosted gameplay, updated Android APK and physical-device acceptance.

The holding page still returns HTTP200; www redirects to the unchanged apex. No custom domain, paid service, Microsoft permission, certificate, Oura resource or old Docked Preview was changed. The other-mailbox negative Exchange authorization test remains uncompleted.
