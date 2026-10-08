# Docked live-beta acceptance — 9 October 2026

**NOT LAUNCHED.** The latest owner request authorizes controlled beta deployment/testing, resolving the earlier support-only email test-window approval request. Mandatory policy, hosted authentication and gameplay gates remain incomplete, so the holding page remains as instructed. Continued from `68af14a8` on `pivot/fantasy-cards-preview-v1`, preserving the original master-prompt implementation.

## Completed here

- Added `--live-beta` production preparation. It retains all existing identity/policy/email/RLS/concurrency gates, additionally requiring invited-Auth acceptance, beta record isolation and administrator MFA. Public registration is always false. Actual preparation correctly refused the unapproved configuration; nothing was uploaded.
- Runtime configuration, signup API and UI independently reject public signup in beta. Added BETA labels, invitation-only homepage wording and no-index metadata without altering Preview authority.
- Prepared separate Android beta package `au.com.docked.app.beta`, planned version `1.8-beta`, build 9, at the exact HTTPS apex `/app`. It preserves the installed Preview identity, uses supplied Fantasy branding and existing signing infrastructure, and disables cleartext/WebView debugging. This is a sideload path, not a Play release.
- Android packaging requires a recent actual hosted acceptance receipt and a fresh no-cache live deployment probe matching exact deployment, commit, site, production project and closed public registration. The new `/api/beta-release` route returns public provenance only; it does not claim tests have passed.
- Debug builds reject stale hosted assets, preventing production assets from being installed under the Preview app ID. No receipt was fabricated, no secret/certificate generated and no APK distributed.

## Actual results

| Check | Result and scope |
| --- | --- |
| Full platform regression | PASS — 426 tests |
| Final Android/branding subset | PASS — 9 tests after final branding adjustment |
| Focused browser regression | PASS — 11 tests, local Chromium/Auth fixtures; beta label at 320/412/1366 pixels |
| TypeScript and changed-file ESLint | PASS after fixing a nullable test assertion |
| Optimized Next build | PASS — isolated source export without cloud credentials |
| Client/server secret scan | PASS — 54 client assets, 101 server traces, zero secret matches/private trace entries |
| Changed-source scan | PASS after review — zero actual production-secret matches; seven pre-existing synthetic fixture patterns match the committed baseline, retained in raw findings and triage |
| Supabase security advisor | PASS — exact production project; no warning/error issues |
| Production readback | PASS — mail ACL/RLS, closed signup, verification required, scheduler disabled, prior receipt still one dispatch |
| Production environment preparation | BLOCKED as designed by actual policy/readiness flags |
| Android Beta Gradle dry-run | BLOCKED as designed at actual-host acceptance/assets check; no APK built |
| Hosted Auth and gameplay acceptance | NOT RUN — protected application staging unavailable |
| Native Android/iPhone | NOT RUN — ADB has no connected device; browser emulation is not device testing |

Previous unchanged database/email code retains its prior 206 database tests and seven actual local PostgreSQL scheduler scenarios. They were not rerun or relabeled as current production acceptance. Original Preview delivery had real three-user/social tests in Preview, not this production database.

One existing Astra High reviewer performed bounded read-only review without edits, cloud access, secrets access or delegation. The main agent fixed stale Android asset contamination and stale live-deployment receipt findings. Review caught an overly broad Debug task selector; it now uses exact `preDebugBuild`, excluding native symbol tasks. Real Gradle dry-run exposed an absent dependency fallback; corrected to the existing debug-library fallback, then verified the task graph reaches the intended beta acceptance guard. No Ultra review.

Evidence: [preflight](qa/live-beta/preflight.json), [build scan](qa/live-beta/build-security.json), [source-scan triage](qa/live-beta/secret-scan-triage.json), [production readback](qa/fantasy-production/hosted-mail-scheduler-security.json). Visually inspected screenshots are labeled authored fixtures: [mobile](qa/live-beta/ISOLATED-live-beta-412.png), [desktop](qa/live-beta/ISOLATED-live-beta-1366.png).

## Live resources

- https://docked.com.au: HTTPS 200, existing holding page, **not playable Beta**.
- https://www.docked.com.au: HTTPS 301 to apex. DNS/mail records unchanged.
- https://docked-production.netlify.app: 404, no deployed application. Existing Netlify Free site `2292ba6e-7073-4804-b69a-26b41c9a9fb1`; no website deployment ID exists for this work.
- Supabase organization `otldyeunbqabbcjydjpe`, project `pojoymtniryarxxunyvz`: current readback has **zero Auth users, sessions and cards**. No working production administrator is claimed.
- Email function `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, version 5, remains disabled. Scheduler disabled; pg_cron/pg_net available but not installed. No cloud configuration changed in this checkpoint.
- Existing certificate-based Graph diagnostic received 202 and owner-confirmed Inbox delivery previously. No repeat email was sent. The old four-second response timing remains historically uncertain; the queue removes Graph from synchronous Auth response and holds ambiguous sends rather than retrying blindly. Complete hosted invitation/recovery/failure journeys remain unverified.
- Oura, Preview and unrelated Vercel were not accessed or modified. No new paid services, Microsoft grants, certificates, payments or betting-model activation. Owner-confirmed costs remain Supabase US$25/month before tax and Netlify Free; current invoice/usage totals were not independently audited.

## Feature audit

| Feature | Existing code and current limitation |
| --- | --- |
| Edges, My Edge, statistics | Preserved research screens/records; unvalidated official betting publication remains off. Production acceptance pending. |
| Feed, Following, profiles, comments, likes, follows | Existing shared server implementation with prior Preview social tests; production identity, moderation and persistence tests pending. |
| Points | Community, championship and daily gameplay points remain distinct. No production balances/rankings seeded or claimed verified. |
| Cards, packs, teams, ownership | Existing finite supply, atomic/idempotent issuance, provenance, lineup locks and fair scoring. Approved production catalogue/onboarding initialization and hosted tests pending. |
| Rewards | Approved 11-card Starter, 10 daily gameplay points, controlled card reward every seven successful claims; stock constraints remain. No production cards issued. |
| Leaderboards | Preview results exist. Production projection currently returns the signed-in member's results; shared production leaderboard behavior and durable beta/official separation require completion and acceptance. |
| Marketplace/trades | Preserved implementation, production transactions disabled. No cash or paid packs. |
| NFL | Updated 9 October: owner scope supplied; 32-team catalogue, shared filters, own-post browsing and strict parser checks added. Local tests pass; live feed and hosted persistence remain unverified. Advanced fantasy is optional. See `DOCKED-NFL-BETA-ACCEPTANCE.md`. |

## Exact blockers and next steps

1. **Owner/policy:** review `FANTASY-PRODUCTION-POLICY-DRAFT.md` and beta addendum. Confirm approved country/state scope, support/privacy/moderation responsibility, Terms/Privacy/community/reward versions and retention/provider disclosures. Current policy approval is false and versions blank. Company/ABN/support/private address already supplied; do not repeat or publish the street address.
2. **Owner account:** confirm intended administrator login email. After verified invitation, enroll the owner's authenticator before granting usable administrative access. Do not use an agent-controlled MFA factor. Provide exact friend emails before extending the support-only recipient list.
3. **Technical continuation:** deploy restricted staging to the existing Netlify site; configure existing-secret Vault/scheduling with verified ACLs; connect support-only Auth; test invitation, confirmation, recovery, actual expiry/replay and email-failure reconciliation. The current request authorizes this work—no repeat test-window approval is needed. Do not send broken links to the current 404 staging site.
4. **Gameplay:** initialize legitimate approved beta inventory, complete durable beta-era/ranking separation and shared leaderboard behavior, then test real multi-user persistence, scarcity, concurrency and cross-device synchronization. BETA UI labels/config flags do not prove record isolation.
5. **Promotion/APK:** after mandatory checks, deploy/promote, preserve rollback/email DNS and verify public HTTPS/login/rewards. Write an actual Android acceptance receipt and run `npm run android:live-beta`. Expected future output is `artifacts/android/Docked-Live-Beta-S24-v9.apk`; **not produced or delivered yet**. Audit signature/hash and test native use on an authorized device.

Friend access after activation: keep Supabase public signup disabled. The authorized operator maintains the protected exact recipient list and issues invitations through the dedicated production Auth administrator interface. Each user confirms email, sets a password and explicitly completes policy/profile setup. No shared credentials or imported Preview accounts.

APK installation after verification: transfer the APK, permit installation from the chosen browser/file app when Android prompts, install Docked Beta and sign in with the same invited website account. No build hash or native success is claimed until an artifact exists and is tested.

Deployment authorization is present; mandatory acceptance is not. Safe work and evidence are committed for continuation.
