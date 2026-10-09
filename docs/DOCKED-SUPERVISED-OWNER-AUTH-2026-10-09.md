# Supervised owner authentication acceptance — 9 October 2026

## Outcome

**BLOCKED: the owner cannot sign in yet.** The final invitation was rejected by Supabase Auth with HTTP429 `over_email_send_rate_limit` at 09:25:56 UTC (20:25:56 Sydney). No email was accepted by Graph during this window, no Auth user or admission exists, and no MFA factor or administrator role was created. All sender, worker, invitation and diagnostic email switches are closed; the local operator approval is disabled. No retry or schedule is active.

The user authorized support@docked.com.au only, supervised dispatch, and owner authentication. External testers, public registration, public-domain promotion and unattended sending remain prohibited. Gameplay activation is still gated on authentication/MFA acceptance. The seven approved rc2 policy documents are unchanged.

## Deployment and changes

- Protected website: https://docked-production-i8koncmem-briant-s-projects.vercel.app
- Deployment: `dpl_5fADFGCKB9LGuwMLxjjE1cqjVZ4y`, READY, application commit `afba9f559ac1fb6d38aa0968de00a7bea0aa4874`.
- Vercel project: `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`; team: `team_tf6xweKKyVCj9bTppUKttJ4l`; review branch: `codex/vercel-beta-review`.
- Explicit CLI Preview request, raw API target null for built-in Preview, protected access, no custom domains or aliases. Production branch remains main. Exact callback URLs point at this deployment.
- Supabase project: `pojoymtniryarxxunyvz`; organization: `otldyeunbqabbcjydjpe`.
- `afba9f55`: owner-only authentication permission and exact approved beta policy binding, without public-production policy approval or gameplay activation.
- `3e6fcfe7`: one-attempt operator invitation workflow and mandatory shutdown/readback. It is not deployed to the browser or scheduled.
- `e1d1b76c`, superseded in part by `d86f158e`: accept the exact GoTrue service base URL forms while retaining the exact protected website callback restriction.
- Hook source was deployed and downloaded for four-file SHA-256 comparison at function version 16. Subsequent environment-switch updates changed the runtime revision; version 16 is source-deployment evidence, not a claim about the final runtime revision.

## Investigation and bounded requests

1. Initial invitation failed with Auth500/hook400. Readback confirmed zero users, admissions and production mail rows. Diagnostic details contained fixed reason codes only.
2. Inspection of Supabase Auth's `sendEmail` implementation showed `email_data.site_url` can be the Auth service external URL, rather than the configured website Site URL. The original hook incorrectly required a website origin. A first exact-project-root correction was insufficient: the next manually reconciled attempt still returned `site_origin` rejection. No Graph send or durable account occurred.
3. The final correction also recognizes only the exact dedicated project's `/auth/v1` base, with an optional trailing slash. Foreign projects, arbitrary paths/query strings and alternate website callbacks remain rejected.
4. One real provider probe with sending and worker deliberately OFF returned the expected hook503 instead of a validation400. Auth rolled back; users and production mail rows remained zero. This proves actual provider payload compatibility, not delivery.
5. The subsequent bounded invitation returned429 before an account or mail job was created. No automatic retry followed. Earlier attempt markers and evidence are retained; they must not be deleted to rerun the script.

The final hourly email quota is not exposed by the scoped CLI configuration pull. The local management API token is absent; no CLI credential was extracted. The provider did not supply an exact reset timestamp in the captured evidence. Do not infer a project quota from Supabase defaults or promise an exact cooldown. Supabase documents project-level email limits and dashboard inspection under [Authentication > Rate Limits](https://supabase.com/docs/guides/auth/rate-limits).

## Acceptance results

| Check | Result and limit |
| --- | --- |
| Final targeted regressions | PASS: 36 tests across beta staging, Graph mail, worker, invitation, policy approval and operator dispatch; local tests are not production delivery evidence. |
| TypeScript and changed-script/test lint | PASS. |
| Hosted unauthenticated checks | PASS: 9 checks, including malformed/fake invitation handling, cross-origin denial, closed signup, setup session requirement, MFA page, exact policy route, 390px/1366px layouts. Browser emulation only. |
| Real provider payload | PASS through validation with sending deliberately disabled; expected503, no mail/account side effects. |
| Certificate authentication | PASS: existing certificate matches private key, PS256 client-credentials token request200. No rotation or disclosure. |
| Effective Graph application grants | PASS: complete readback200, assignments empty, token application roles empty. Existing Exchange support-only RBAC remains based on administrator-supplied evidence. |
| Other-mailbox authorization denial | NOT RUN: no second real mailbox. |
| Final database safety | PASS: users0, factors0, admissions0, cron jobs0, pg_net/net absent, scheduler false, admissions/testers false, outstanding mail0. No grants or migrations changed during this window. |
| Dispatcher shutdown | PASS: all mail flags false, private approval disabled, credential digests unchanged. |
| Auth invitation | BLOCKED:429 `over_email_send_rate_limit`. |
| Current-window Inbox delivery, confirmation, recovery, expired/reused real links, AAL2/admin session | NOT RUN successfully; there is no owner account. Prior controlled Inbox confirmations do not prove this Auth journey. |
| Positive persisted gameplay / new Android beta APK | DEFERRED until mandatory authentication and MFA acceptance passes. No physical-device test claimed. |
| Public holding page | Preserved: apex200, www301 to unchanged apex; no production domain changes. |

No Oura, existing Docked Preview or unrelated Vercel project was accessed or changed. No Microsoft permission, certificate, database privilege, paid service or public registration setting was broadened.

## Exact next owner/operator steps

1. In the dedicated [Supabase production project](https://supabase.com/dashboard/project/pojoymtniryarxxunyvz), open **Authentication > Rate Limits** and report the current email-sending quota. Read only: do not increase or disable it. No password, API key or secret is needed.
2. Keep all sending switches OFF while the quota recovers. Confirm a time when the owner is present to check support@docked.com.au. There is no automatic retry or scheduled wake-up. If429 persists in a later supervised window, request Supabase support to identify the effective email-hook quota/reset for this project; do not bypass it.
3. Before one further manual attempt, the operator must reconcile the retained429 receipt and recheck zero users/outstanding jobs, exact deployed source/callback, closed signup, Graph grants and current protected preflight. Prepare a new explicitly bounded attempt without erasing earlier markers. The current three one-shot commands deliberately refuse replay.
4. After an actual invitation is accepted and dispatched once, disable the dispatcher again and ask the owner to confirm Inbox delivery. Do not equate202 or Sent Items with delivery.
5. Only then: the owner opens the protected website in the same browser, follows the invitation confirmation, chooses a private password, completes approved-policy/Australian18+ onboarding with the local admission code, and personally enrolls an authenticator at `/mfa`. Do not share passwords, invitation links, TOTP seeds or codes in chat. No admission code has been created yet.
6. Read back a verified owner factor and AAL2 session before granting administrator capability. Complete one supervised password-recovery journey, invalid/expired/reused-link checks, session security and persisted gameplay. Prepare the Android beta only after the required acceptance gates pass.

## Evidence

- `qa/owner-acceptance/supervised-invitation.json`: final429 and shutdown receipt.
- `qa/owner-acceptance/initial-invitation-rejected.json`, `project-root-invitation-rejected.json`: retained failed attempts.
- `qa/owner-acceptance/provider-no-send-probe.json`: real provider503 validation proof.
- `qa/owner-acceptance/rate-limit-readback.json`: scoped rate-limit diagnosis and readback limitation.
- `qa/owner-acceptance/supervised-preflight.json` and `login-390.png` / `login-1366.png`: protected hosted checks and screenshots.
- `qa/owner-acceptance/auth-url-final.json`: callback changes only; other pulled Auth settings preserved.
- `qa/fantasy-production/graph-application-preflight.json`: certificate and effective-grant audit.
- `qa/beta-policy/email-function-deployed.json`: hook source hash comparison.
- `qa/vercel-review/verified-preview-deployment.json`: deployment, protection and holding-page verification.
