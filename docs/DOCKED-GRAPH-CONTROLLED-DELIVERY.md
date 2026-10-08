# Docked Graph certificate and controlled delivery checkpoint

8 October 2026, continued from `9b31e437` on the existing branch. **The one controlled message reached support's Inbox, as confirmed by the owner. The production Auth hook and signup remain disabled.**

**Subsequent administrator verification:** continued from preserved checkpoint `94179080`; no reset to the earlier commit. The owner has now supplied the valid exact support-only `RecipientFilter`, the scoped send assignment and positive mailbox authorization. The scope-property discrepancy is resolved by that full readback. Refreshed live certificate authentication returned HTTP 200, and the exact app's application-role grants remain empty with no next page. No second email was sent. The remote disabled flag and closed signup were read again and remain unchanged. The sections describing the earlier pending Exchange readback below are historical where noted.

## Identity and authentication

| Item | Result |
| --- | --- |
| Application | Owner-registered **Docked Production Email** |
| Tenant | `b34880d6-d28e-40c2-b389-232506c69650` |
| Client | `b725bf93-6183-40c5-9aac-839e02ace03a` |
| Enterprise application | `081adc14-2b0f-4c3a-b078-1bb7b171d05f` |
| Sender and sole recipient | `support@docked.com.au` |
| Certificate | Existing certificate matches the existing securely held private key; SHA-256 `842CBED98C6984BD3D2BC15897EFDD46012C465A0ECD18C54769295942B791A1`; expires 8 October 2027, 11:04:40 UTC |
| Live Microsoft authentication | HTTP 200 using `client_credentials`, PS256 certificate assertion and Graph `.default` scope; exact tenant/client, certificate credential type `2`, no delegated scope |

No certificate, signing secret or long-lived credential was generated or rotated. The private key was loaded only locally for signing and matching; it was not printed, committed or uploaded. OAuth access tokens stayed in process memory and were not recorded. The registered certificate was accepted by Microsoft's token endpoint.

## Permission audit — distinguish separate authorities

- **Entra application grants: live readback completed.** `GET /v1.0/servicePrincipals/081adc14-2b0f-4c3a-b078-1bb7b171d05f/appRoleAssignments` returned HTTP 200, an empty collection and no next page. The Graph token also had no application `roles` and no delegated `scp`. This is stronger evidence than the app registration's requested-permissions page, but does not describe Exchange RBAC.
- **Exchange RBAC: administrator readback received.** The owner supplied the completed read-only audit: scope `Docked-Support-Mailbox-Only`, `RecipientScope`, `RecipientFilter = PrimarySmtpAddress -eq 'support@docked.com.au'`, `IsValid=True`, `ObjectState=Unchanged`; assignment `Docked-Support-MailSend`, `Application Mail.Send`; support authorization `InScope=True`, `CustomRecipientScope`. These facts are administrator evidence, not a claim that the agent independently connected to Exchange or enumerated every assignment.
- **Actual mailbox read denial: HTTP 403 `ErrorAccessDenied`.** A Graph query restricted to the exact test subject in support's Inbox was denied. This establishes no successful read access to that Inbox through the tested request, not absence of every possible broader RBAC permission.
- **Other-mailbox negative authorization: NOT RUN.** No second real mailbox exists. No invented address was tested, no other recipient was contacted, and no negative authorization pass is claimed.
- ExchangeOnlineManagement 3.10.1 is installed, but this agent's PowerShell session has zero authenticated Exchange connections. Browser automation failed during initialization. No Microsoft administrator credentials or new read/admin permissions were requested for the mail application.

The [administrator read-only procedure](DOCKED-EXCHANGE-READONLY-AUDIT.md) is retained for evidence and future revalidation. No additional role or broader filter was reported in the completed administrator audit. The unavailable negative-mailbox test remains explicitly unverified; do not create or purchase a mailbox merely to manufacture a pass.

## Controlled delivery and deadline failure

Exactly one diagnostic email was attempted at **22:55:16 Sydney time on 8 October 2026** (11:55:16 UTC), using the existing `sendGraph` adapter locally, fixed sender, fixed sole recipient, and the provided application identifiers. No signup account, verification token, recovery link or attachment was created.

Subject: **Docked Production Email — controlled delivery check DOCKED-MAIL-CHECK-20261008115516745**.

The adapter's shared four-second network budget expired with `TimeoutError`; no Graph acknowledgement was received. The agent did not retry automatically. The owner subsequently confirmed **“Received in Inbox”** for that exact subject. Therefore delivery is confirmed by the recipient, while Graph submission acknowledgement remains unobserved. A later read-only diagnostic acquired a token in approximately 400 ms and received the Inbox read denial in approximately 118 ms; those timings do not explain or invalidate the earlier send timeout.

This is a real delivery result, not a successful hosted Auth acceptance test. The current synchronous hook could return a redacted 503 after Microsoft has already accepted a message, causing retries and duplicate copies of the same one-time link. Before activation, investigate the deadline behavior and validate a delivery strategy compatible with Supabase's five-second hook limit; do not merely lengthen the request beyond that deadline or treat a timeout as success. An optional narrowly scoped Exchange message trace is included in the administrator guide. No extra email or background retry was scheduled.

## Hosted state verified unchanged

The production function was downloaded read-only from exact project `pojoymtniryarxxunyvz`. Both `index.ts` and `mail.mjs` match the committed implementation after line-ending normalization. It uses mandatory raw-body hook signature verification and certificate-based application-only Graph authentication, with no mailbox password, client secret or delegated-user flow.

The remote `DOCKED_GRAPH_MAIL_ENABLED` secret's digest matches `false`. No `GRAPH_*` credentials or identifiers are installed in the hosted function yet; therefore **the deployed hook implements the intended method but is not yet configured to send with this application**. The successful local test supplied the actual IDs and existing key in memory only. Production signup is still disabled and email confirmation required. No hook deployment, secret update, provider configuration or DNS mutation occurred in this continuation.

## Remaining actions

1. The administrator's exact support-only scope and positive authorization readback are now recorded. Preserve this configuration; keep the unavailable second-mailbox negative test explicitly unverified. No repeat of the completed scope check is requested.
2. Investigate and resolve the acknowledgement/deadline failure before enabling the synchronous production hook. Do not add paid services, broad permissions, legacy authentication or automatic blind retries.
3. Once all required security/reliability gates pass, install the existing certificate credentials and exact IDs in the dedicated production function's secret store through secure tooling, using the existing signing secret. Activation and controlled hosted Auth testing must respect the owner's current prohibition on public signup and other recipients.
4. Signup verification and recovery through a real hosted PKCE session remain untested. The diagnostic delivery alone does not approve public registration or production launch.

Evidence: [certificate, token and grants](qa/fantasy-production/graph-application-preflight.json), [controlled send and owner confirmation](qa/fantasy-production/graph-controlled-send.json), [read-denial check](qa/fantasy-production/graph-inbox-check.json), [deployed-source and disabled-state readback](qa/fantasy-production/graph-hook-readback.json).

The prepared administrator command blocks passed PowerShell syntax parsing but were not executed against Exchange. Changed-file credential/address scanning passed with zero findings/errors, and `git diff --check` passed. [Scan evidence](qa/fantasy-production/graph-authorization-secret-check.json).

No Oura, Preview or Vercel resources were accessed or changed. The holding page, Netlify, billing and paid services were unchanged. No new security-review agent or model-effort switch was used. Source behavior did not change; this checkpoint records live integration tests and administrator handoff rather than claiming new application regression results.

Sources: [Microsoft certificate assertions](https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials), [application-role assignment readback](https://learn.microsoft.com/en-us/graph/api/serviceprincipal-list-approleassignments?view=graph-rest-1.0), [separate/additive Exchange RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [Graph acknowledgement semantics](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [Supabase HTTP hook deadline](https://supabase.com/docs/guides/auth/auth-hooks).
