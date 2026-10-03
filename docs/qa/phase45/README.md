# Phase 4.5 — Android invited beta acceptance

Execution record, 3 October 2026. The isolated web Preview and installable v5 APK are built and verified. Physical v5 acceptance, upload signing and Play/legal approvals remain owner actions.

## Scope and identity

Continued the clean `codex/docked-value-platform` branch from `80f2ed5`. Existing v4 physical operation on the owner's Samsung S24 is confirmed by the owner. Physical v5 acceptance must be performed on the device; browser emulation does not establish force-close, keyboard, native camera/share or Android lifecycle success.

Only `https://docked-preview-s24-briant-ginty.vercel.app` and Docked Preview Supabase `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, are in scope. Production, docked.com.au DNS and Oura are untouched. No purchases, external email or Play uploads were performed. Odds/results remain `NOT_CONFIGURED`; strategy remains `UNVALIDATED`; forward paper, live publication, billing, prizes and affiliates remain off.

## Implemented

- Canonical D: byte-exact `public/brand/icons/docked-app-icon-1024.png`, copied to `public/brand/canonical/docked-master.png`; SHA-256 `aa8f37eec82cef4974f5d1e5561591c2f620404c0218a1f0ffaf3cd9aefa180f`. Shared `BrandLogo`, native splash, auth, metadata/social and browser/PWA surfaces use this source. Functional icons and palette are preserved. [Asset provenance](../../MASTER_LOGO.md).
- `/app` resolves the authenticated session to `/edges` or dedicated app account screens. Login, signup, recovery, verification/error states and short onboarding have no marketing navigation. Public web entry remains available separately.
- Supabase email/password identity, public username, required age/terms/privacy and separate unticked marketing. Invitations confirm test access, **not email ownership**. Sports/interests/in-app notification choices persist; push is not configured and no premature Android permission is requested.
- Exact-project, expiring Preview capabilities are checked server-side and in the database. Admin grant/revoke/invitation controls preserve staff MFA and auditor read-only restrictions. Normal members cannot self-grant access. No ordinary regional approval was added. [Operator and owner guide](../../PHASE45_PREVIEW_ACCESS.md).
- Isolated DEMO / PREVIEW PRICE review and immutable submission records use reference-price calculations but cannot enter real ledgers, rankings, performance, public SEO or production. Own-account export includes these records, including after test access revocation; erasure removes their identifiable ownership. [Fixture isolation](../../PREVIEW_MARKET_FIXTURES.md).
- Five evergreen learning articles, clearly labelled seed-content definitions, a distinct source-controlled Weekend Watchlist type and compact useful empty states. No current watchlist events were invented; approved factual sources are still required. [Content inventory](../../PREVIEW_COMMUNITY_CONTENT.md).
- Preview Top Docked explains the accounting boundary and displays no invented ranks, points, settlements or ROI. Existing unsupported Points metrics remain unavailable.

## Findings and validation

The full local platform suite passed **209/209**; the full PostgreSQL/RLS suite passed **96/96**, with an additional passing own-export regression added afterward (97 distinct database cases). Full-suite logs are private; hashes and counts are in [full-validation.json](full-validation.json). The final production build passed, including TypeScript. Dependency audit reported zero vulnerabilities.

The first complete browser run passed **64/67**. Its three failures remain preserved: two Windows line-ending/CSP failures in the offline shell and one stale-background-prefetch timeout. The CSP generator now hashes the same normalised bytes that browsers parse. Two traces reproduced the navigation wait despite a completed, rendered 200 response; readiness now explicitly verifies route, document, main heading, loading completion, fonts and images, retaining status, console, accessibility and overflow checks. Visual inspection also found and fixed wordmark/PREVIEW overlap. All three failing cases now pass; the final presentation suite passed **7/7**. Separate auth hydration and new social hydration suites passed **2/2 each**. [Browser mapping](browser-acceptance.json) preserves intermediate failures and identifies which build each check actually exercised. This is not a claim of a single fully green 67-case run on the final source.

Genuine hosted acceptance found cold-load social controls accepting taps before hydration and an invalid nested paragraph on the authenticated dashboard. Controls now remain disabled until ready, and the dashboard markup is valid. Focused SSR/hydration regressions and the final actual-session run passed. Account export was extended to include only the authenticated member's isolated preview evidence, including after access revocation.

The final hosted run passed real invited signup/onboarding, saved seed posts, comments/replies, reactions, saves, follow/unfollow, mute/unmute, reporting, blocking, fixture review/submission/export and returning login. Ten routes at each of two mobile formats produced **20 screenshots with zero axe, console, page or scope errors**. Separate real-session revocation denied preview reads (403) and reviews (400, `ok:false`) while own-account export remained available. Actual QA-B dashboard deletion succeeded, then independent database inspection confirmed erasure. The [hosted evidence index](hosted/README.md) distinguishes resumed checkpoints, initial failures and final passing runs.

Actual-secret checks compared release artifacts against server/database credentials, the protected S24 password, four new beta passwords/invitation codes and the deployment token, without printing values. **1,979 files / 162,254,549 bytes passed with zero findings or errors**, including the final deployed-source export, browser assets, current QA evidence, artwork and complete extracted v5 APK. This completed before temporary credential copies were redacted. The wider source/test scan found zero real credential matches but flagged fictional test inputs and documented build canaries; its original FAIL result and explicit [fixture review](source-secret-review.json) are retained. No scanner rule was weakened.

Final [cleanup](operator/cleanup.json) and [independent residue review](operator/final-residue-and-seeds.json) passed. Only the owner and two DEMO seed Auth identities remain, with four labelled seed posts and no active seed sessions. QA Auth, profile, session, refresh-token, grants, onboarding, analytics and identifying social residue are absent; newly generated passwords/invitations were redacted. Three permanent synthetic submissions remain pseudonymous (QA-A one, QA-B two from the earlier resumed journey); all source labels and canonical hashes were verified, and none was deleted to force an expected count. Genuine sporting ledgers, delivery, ordinary regional approvals and commercial flags remain empty/off. The owner's credential/profile/consent fingerprints match the pre-run values.

Supabase checks confirm eleven ordered migrations, RLS everywhere required, zero browser grants on private tables and zero browser execution grants on the new preview helpers. Advisor notices remain explicit: intentional private deny-all RLS information, the existing leaked-password protection warning, and informational index opportunities. They were not suppressed through a subscription/configuration change. [Advisor receipt](operator/advisors.json).

## External dependencies and honest limits

- New app recovery/verification callback delivery is not authorised by the existing hosted capture proof. It fails explicitly; no real email is sent. Safe local mail-sink paths and UI/error handling are prepared. Invited signup works without email, with ownership-verification truth retained.
- No upload keystore was supplied. The guarded signed-AAB workflow is prepared and must reject missing or development signing credentials. No upload-ready AAB or Play approval is claimed. [Exact signing steps](../../ANDROID_CLOSED_TEST_BUILD.md).
- Owner must confirm developer identity/account, package choice, signing/backup, privacy/support/deletion contacts, retention, gambling-related classification, adult audience/rating, lawful test territories and a real consenting tester roster. [Listing and Data Safety draft](../../GOOGLE_PLAY_CLOSED_BETA.md), [official-source policy review](../../GOOGLE_PLAY_POLICY_REVIEW.md).
- Prohibited-UGC terms and operational moderation require owner approval and a versioned acceptance rollout. The [community rules draft](../../COMMUNITY_RULES_REVIEW_DRAFT.md) is proposed text, not published/accepted policy or proof of staffing.
- The retained owner's password and consent choices are preserved. On first app onboarding, the owner must make their own age/country/state/terms/privacy choices. Tester entitlement expires at the existing 10 October 2026 06:36:23.296 UTC boundary.

## S24 checklist

1. Install v5 over v4 without uninstalling; verify the blue D and compact PREVIEW header.
2. Test signed-out splash → app login, autofill and keyboard. Sign in using the existing private tester credentials; complete your own required onboarding.
3. Force-close/reopen, background/resume and switch all five tabs. A valid returning session should reach Edges without repeating onboarding.
4. Write a clearly labelled test post, reply/react/save/follow, then test the separately labelled DEMO Edge flow. No real official tips should appear.
5. Test Android back, image selection, sharing, a supported deep link and network loss/recovery. Confirm content stays above the keyboard/system navigation and fixed app tabs.

## Exact v5 delivery

| Field | Verified value |
| --- | --- |
| APK | [Docked-Preview-S24-v5-App-Entry.apk](../../../artifacts/android/Docked-Preview-S24-v5-App-Entry.apk) |
| Windows path | `C:\Users\61412\Documents\ChatGPT\Docked.com.au\artifacts\android\Docked-Preview-S24-v5-App-Entry.apk` |
| Size | 9,597,678 bytes |
| SHA-256 | `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b` |
| Version / versionCode | `1.4-preview` / `5` |
| Package | `au.com.docked.app.preview` |
| Backend / entry | `https://docked-preview-s24-briant-ginty.vercel.app/app` |
| Supabase | `bckkllmndoxzpzdqrevb`, isolated Docked Preview |
| Deployment | `dpl_8Zs6gWmRJC4kL9sUL7WvLRYXXR3y`, READY Preview, source `f1d55a954644b122b57ccbed1b54207194552390` |
| Upgrade | Package and certificate match the actual preserved v4 binary; supports in-place upgrade. Device installation remains untested. |

The build, signature/network-policy checks and every one of the 988 archive entries passed. Debugging, WebView inspection and cleartext are disabled. V3 and v4 APKs remain preserved. [Complete Android receipts](android/README.md). The APK is deliberately Git-ignored, stored outside Gradle outputs and preserved in the local hash archive.

Existing owner sign-in details remain in ignored `private-data/android-preview/tester-credentials.txt`; the password was not reset or placed in this report. Those credentials are for Preview only. The owner must complete their own required onboarding.

## Screenshots and visual review

- [App login](app-auth/login-412.png), [signup](app-auth/signup-412.png).
- [Edges](hosted/2026-10-03T13-28-01-477Z/-edges-412.png), [Feed](hosted/2026-10-03T13-28-01-477Z/-feed-412.png), [Following](hosted/2026-10-03T13-28-01-477Z/-following-412.png), [Points](hosted/2026-10-03T13-28-01-477Z/-points-412.png), [My Edge](hosted/2026-10-03T13-28-01-477Z/-my-edge-412.png), [account dashboard](hosted/2026-10-03T13-28-01-477Z/-dashboard-412.png).
- The same final hosted directory contains ten `360@3x.png` captures, each 1080×2160 pixels, suitable for owner screenshot selection. These are actual Preview UI with visibly labelled test profiles, not fabricated production activity. QA screenshots remain historical evidence after the disposable profiles are erased.
- Final responsive compositions include 360, 390, 412 and 1366 widths; public brand checks include 320px. Root visually inspected the six authenticated captures linked above: compact header, consistent D, navy shell, fixed five-tab navigation and truthful empty states. Browser viewports do not certify native S24 system bars or keyboard behavior.

## Owner actions / remaining dependencies

1. Install the delivered v5 APK over v4 and perform the short S24 checklist above. This is the recommended next step.
2. For Play, supply a separately backed-up upload keystore, alias and passwords privately through `DOCKED_UPLOAD_KEYSTORE`, `DOCKED_UPLOAD_ALIAS`, `DOCKED_UPLOAD_STORE_PASSWORD` and `DOCKED_UPLOAD_KEY_PASSWORD`. Run the guarded preflight/build described in [the signing guide](../../ANDROID_CLOSED_TEST_BUILD.md). Do not use the sideload development key for Play. No signed AAB exists yet.
3. Confirm the Play developer account, identity/profile, package ownership and App Signing. Personally handle any account fee and select the closed test track; nothing was purchased or uploaded.
4. Approve the legal entity, support address, privacy/retention/deletion process, prohibited-UGC rules and operational moderation. Complete the real audience/content-rating/Data Safety answers and lawful test-country selection. This build's no-wager/no-billing state does not establish Play policy eligibility; review actionable Edge functionality and gambling-related policies before submission.
5. Supply real consenting Google tester addresses/group and corresponding expiring Docked invitations. Google opt-in and app invitations are separate gates. Keep reviewer credentials private and monitor entitlement expiry.
6. Supply verified email delivery/callback authority only when ready to enable real verification/recovery; current invited testing does not establish email ownership. Authorised factual Watchlist sources, provider/results/history contracts and strategy validation remain separate future work.

## Requested handoff index

| Item | Outcome / evidence |
| --- | --- |
| 1. Branch | `codex/docked-value-platform` |
| 2. Commits | Implementation commits below; operator, QA and delivery documentation committed separately. |
| 3. Logo | Exact blue master D reused; white-frame/wordmark corrections; [provenance](../../MASTER_LOGO.md). |
| 4. Android auth | App entry/session routing and compact account states implemented; invited real-session testing passed; delivery of verification/recovery email remains blocked. |
| 5. Onboarding | Required personal/legal choices plus short preferences flow; returning login skips completed onboarding. |
| 6. Preview Tester | Exact-project, expiring, scoped grants/invitations; admin/MFA/audit/revocation; no production or regional approval override. |
| 7. Posting | Genuine posts and social lifecycle passed; two labelled seed profiles retained, QA identities erased. |
| 8. Community Edge preview | Isolated immutable DEMO prices tested through real UI/export/deletion; never real performance. |
| 9. Content | Five new evergreen articles and four labelled seed posts; [inventory](../../PREVIEW_COMMUNITY_CONTENT.md). |
| 10. Watchlist | Source-controlled architecture and empty state ready; no approved current-event items. |
| 11. Mobile UX | App auth shell, compact pending state, safe cold-load interactions and existing five-tab app retained. |
| 12. v5 APK | Built; exact identity above; physical v5 pending. |
| 13. AAB | Not built: upload key inputs missing; guard tested. |
| 14. Play readiness | Listing, artwork, screenshot set, signing workflow and declaration inventory prepared; no Console submission. |
| 15. Policy findings | [Official-source review](../../GOOGLE_PLAY_POLICY_REVIEW.md); owner eligibility/territory/UGC/Data Safety decisions required. |
| 16. Tests | Counts, failures, repairs and actual hosted/security evidence above. |
| 17. Screenshots | Links above and complete hosted index. |
| 18. Blockers | Physical v5 acceptance; upload signing; Play/legal/support/moderation decisions; safe email delivery; actual data services. |
| 19. Owner actions | Exact six-step list above. |
| 20. Next step | Install v5 over v4, sign in with retained private credentials and test the actual S24 lifecycle. |

## Source and commit record

Implementation commits: `a4473a2` (beta foundation), `d5023b5` (wordmark/fixture QA), `cb9fe54` (compact pending state), `944499f` (own export/privacy), `9877443` (offline/readiness), `2e1d33a` (composer readiness), `f1d55a9` (shared social hydration/dashboard markup), `91cff1c` (guarded acceptance/cleanup tooling and owner readiness). Only the final product source was deployed. Final evidence commits do not alter the running product.

The exact inventory since base `80f2ed5` is in [changed-files.txt](changed-files.txt). Private credentials, signing material, browser storage/traces and APK binaries are excluded from Git. Cleanup evidence is under [operator](operator/); final handoff records the repository commit and clean-tree check.
