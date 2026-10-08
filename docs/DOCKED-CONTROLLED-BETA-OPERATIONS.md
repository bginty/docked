# Controlled beta operating handover

9 October 2026. **Activation blocked.** Protected visual review remains at https://docked-production-dxscf1vyc-briant-s-projects.vercel.app, deployment `dpl_9jGArtd1RjBYxiGCffDupBWTPuos`, application commit `2c9a9957`. The owner-approved scope is recorded in `config/controlled-beta.json`; it is not an activation manifest.

## Administrator setup — owner steps once activation is ready

Designated identity: **support@docked.com.au**. No account has been created, invitation sent or role granted. That mailbox must remain under the owner's control; do not share its Docked password or authenticator with testers.

1. After the policy, isolation and controlled Auth test gates pass, open the support mailbox's invitation on the exact approved protected deployment. GET displays a confirmation page; the deliberate confirmation POST consumes the single-use Auth invitation. Do not forward the link.
2. Set a unique password of at least 12 characters on the invitation reset-password flow. Complete Australian eligibility and effective policy acceptance. These routes are currently disabled on the credential-free Preview; do not attempt to work around that.
3. Sign in and open `/mfa` on the approved deployment. Select **Set up authenticator**. Add the displayed secret to an authenticator on your own device, then enter its Factor ID and six-digit code in **Verify MFA**. Do not paste the secret, token, QR code or recovery material into chat/screenshots.
4. The operator verifies a real `aal2` session and grants the designated identity the minimum required role through the privileged audited path. Email matching alone or editable user metadata must never grant a role. Verify a normal member cannot invoke admin functions and a downgraded/expired session loses privileged access.
5. Sign out and verify fresh sign-in plus MFA. Verify session revocation and account suspension before external testers. Secure your mailbox's own Microsoft 365 MFA/recovery independently.

The current UI does not establish a recovery-code facility; none is invented here. Lost-authenticator recovery needs an owner-identity verification procedure using existing authorized Supabase administration, an audit record and session revocation. Never disable MFA simply because somebody controls a support message. This recovery procedure and actual MFA challenge remain untested gates.

## Prepare the ten-tester roster now — no sending

The cap is ten invited testers in addition to the designated owner. Create the ignored local file `private-data/production/beta-testers.json` as an array of objects containing only `email` and `country: "AU"`. Use actual owner-authorized addresses; no tester addresses have yet been provided.

Run:

```powershell
node --import tsx scripts/prepare-beta-invitations.ts
```

This checks at most ten entries, case-insensitive duplicates, Australian country, valid email format, owner reuse and injected role fields. It writes only the ignored local `beta-invitation-plan.json`; console output contains counts, not addresses. Every tester is a member. It does **not** send, create tokens/users, grant permissions, establish genuine-person uniqueness or enforce a database cap. Plus aliases are not proof of different people. Actual eligibility is checked during verified onboarding.

## Required sending workflow — not enabled yet

Before any send, implement and test an atomic database admission reservation that counts all pending and accepted tester slots, with a separate single owner slot. Reservations are idempotent by canonical email and cohort; concurrent operators cannot exceed ten. Failed/ambiguous email must not silently release a slot or create another identity. Expired links can be replaced only through the same reserved identity; preserve the audit history.

Use the existing Supabase invitation flow, secure provider tokens and signed Graph queue. Configure and verify bounded link expiry (one hour is the proposed initial setting), single use and exact callback allowlisting. Tokens/links must never enter public logs. Resending requires checking the original receipt and Auth state; Graph acceptance alone does not prove Inbox delivery. Never retry a dispatched message blindly. Do not call an unrestricted admin invite API as a workaround for the missing admission controller.

After owner policy approval and isolation proof, first run the support-only invitation/confirmation/recovery/expiry and failure-reconciliation acceptance. Only then invite the supplied tester addresses, one controlled batch, with public signup disabled. Email verification and current consent must precede gameplay. Suspend access and revoke sessions through the existing audited process when required. Do not label successful local fixture tests as hosted acceptance.

## Critical technical blocker: shared inventory is not isolated beta inventory

Fresh read-only production inspection found zero Auth users/cards/rounds/claims, all 24 migrations preserved, and channel `beta`. The risk is structural, not evidence of existing production corruption.

`20261007234952_fantasy_free_play_production.sql` has a singleton `production_catalog`, `starter_claims` keyed solely by user, daily claims unique by user/day and shared edition/pack supply. `20261008151700_fantasy_beta_result_isolation.sql` separates fantasy round/result and reward totals, but deliberately retains permanent cards and lifetime entitlements across release transitions. The regression at `tests/database/fantasy-production.test.ts` explicitly tests that carry-over. Community-edge monthly/lifetime records also lack demonstrated complete beta/official partitioning.

Concrete failure: a beta starter consumes the same account's lifetime starter entitlement and edition supply that a later stable release would use. Merely setting `DOCKED_RELEASE_CHANNEL=beta`, starting from zero rows, adding a badge or filtering a leaderboard does not meet the owner's new isolation requirement.

### Corrective implementation sequence

Reuse the same approved Supabase project and existing game algorithms. Do not create another paid project, clone Preview data or rewrite old migrations. The proposed smallest coherent change is an immutable beta/official namespace carried through inventory definitions/editions, allocations, starter and daily entitlements, request receipts, cards/lineup eligibility, settlement and community ranking queries. An isolated schema is an alternative if it provides a clearer least-privilege boundary; neither option is implemented or approved by this document.

1. Review a forward migration with composite ownership/namespace constraints and separate finite beta edition/pack pools. Preserve existing record meaning as legacy; do not reclassify or delete historical cards or receipts. Account/session identity may be shared, but gameplay authority and balances must not leak across namespaces.
2. Enforce namespace on the server and database, never from editable profile metadata or a client-selected query parameter. Restrict the beta runtime role to beta operations; remove callable legacy bypass paths. Scope receipt replay and lineup/card eligibility correctly without losing original immutable receipts.
3. Partition community submissions, settlement and monthly/lifetime aggregates. Beta feeds must not become official verified odds or performance evidence. Without an approved verified market source, edge submission remains unavailable; do not fabricate market evidence to make acceptance pass.
4. Implement the atomic ten-tester admission ledger and suspension/session checks, then connect the verified owner identity only after mandatory policy gates pass.
5. Prove isolation on local real PostgreSQL: create official sentinel data, hash the official inventory/claims/balances/rankings before and after concurrent beta starter/open/daily/seventh-claim/settlement activity; require unchanged official state. Attempt cross-namespace card use, transfers, receipt replay, direct RPCs, role injection, stale-session races and simultaneous eleventh invitations. Preserve scarcity within each namespace.
6. Obtain the focused integrity review before applying that migration to the production project. This is the complex database/ownership area flagged for the separate bounded deeper review requested earlier; no new Ultra audit ran this turn.

### Vercel staging work after isolation and policy gates

Continue in the existing project/team and review branch, explicitly targeting Preview. Keep the credential-free deployment until a separately reviewed connected staging profile exists. The current production guard, environment exporter and invitation origin allowlist still assume Production/Netlify staging. Adapt them together to the exact protected Vercel origin, genuine Preview system metadata and least-privilege beta runtime. Do not upload production credentials into the existing review-only profile or fake `VERCEL_ENV`.

Bind Supabase callbacks and the email hook to the exact reviewed origin, keep signup closed, retain Vercel Authentication, and use the dedicated production project only. Supabase HTTP redirects must not accept arbitrary subdomains. Acceptance evidence must bind project, deployment, commit and policy hashes. The `approved` production flag remains false; no public-domain promotion is authorized by this instruction.

## Android

No APK is built until real hosted Auth/gameplay acceptance passes. Existing packaging targets and branding are preserved. The beta receipt currently requires the verified live origin, so protected Preview targeting and Vercel session behavior still need explicit support. Afterward verify website/app account synchronization, secure sessions and APK signature/hash; provide normal Android outside-Play installation instructions. Browser viewports and component fixtures are not Samsung S24 or iPhone hardware acceptance.

## Current evidence and next actions

- PASS: 211 isolated database tests; 36 email/invitation/NFL platform tests; nine real local PostgreSQL gameplay/race scenarios; six real local PostgreSQL mail-queue scenarios; two invitation-plan validation tests. These are not hosted positive journeys.
- PASS: nine isolated Chromium checks for deliberate invitation confirmation/replay, explicit consent, NFL 32-team navigation/filters and beta results at mobile/desktop widths. The first run omitted the local reset-password page and failed two redirect checks; corrected server setup passed all nine without application Auth changes. These fixtures are not real email delivery or persisted multi-user acceptance. TypeScript and changed-source lint pass.
- Evidence: [live read-only status](qa/playable-beta/hosted-readonly.json), [production ACL/isolation readback](qa/playable-beta/production-readonly.json), [real local gameplay](qa/playable-beta/local-postgres-gameplay.json), [real local mail queue](qa/playable-beta/local-postgres-mail.json), [isolated browser summary](qa/playable-beta/browser-summary.json). The earlier 32 hosted review checks remain prior evidence on the unchanged deployment; they were not rerun or called playable acceptance.
- Fresh live read-only checks: healthy dedicated production project; RLS on public tables; runtime role has no superuser/bypass-RLS/create-role/create-database privileges; no direct card writes; anon/authenticated cannot execute the production command directly. This is a scoped ACL check, not exhaustive production acceptance.
- Signup remains closed and email confirmation required. Mail scheduler is disabled. The previously accepted diagnostic receipt remains one dispatch with erased payload. No new mail, account or Microsoft permission change occurred. The four-second acknowledgement issue was addressed by the durable queue previously; full hosted Auth integration remains untested, and no other-mailbox negative result is claimed.
- Preview still redirects anonymous visitors to Vercel login. Public holding page is still HTTPS 200; www redirects to it. No Oura or existing Docked Preview access/modification, no migration or paid-service activation.
- Owner: resolve the [exact policy matrix](DOCKED-BETA-POLICY-APPROVAL.md), then perform MFA personally and provide authorized tester addresses. Already-confirmed country, administrator and responsibility decisions do not need repeating.
- Technical: inventory/community isolation, atomic admissions, connected Vercel staging and positive hosted acceptance remain unfinished. Policy approval alone will not make the beta playable.
