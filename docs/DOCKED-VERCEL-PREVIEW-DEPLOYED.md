# Protected Vercel Preview — 9 October 2026

The Vercel access/branch deployment blocker is resolved. This deployment is **protected UI review only**, not a playable beta or public release. Successful account and persisted gameplay acceptance remain blocked.

## Verified deployment

| Item | Actual result |
| --- | --- |
| Preview | https://docked-production-dxscf1vyc-briant-s-projects.vercel.app |
| Deployment ID | `dpl_9jGArtd1RjBYxiGCffDupBWTPuos` |
| Application commit | `2c9a995753d0992e100968976db82aa8b612793c` |
| Branch / repository | `codex/vercel-beta-review` / `https://github.com/bginty/docked.git` |
| Project | `docked-production` / `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST` |
| Team | `team_tf6xweKKyVCj9bTppUKttJ4l` |
| State | `READY` |
| Request | CLI 62.2.0, explicit `deploy . --target preview --project … --scope …` |
| Raw API target | `null`, the built-in Preview representation; it did **not** return the literal string `preview` |
| Independent environment evidence | CLI labels Preview; hosted guard passed with `VERCEL_ENV=preview`, exact project/branch/commit, no custom-environment match |
| Protection | Vercel Authentication retained; anonymous request redirects to authentication (302) |
| Production domain aliases | None |

Open the Preview while signed into the authorized Vercel account. No public share link or permanent protection bypass was created. Automation used short-lived, origin-scoped Vercel authentication.

Authenticated exact-project settings confirm `link.productionBranch=main`, `bginty/docked`, and protection `all_except_custom_domains`. The review branch has no custom environment. The project has only its default `docked-production.vercel.app` hostname, no custom domains; that hostname does not establish a promoted production app.

The local HTTP 403 was caused by an expired OAuth access token (`invalidToken: true`). A supported CLI project inspection automatically refreshed the existing session; the subsequent exact-project API read returned 200. No credential value was printed, manually replaced or committed. No new permission/account was required.

## Changes

- Preserved local `pivot/fantasy-cards-preview-v1` and all previous commits. Pending `93fdf921` is included in the deployed application.
- `0a0133ba` disables automatic Git-triggered builds only for `codex/vercel-beta-review`. Other branches retain their behavior. Explicit CLI Preview deployments used a clean isolated source checkout with genuine Git branch/remote/SHA; no fabricated system identity.
- Initial Preview `dpl_NGSZt7RhvgYCVQ1Px5dajiDSGowG` exposed a real origin-check defect: redirects used the derived Preview origin but mutation checks used localhost. `2c9a9957` fixes the shared check to use the validated configured origin and reject foreign origins or invalid settings.
- Earlier Production-target deployment `dpl_Fs32KgbJcaecDJyj53cy4exGDrtL` was never resumed.

## Actual verification

| Check | Result and scope |
| --- | --- |
| Platform regressions | **PASS — 437 tests**, zero failures, local automated suite |
| TypeScript / changed-source lint | **PASS** |
| Hosted build | **PASS** — Preview identity guard, compilation, TypeScript, 48 generated pages |
| Hosted acceptance | **PASS — 32 checks** on the repaired deployment |
| Layout | **PASS — 12 hosted page/viewport checks**: home, app/login redirect, web login, app signup at 320/412/1366px; no overflow or uncaught page errors |
| Protection / headers | **PASS** — anonymous access restricted; authenticated HTTPS has HSTS, CSP, frame denial and nosniff |
| Auth denial | **PASS, denial only** — signup/login/recovery/resend/reset/MFA return 503; foreign origin 403 |
| Invitation / session denial | **PASS** — unavailable 503, no successful identity/session claimed |
| Callback errors | **PASS, synthetic inputs only** — invalid/expired inputs redirect to this deployment's link-expired page; no real token exchange |
| Fantasy / admin / social | **PASS, denial only** — protected operations denied; community returns empty `not_configured` state, not fake users/posts |
| Android release gate | **PASS** — `/api/beta-release` returns 404; cannot authorize APK |
| Real account / MFA / email journeys | **BLOCKED / NOT RUN** on this Preview |
| Persisted rewards / ownership / concurrency / cross-user gameplay | **BLOCKED / NOT RUN** on this Preview |
| Native Android / iPhone | **NOT RUN** — browser viewport emulation only |

The initial hosted run found six Auth origin failures and one incorrect community-test expectation. Findings are preserved. The origin defect was fixed and deployed; the community test now verifies its documented empty/unconfigured response. All final checks pass. Denial checks are not substitutes for positive Auth/gameplay acceptance.

Evidence: [deployment identity and domains](qa/vercel-review/verified-preview-deployment.json), [final hosted results](qa/vercel-review/hosted-acceptance.json), [initial findings](qa/vercel-review/hosted-initial-findings.json), [hosted desktop](qa/vercel-review/HOSTED-home-1366.png), [hosted mobile](qa/vercel-review/HOSTED-app-412.png).

Repeatable harness: `scripts/verify-hosted-review.mjs`. Use the existing authorized `vercel env run --environment development --project <approved-project> --scope <approved-team>` session followed by `node scripts/verify-hosted-review.mjs <exact-preview-url> <deployment-id> <commit>`. Its short-lived token header is confined to the exact origin and never printed. No new mail is sent.

## Remaining prerequisites for a playable beta

This profile intentionally has no database/Supabase/Graph/provider credentials. All 26 existing settings remain scoped to Preview and this branch; hidden Production variable count is zero. Runtime reports database/feed/publication false. No account or email was created.

1. **Owner decisions:** review/approve or amend the [policy draft](FANTASY-PRODUCTION-POLICY-DRAFT.md), specify eligible beta states/territories and age rules, and confirm support/privacy/moderation responsibility. Nominate the individually controlled administrator email and approved invited recipients/cap. Do not infer admin identity from hosting or shared-mailbox details. Current test-email authorization is support@docked.com.au only. Complete real administrator MFA enrollment when invited.
2. **Technical staging work:** after applicable approvals, bind a separately reviewed production-connected staging profile to an exact protected Vercel origin/branch and dedicated Supabase `pojoymtniryarxxunyvz`. Current production staging/Auth callback assumptions still require Vercel-specific adaptation. Do not put production credentials into the credential-free profile or weaken its guard. Production manifest stays `approved: false`.
3. **Real acceptance:** run invitation, confirmation, recovery, expired links, MFA and failure recovery in a controlled email window. Test approved finite inventory, starter/daily/seventh-claim rewards, ownership, real PostgreSQL concurrency and cross-user isolation. Prior owner-Inbox-confirmed Graph diagnostic delivery is historical evidence, not new Auth acceptance. Other-mailbox negative authorization remains untested.
4. **Android:** no new APK because hosted Auth/gameplay acceptance has not passed. Current release receipts require the verified live domain; protected Preview APK support requires exact-host/protection-session handling and genuine accepted backend evidence. Do not reuse the earlier APK or fabricate receipts.

No additional feature development or NFL/provider activation occurred in this deployment-focused continuation. Existing NFL foundations remain preserved; unavailable feeds/models are not certified launch-ready.

## Preservation

Fresh public HTTP: docked.com.au 200 with the existing Docked page; www 301 to the apex. No DNS, custom domains, holding-page source, production approval, public signup or payments changed. No access to or modification of Oura or existing Docked Preview. No Microsoft grants/certificates, paid plans, database migrations or unrelated Vercel changes. No model switch or new Ultra audit claimed.
