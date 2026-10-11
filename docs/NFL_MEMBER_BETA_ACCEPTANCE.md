# NFL playable member beta — 11 October 2026

This supersedes the implementation gaps in NFL_HOSTED_POSTGAME_ACCEPTANCE.md. The owner explicitly approved NFL-first external release; EPL is independent and unavailable, not a release-scope decision awaiting approval.

The later low-cost steer is incorporated in [FREE_BETA_SERVICE_FACTS](FREE_BETA_SERVICE_FACTS.md): existing Exchange hosting is corroborated by current MX and successful application authentication/delivery; the specific administrator identity is unknown. No new business account or paid Purview is required. Use the existing email administration account/portal, not an assumed mailbox login. This clarifies the Microsoft action below.

## Hosted operation

Exact Docked Supabase `pojoymtniryarxxunyvz`, isolated beta tables only. 498 ACT-status QB/RB/WR/TE records from separately downloaded nflverse season rosters now have GSIS identities and new beta CORE editions. Current team/status is a refreshable projection; original edition team remains separate. Missing weekly statistics are not DNP evidence. No photos, league/team logos or paid collectible rights are inferred.

Each member's first free claim atomically allocates ten current, mapped cards (2 QB, 3 RB, 3 WR, 2 TE), enough for QB/2RB/2WR/TE/FLEX seven. The eleven-copy beta cap accommodates ten testers plus owner. It does not touch permanent commercial editions/caps. Existing fictional holdings, serials, provenance and history remain intact; the allocation audit records both preserved and newly granted IDs. The accepted owner received ten real NFL beta cards. Twelve concurrent repeat claims returned the same ten, with no extra issuance. Ordinary-member claims remain admission-gated.

The genuine future competition is **NFL Week 6**, fourteen mapped fixtures. Whole-round lock: **Friday 16 October 2026, 11:15 am Australia/Sydney** (`2026-10-16T00:15:00Z`). Week 5 was already underway and was not opened. Source: nflverse `nfldata/data/games.csv`, cross-checked against NFL Week 6 schedule. Stable mapping and 72-hour roster freshness are required. QB/positions/ownership/unique players/deadline are checked in SQL, not only the field UI.

The DB freezes pre-deadline entries; a delayed collector cannot alter them. Collected player breakdowns, team points and shared-rank standings are read through checked member functions. Cards remain transfer-locked while their round is unresolved. Reviewed finalisation releases that commitment; historical lineup/player scoring snapshots remain independent of subsequent card transfers. No rarity or paid multiplier.

## Collection and operations

Dedicated JWT-protected `nfl-postgame` Edge Function, plus independent server-only token. Least-privilege database role cannot read holdings/allocation identities, issue cards or alter locked lineups. Journal writers use transaction advisory locks without a broad stream UPDATE grant. Actual-role journal append was tested and rolled back; forbidden reads/writes failed.

Active UTC schedules: weekly `5 0,12 * * *`; PBP `10 0,12 * * *`; rosters `15 0,12 * * *`; reconcile every fifteen minutes; deadline lock every minute. Round reconciliation has a six-hour cooldown; dataset fetches have independent twelve-hour caching/conditional requests and bounded retry. The existing hourly raw expiry task remains active. Selected raw payloads expire after thirty days; separate source hashes, revisions and provenance remain. First scheduled reconciliation received HTTP 200. Endpoint checks passed JWT/token denials and all four tasks; source tasks reused the fresh cache. A fresh unattended bulk download and an actual upcoming completed member round have not yet been observed.

Completion is explicit PBP game-end evidence. Store the first time Docked observes it; wait six hours from that observation, not a fabricated final-whistle time. Status is awaiting results, provisional or final. Ambiguous/missing statistics stay pending. Late corrections require review; source outage does not replace scores with zero. `sports_feed.nfl_worker_runs`, `nfl_rounds.issues/last_checked/next_check`, source caches and pg_cron/net responses provide private operational health. No external notifications are sent.

New rounds require an operator schedule review and `npx tsx scripts/nfl-member-prepare.ts`; it chooses the next complete future round and never opens a begun full round. Existing identity is idempotent; review postponed/rescheduled fixtures before accepting a replacement mapping. No silent rewrite of a locked fixture set. The source permit expires **10 November 2026**, then fetches fail closed pending review; this is not a new paid service.

Finalisation: `npx tsx scripts/nfl-finalise.mjs beta-real:nfl:2026:6 "Document the completed source/correction review"`. Requires existing owner MFA session and operator connection; the engine requires all selected-player results plus every fixture completed and the 96-hour correction window elapsed. No prizes/balance credits. No actual round was finalised during this work. Corrections remain append-only; late conflicts are visible for explicit reviewer reconciliation using `reconcileNflBundle` with a reason.

Attribution: nflverse contributors, https://github.com/nflverse/nflverse-data and CC BY 4.0, with Docked normalisation/scoring modification notice, are retained on results. Published licence is accurately recorded; the narrow unsent upstream-field question is in NFL_HOSTED_POSTGAME_ACCEPTANCE.md. No blanket prohibition or licence to unrelated commercial imagery is claimed.

## Evidence and honest boundaries

- Hosted two-user rollback-only SQL acceptance: actual AAL1 admissions, independent card grants, valid saved teams, deadline lock, actual historical totals of 71.24 each, tied standings, synthetic +0.04 correction, cross-user/late-write rejection. All QA identities/holdings/competitions rolled back; fingerprints unchanged. This is not two browser logins or genuine retrospectively entered member results.
- Genuine Week 6 exists and accepts valid member teams through the same backend. No genuine member results yet; do not mix historical acceptance into those standings.
- Local mobile interaction test: seven slots/FLEX, replacement/search, save response, list view, honest empty points, EPL unavailable, no horizontal overflow or axe violations. Save is mocked in this browser test; hosted persistence is established separately above.
- Actual owner read model rendered at 360/1440 px for Play/Cards/Market/Profile; screenshots under `docs/qa/nfl-member`. The selected-team S24-size screenshot uses the local interaction fixture and is labelled accordingly. Physical S24 and owner visual approval remain pending.
- External friends access remains closed. Microsoft support-mailbox/provider retention evidence is not yet verified. Accepted support operator/process, retention schedule and all-current eligibility are not reopened.

## Remaining owner actions

1. Sign in to **https://admin.microsoft.com** with the Docked **work administrator**, choosing Use another account if a personal Hotmail account appears. The observed tab is a personal Microsoft terms page, not usable admin evidence. Complete any terms/MFA yourself and leave the admin centre open. Settings → Org settings → Organization profile → Data location → Commitments supplies at-rest evidence only. Exchange/Purview mailbox/organisation holds and retention, export/deletion roles and host backup/log expiry must also be checked before absolute policy promises. Existing read-only `scripts/microsoft-privacy-evidence.ps1` works from an authorised connected Exchange session; no tenant settings are changed.
2. Supply and authorise up to ten tester email recipients when ready. No invitations have been sent. NFL-first scope is already approved; no repeat approval requested.
3. Review the updated APK on the physical S24: update without uninstalling, existing login/session, seven-slot team save, app reopen, keyboard/Back, five tabs, points pending and EPL unavailable. Owner login acceptance is preserved; no password or MFA setup change.

Optional EPL work: follow API_FOOTBALL_ACTIVATION.md to configure the free-account key server-side. No current-season/field completeness assumed; no subscription purchased. This is not an NFL release prerequisite.

## Release / recovery

### Final protected delivery

- Web: https://docked-production-ma0j6h6we-briant-s-projects.vercel.app/fantasy/play
- Deployment: `dpl_2hC7cKyP7cAChXqLfxovhPzQkhhK`; committed web source `5ffa6eaa7eca444e3fd1df2f3cb1d82fae281fa5`. Protected Preview; not the public domain.
- APK: `artifacts/android/Docked-v16-NFL-Owner-Connected-QA.apk`, versionCode 16 / versionName 1.15-preview. Exact hash/size/signature in `qa/nfl-member/apk-details.json`; embedded origin in `apk-audit.json`. Local file has no scheduled download expiry; hosted availability/session access remains required. No hosting bypass or privileged credentials are embedded.
- Install: copy the APK to the S24 Downloads folder, open it and choose **Update**. Permit installation from the chosen file source if Android asks. Do not uninstall Docked or clear its data. Existing package/signing match v15; a later installed version or a different signing channel must be checked instead of uninstalling to force it. This build still requires owner access to the protected deployment; do not distribute it as a friends-ready APK.
- Automated checks: final typecheck/lint/build; 252 platform and 148 database/RLS tests; browser suite 36 initial passes plus all three repaired stale-copy cases passed on rerun, separate NFL interaction/accessibility acceptance passed; hosted two-user rollback SQL and HTTP denials passed. No physical-device pass.
- Added final swap review: archived fictional holdings are excluded from the NFL swap selector, legacy extra-pack/balance controls are rejected; real swaps are free in friends mode. Two-user hosted offer/cancel/accept/idempotent repeat/stale competing offer and locked-lineup denial passed. Ownership events remain auditable; all QA changes rolled back.
- No friends invited, external admission remains off, holding page unchanged. No payments/prizes/withdrawals/KYC collection. EPL unavailable.

Owner review: (1) identify/sign into the **existing** email administration account/portal described in FREE_BETA_SERVICE_FACTS, without buying anything; (2) review Play/selection/points screenshots and update S24, checking login/reopen, save, Back/keyboard and five tabs; (3) supply and authorise tester emails when ready. No repeat approval for NFL-first scope, support operator, retention intent or all-current-player eligibility is requested.

For a web rollback, previous compatible Preview is `dpl_BgcDXRpkrMMA3hDt2fmvjQCcM56S` at `https://docked-production-2mrjjbm8f-briant-s-projects.vercel.app` (a4a9e89d). The additive swap guard remains safe with it. Earlier APKs are preserved; do not force an Android downgrade. Current final receipts may be committed after the web-source commit; receipt-only commits do not require another web deployment.

Do not describe protected hosted QA as a friends-ready domain release. Once shared facts and checks pass, use existing domain authorisation; keep invite-only application admission and no hosting bypass in APK. Current protected deployment/APK identifiers are in the final delivery receipt appended below.

Rollback uses the preceding protected web deployment and preserved APK. For collector incidents, unschedule only the five named NFL jobs and revoke/rotate its dedicated token/role; keep immutable evidence, cards, grants and locked snapshots. Disable `sports_feed.nfl_control` only as a deliberate operator rollback (it restores the old read path). Never drop beta tables or restore a whole database over new holdings. Production holding page remains untouched while external checks are blocked.
