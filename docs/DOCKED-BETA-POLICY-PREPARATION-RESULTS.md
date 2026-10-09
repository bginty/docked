> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Expedited policy and owner-auth preparation evidence

9 October 2026. Policy candidate `2026-10-09-beta-rc2` remains unapproved. Its seven exact files and aggregate digest pass integrity verification; rc1 remains unchanged. Owner operating parameters are recorded without changing runtime activation flags.

## Work completed

- Existing email hook updated to version6 with exact protected Vercel beta-origin support. All four downloaded source files matched the reviewed local code. Existing secret-value digests were unchanged by deployment.
- Only the non-secret `DOCKED_BETA_AUTH_ORIGIN` setting was then pinned to the verified protected staging URL. Certificate material and Microsoft permissions were not changed. Sender, worker, diagnostic and invitation activation remain closed.
- Actual hosted checks: eight passes for method, unsigned/altered-content/expired-signature rejection, body size, and disabled signed sender/worker/control routes. No message was dispatched or enqueued. Earlier diagnostic Inbox receipt is not new Auth-journey evidence.
- Initial trailing-whitespace signature probe returned503 rather than401; the same local Svix probe rejects that alteration. The upstream behavior is not established by this test. A meaningful signed token-field alteration returned401 as required. We do not claim byte-for-byte transport preservation or hide the initial mismatch. Disabled worker/control preparation failures correctly return400, not the initial test's expected503.
- Forty-eight existing focused Auth, invitation, Graph, staging and Android tests passed. Twelve logout/Auth-policy/readiness tests passed after the beta sign-out correction. TypeScript and changed-source lint passed.
- Beta logout previously attempted a forbidden shared-Auth-session DELETE before provider sign-out. It now asks the provider to revoke only the current session, preserves official/other-device sessions, and returns503 on failed or uncertain confirmation. This code has local regression evidence; actual signed-in provider behavior remains part of owner acceptance.
- Read-only database status: zero Auth users, beta admission/tester activation false, email scheduler false, zero pending/dispatching/unknown mail jobs. No account, role, MFA factor or tester was created.

## Prepared, not completed

The real `/mfa` route and required enrollment/verification steps were verified in source; enrollment must be done personally by the owner after onboarding. No MFA secret or recovery code was generated.

Supabase Auth Site URL/redirect settings still need an exact-origin scoped update before the controlled invitation. There is no configured direct Auth-management API token in this process. The established CLI can manage this exact project's functions; a broad configuration push is not a safe substitute. The precise settings and dashboard fallback are in [owner acceptance preparation](DOCKED-BETA-OWNER-ACCEPTANCE-PREP.md).

Hosted invitation confirmation, recovery delivery and signed-in gameplay remain blocked by policy/owner-acceptance prerequisites. The beta remains closed; the public holding page and old Preview are unchanged. No Oura access, new paid service, Microsoft grant change or production-domain promotion.

## Final closed Preview verification

Application commit: `da3b48a2a6235d1f7592047dd00724586cbb6c0e`.
Deployment: `dpl_9bpzTDoiyMQTZ5etwpmajVJVtK4h`, READY, explicit Preview request and verified built-in Preview response (raw target null).
Protected URL: https://docked-production-7id3ohty2-briant-s-projects.vercel.app

- 38 actual hosted closed-access checks passed. These include MFA-page availability without enrollment material, closed invitations, authorization denials, isolated database connectivity, invalid callback handling, security headers and 12 responsive page checks at 320/412/1366px. Browser emulation only; no physical-device acceptance or successful signed-in journey is claimed.
- The committed export scan passed across 531 files. All 17 served browser assets passed the credential/private-data scan.
- Eight hosted email denial checks passed again after pinning the exact new origin. Mail activation flags remain false; no email sent, account created or MFA factor enrolled.
- No custom domains or aliases were attached. The public holding page returned 200 and www redirected to the unchanged apex.
- An initial Vercel project preflight returned HTTP403 before submission. The existing CLI session refreshed normally during a successful exact-project read, after which deployment succeeded. No new token, permission or authentication bypass was needed.

The two additional hosted checks are preserved in `scripts/beta-hosted-acceptance.mjs`. Machine-readable deployment and hosted reports are under `docs/qa/beta-isolation/`; email evidence is under `docs/qa/beta-policy/`. The policy packet itself is unchanged and remains unapproved.

Next owner decision: the single exact-version approval in `DOCKED-BETA-POLICY-APPROVAL.md`. Subsequent controlled owner onboarding still requires the exact Auth URL configuration, approved beta runtime policy configuration, personally completed MFA and successful real email/auth/gameplay acceptance. External tester admission remains disabled. The other-mailbox Microsoft negative authorization test remains unperformed; this work does not change that limitation.
