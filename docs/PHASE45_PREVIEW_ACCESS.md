> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Phase 4.5 preview access and account lifecycle

This is an isolated test-access mechanism for Docked Preview (`bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`). It grants no legal approval, paid entitlement, staff role, real Edge publication or genuine performance ranking.

The existing per-account preview grant now carries explicit capabilities. Existing grants retain only `community_social` and `public_profiles`. Reviewed new grants can additionally permit `preview_market_fixtures` and `preview_top_docked`. All four are project-bound, expiring, revocable and audited. Genuine `community_edges`, `leaderboards`, tips, marketing and commercial features remain governed by their original policies. The synthetic market tables have no canonical-ledger foreign keys or social-post projections.

Every capability operation uses a verified Auth session and checks the exact user, private grant and policy again after locks using the database clock. Fixture capabilities also require current privacy acceptance. No user metadata, signup field, region selection or browser write can grant access. Private tables have RLS and no anonymous/member privileges; SQL functions are invoker functions with PUBLIC execution revoked. Administrator API operations additionally require an actual owner/admin role and MFA; auditors can inspect only.

## Invitation signup

Normal hosted signup remains disabled. An administrator or reviewed operator creates a one-use invitation for one exact normalized email address. Only hashes of the invitation code and email are retained while the invitation is pending/reserved. Redemption reserves a fresh UUID, creates that new Auth identity through the Admin API without sending email, creates the matching profile/consents/grant, and signs in through the ordinary password session flow. Failed or uncertain creation never attaches a grant to an existing email account; known newly created identities are revoked/erased and uncertain cleanup is audited for operator review.

`email_confirm=true` here is administrator provisioning, **not evidence of email ownership**. Server-owned metadata records `preview_invitation_confirmed=true` and `email_ownership_verified=false`. Analytics and callback logic exclude this from verified-email counts. The app explicitly explains that no email was sent.

Invite signup requires an available public username, country/state, explicit age attestation, separate terms and privacy acceptance. Marketing defaults off. Optional analytics is off for this path. The code is shown once in the protected administrator response and must be shared privately; it is never sent automatically or placed in a URL.

Administrator routes: `GET/POST /api/admin/preview-testers`. POST actions are `invite`, `grant`, `revoke_grant` and `revoke_invitation`; every mutation requires same origin, MFA, current private role, rate limits and a reason. Capabilities on an existing grant are immutable; changing them creates another audited grant. Revocation takes effect at the next gated operation.

## Onboarding and email limits

`/app` checks private persisted app onboarding state. First onboarding records sports, interests, timezone and in-app notification choices. Existing owner legal fields remain untouched until the owner personally accepts the form; an absent public profile requires their chosen username. Completion persists, so routine reopening does not repeat onboarding. Existing jurisdiction changes still use the dedicated alert-pausing endpoint.

The app's `app:true` request marker controls destinations only. It cannot grant access. Preview onboarding can enable only in-app preferences; digest, education and external Edge alerts remain off. Account export includes app onboarding and the account's preview grant history. Deletion removes personal onboarding/grants and clears the invitation's live profile foreign key. Pseudonymous reservation/audit UUIDs and fixture evidence remain; redeemed invitations retain no email or token hashes.

The legacy hosted mail-capture exception remains closed and unchanged. Its independently proved callback allowlist does not cover new app callbacks, so hosted app signup without an invite, recovery and resend fail safely rather than claiming delivery. A local Supabase mail sink can exercise app verification/recovery without external emails. Any future hosted callback/capture expansion needs a separate reviewed proof; no real mailbox delivery is enabled by this phase.

Provider outages during `getSession`/`getUser` produce an unknown/error response rather than falsely reporting a revoked session. Explicit invalid-session/token responses still deny access. No unverified token claims are trusted.

## Operator workflow

`scripts/hosted-preview/phase45-beta.ts` has explicit modes, each requiring `--confirm-project=bckkllmndoxzpzdqrevb`:

1. `--plan`: read-only exact project/org, closed Auth, unchanged quota2, RLS, flags, no real sporting data, no delivery and protected owner checks.
2. `--migrate`: requires exactly nine prior migrations and exactly the two reviewed Phase4.5 files. Saves an exclusive private application/schema preimage, checks the linked project, performs CLI dry-run and then applies with `--skip-vault`. This preimage is not asserted to be a full Auth/storage disaster-recovery backup.
3. `--prepare-invitations`: preserves the owner profile, Auth/password, consent and credential file; adds only a new capability grant ending at the current grant's expiry. Creates four invitations, no Auth users. The browser runner creates two disposable QA accounts and two clearly labelled DEMO seed accounts using the actual app signup flow.
4. `--revoke-qa-a`: after the initial browser flow releases QA A, revokes only that exact disposable account's grants while retaining its Auth identity for a genuine login followed by API-denial verification. Owner and seed grants are untouched.
5. `--cleanup --qa-released`: after all consumers release QA, independently binds each exact reserved email to its invitation provenance, erases only the two disposable accounts, revokes seed sessions and redacts new private credentials. The owner's credential file and legal choices are preserved.

`--prepare-social-taxonomy` is a separate narrow setup mode. It inserts only missing `football` / `Football` and `basketball` / `Basketball` taxonomy rows with `enabled=false`, preserves existing rows, and records pre/post checks. These labels support explicitly labelled demo social posts; they create no events, markets or provider activation.

Secrets and journals are confined to ignored `private-data/phase45-beta`; public receipts under `docs/qa/phase45/operator` contain only safe counts, checks and timestamps. Prior QA journals are never reused. Fixture invitations are server-marked `fixture=true`; their Auth metadata and consent version explicitly identify synthetic tests, and they never enter acquisition analytics. Retained seed profiles/posts must be visibly DEMO/PREVIEW and must not claim actual sporting performance.

Before running, use the already reviewed private environment loader to supply the exact existing connection and canonical HTTPS SITE_URL. Do not print environment files or secret values. A failed/partial exclusive journal requires review before any retry. Migration recovery uses the protected preimage and a forward repair; it never drops populated ledgers.

Hosted execution and actual acceptance results are recorded separately in the QA receipts; local passing tests alone are not hosted acceptance.
