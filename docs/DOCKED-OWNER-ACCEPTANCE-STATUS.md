# Owner acceptance — approved policies, remaining scheduler permission gate

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
