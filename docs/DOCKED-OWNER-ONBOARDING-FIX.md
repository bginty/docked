# Owner onboarding and Fantasy identity — 9 October 2026

The owner confirmed Inbox receipt, created a password and accepted the required account details and private admission. Screenshots then showed the older Edge preference wizard and a403 on Enter Docked.

Read-only production-project checks confirmed one accepted beta admission, one beta profile/social profile, no optional onboarding completion, no MFA factor and zero approved active community region policies. The wizard's save transaction calls the community policy gate, so it cannot finish during the authorized authentication-only window. Separately, branding was tied to gameplay activation flags and fell back to Edge identity when Fantasy gameplay was off.

The fix separates Fantasy presentation from gameplay authorization. Verified isolated staging uses the supplied Fantasy branding, while the existing gameplay, community, registration and external-admission gates remain unchanged. Owner-only authentication entry and optional onboarding route to `/app/owner-setup`, which requires a verified admitted owner identity. Existing in-flight preference forms receive that same destination without creating preference/completion records or bypassing the community gate. MFA success returns to owner setup rather than an administrator page before roles are granted.

No database migration, grant, region-policy approval, gameplay activation, session creation, password change, MFA enrollment or email is performed by this fix. The owner must personally sign in and enroll/verify MFA. Onboarding preferences remain deferred until the applicable gameplay/community acceptance gates pass; they are not falsely marked complete.

Validation before deployment:15 focused regression tests, TypeScript and changed-source lint. The regression confirms Fantasy presentation stays active while the gameplay capability is false and rejects wrong project/production environment bindings. Hosted owner-session acceptance still requires the owner's own browser; no credentials or MFA seeds are collected by the agent. Preserve the old deployment and holding page for rollback.
