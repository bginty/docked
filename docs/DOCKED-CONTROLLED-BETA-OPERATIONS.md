# Controlled beta operating handover

9 October 2026. **External activation remains blocked by policy and positive hosted acceptance gates.** The shared-inventory and atomic-admission blockers described at `d991e8b8` have been implemented and independently tested. See [current isolation acceptance](DOCKED-BETA-ISOLATION-ACCEPTANCE.md) and its deployment evidence for the current URL/commit. This supersedes the earlier technical-blocker section; historical evidence remains in Git.

## What is ready

The dedicated project `pojoymtniryarxxunyvz` contains isolated `beta_public`, `beta_private` and `beta_fantasy` records and a restricted `docked_beta_app` role. Official inventory, lifetime entitlements, points, rankings and immutable history remain unchanged. The beta runtime cannot access official gameplay. No Auth accounts have been activated.

Admission reserves at most ten lifetime tester slots. Expired, revoked and suspended reservations retain their slots. Only explicitly designated administrator UUIDs are excluded. Database row writes enforce serialization even for stale `REPEATABLE READ` snapshots; callers receiving a serialization failure must reconcile and retry in a fresh transaction. Email delivery cannot silently release a slot.

The protected web application can connect to beta data with all member, email, fantasy and tester activation gates closed. This is infrastructure acceptance, not a playable account demonstration. Public registration, payments/trading, unverified live data and official betting publication remain disabled.

## Exact owner actions

1. Resolve the factual/compliance concerns and approve exact versions/hashes in [the seven-document policy matrix](DOCKED-BETA-POLICY-APPROVAL.md). Candidate `2026-10-09-beta-rc1` is not effective or approved. Confirm proposed adult eligibility and operational commitments; verify Microsoft tenant geography/retention/holds and applicable privacy facts with the administrator. Existing company, Australia-only and owner responsibility decisions do not need repeating.
2. After approved policies are recorded and controlled owner acceptance is prepared, personally confirm the invitation sent only to `support@docked.com.au`, set a unique password, complete Australian eligibility and policy consent, and enroll MFA at `/mfa` on the exact protected deployment. Never send passwords, authenticator seeds or recovery material to Codex.
3. After positive hosted acceptance passes, provide up to ten authorized Australian adult tester addresses privately. No addresses are inferred. Approve any policy amendments by exact version; approval is not inferred from reading a draft.

## Operator activation sequence after policy approval

- Record approved versions, digest and evidence in the beta manifest and beta admission control only; keep the official production approval manifest unchanged. Initialize finite beta stock and reviewed Australian community policy. Keep `testers_enabled=false` and external activation false.
- Pin the exact deployment origin in Supabase Auth and the signed Microsoft Graph hook. Prepared origin support is committed but has not been deployed/configured by this isolation task. No Microsoft grants, certificate or secret rotation is needed.
- Use the privileged operator path to prepare the designated owner's verified Auth invitation identity and reserve its beta admission. This bootstrap is separate from the MFA-protected application invitation API; email matching does not grant a role. Supabase `generateLink(type: invite)` can prepare an identity/link without sending. Do not send unless reservation succeeded and uncertain outcomes were reconciled.
- Complete controlled email delivery and owner onboarding, then personally enroll MFA. Verify `aal2` and grant only the audited designated owner role. The API requires both role and explicit administrator designation. A lost authenticator needs identity verification, an audit record and session revocation through authorized administration; there is no claimed recovery-code feature.
- Run actual hosted invitation/confirmation/recovery, expired/invalid links, failure and duplicate-send tests, then persisted gameplay and cross-device tests. A Graph202 or local test alone is insufficient. The only currently authorized recipient is the support mailbox.
- Record successful acceptance before independently enabling external testers. `POST /api/beta/invitations` supports reserve, renew, revoke and suspend with MFA, same-origin and rate limits. It returns `emailSent:false`; the operator must use the verified signed email workflow. Codes are private, single use and one-hour expiry by the API. Renewals invalidate old codes and preserve the reservation. No new account should be invited until admission and delivery are reconciled.

The ignored roster file `private-data/production/beta-testers.json` can be validated with `node --import tsx scripts/prepare-beta-invitations.ts`. That preparation sends nothing and is not a substitute for the database controller.

## Remaining technical acceptance

Positive hosted Auth and gameplay, owner MFA, real multi-user moderation and cross-device persistence remain untested while policy/account gates are closed. Verified market evidence is required for scored edges; missing providers stay disabled. Existing local NFL catalogue/community tests do not establish live NFL fixture/odds readiness. No official predictive model is enabled.

Android packaging remains conditional on hosted acceptance and a verified protected-origin/session method. No new APK or physical Samsung/iPhone acceptance is claimed. The public holding page, existing Docked Preview and unrelated systems remain outside this activation.
