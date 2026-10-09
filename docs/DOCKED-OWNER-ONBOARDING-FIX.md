> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Owner onboarding and Fantasy identity — 9 October 2026

The owner confirmed Inbox receipt, created a password and accepted the required account details and private admission. Screenshots then showed the older Edge preference wizard and a403 on Enter Docked.

Read-only production-project checks confirmed one accepted beta admission, one beta profile/social profile, no optional onboarding completion, no MFA factor and zero approved active community region policies. The wizard's save transaction calls the community policy gate, so it cannot finish during the authorized authentication-only window. Separately, branding was tied to gameplay activation flags and fell back to Edge identity when Fantasy gameplay was off.

The fix separates Fantasy presentation from gameplay authorization. Verified isolated staging uses the supplied Fantasy branding, while the existing gameplay, community, registration and external-admission gates remain unchanged. Owner-only authentication entry and optional onboarding route to `/app/owner-setup`, which requires a verified admitted owner identity. Existing in-flight preference forms receive that same destination without creating preference/completion records or bypassing the community gate. MFA success returns to owner setup rather than an administrator page before roles are granted.

No database migration, grant, region-policy approval, gameplay activation, session creation, password change, MFA enrollment or email is performed by this fix. The owner must personally sign in and enroll/verify MFA. Onboarding preferences remain deferred until the applicable gameplay/community acceptance gates pass; they are not falsely marked complete.

Validation before deployment:15 focused regression tests, TypeScript and changed-source lint. The regression confirms Fantasy presentation stays active while the gameplay capability is false and rejects wrong project/production environment bindings. Hosted owner-session acceptance still requires the owner's own browser; no credentials or MFA seeds are collected by the agent. Preserve the old deployment and holding page for rollback.

## Protected release evidence

Application commit: `9cfddee390b8ebc9716b604d30cde49995dae947`.
Deployment: `dpl_vcRdRDfrqAHPQgZBvvK2mhcRMVyP`, READY, explicit Preview target, no aliases/custom domains. URL: https://docked-production-24ts2fdje-briant-s-projects.vercel.app

All12 hosted checks passed on9October at11:17UTC: owner/onboarding routes redirect unauthenticated requests to login, Fantasy login branding, invitation and cross-origin denials, closed public signup, setup session requirement, un-enrolled MFA UI, approved policies and390px/1366px layout checks. Next.js streams the login redirect inside an HTTP200 response; the test checks the exact redirect and absence of owner content rather than treating200 as authenticated access. The first307-only test assumption failed and was corrected without changing application authorization. No positive owner-session or MFA test is claimed.

The536-file export scan passed with no known-secret matches. Independent Vercel readback confirmed the exact project/team/branch/commit and Preview protection. The apex holding-page content hash and www redirect match the previous release. All email switches remain OFF. No Auth Site URL or email-hook callback changes were made for this release; any later recovery test must review/bind its exact callback before separate send approval. Password login and MFA do not require a new invitation or callback change.

Next owner action: open `/app/login` on this new deployment and sign in with the password already created. `/app` now leads to owner setup rather than the old preferences wizard. Follow the MFA link; the owner personally copies the authenticator secret into their authenticator, then enters Factor ID and the current six-digit code in the verification form. Successful MFA returns to the owner setup status. No administrator role is granted by the UI.
