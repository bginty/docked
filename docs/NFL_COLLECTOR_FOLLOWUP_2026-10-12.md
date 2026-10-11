# NFL collector follow-up — 12 October 2026

## Current result

**First unattended source cycle: FAIL / REVIEW_REQUIRED.** The single 23:20 Sydney follow-up was executed late, at approximately 06:37–06:46 Sydney on 12 October. It did not force a download, reset cooldowns, alter schedules or create another automation.

The newer v20 friends release was already deployed. It remains live at https://docked.com.au/app/login, app commit `885de1b440d670b539f1577590f4e601ab2f469c`, Vercel deployment `dpl_FCT6gGG2ZSou1YKh3K1UKiEhb2AR`. Work continued from `e2c7ca2c`, preserving v20 rather than repeating the older v17 cutover instructions.

## Scheduled evidence

| 11 October Sydney | Task | SQL cron submission | Authenticated worker | Source refresh |
|---|---|---|---|---|
| 23:05 | weekly statistics | succeeded | failed, HTTP 503 | none |
| 23:10 | play-by-play | succeeded | failed, HTTP 503 | none |
| 23:15 | rosters | succeeded | failed, HTTP 503 | none |

Supabase function invocation logs recorded 503 at 12:05:02.002, 12:10:02.473 and 12:15:02.208 UTC. Corresponding private worker rows recorded `SOURCE_OR_CONFIGURATION_UNAVAILABLE`. Source cache errors are `SOURCE_UNAVAILABLE_OR_SCHEMA_CHANGED`. Earlier code discarded the underlying exception, so the original failures cannot be conclusively attributed to one cause after the fact. SQL cron success proves submission, not a successful download.

The retained weekly/PBP/roster revisions are still 1/2/3. All three body hashes were independently recomputed and match. At 06:43 Sydney they were about 20 hours old, within the 24-hour freshness limit; they were **not refreshed** by the failed cycle. Their existing 30-day raw-retention expiry remains intact. Do not confuse retention with freshness. Details: `qa/friends-cutover/collector-observation.json` and `collector-retention-review.json`.

## Repair completed

Reproduced an actual runtime compatibility defect offline: `fetchNflDataset` failed at `Buffer.concat` when Node's global Buffer was absent. Deno application code requires an explicit `node:buffer` import (https://docs.deno.com/runtime/fundamentals/node/). Both source download modules now import it explicitly. This is a demonstrated defect and plausible explanation, not retrospective proof of the discarded hosted exception.

Added bounded private failure stage/codes (retention, fetch, persistence, completion; recognised HTTP/type/timeout/permission failures). Raw exception text, URLs, credentials and source payloads are not added to logs. Failed authenticated HTTP responses now carry validated task/season so the observer can correlate them. Unknown errors remain UNCLASSIFIED rather than exposing their text. Cooldowns, parser limits, rights gates, missing-data abstention and database privileges are unchanged.

Deployed **only** `nfl-postgame`, version **12**, JWT verification **true**, to Docked project `pojoymtniryarxxunyvz`. Provider bundle SHA-256: `9e7359d3e3944b84147c16309b8eab2fdf77c6e296ab5e592cc35bc541ed9f98`. Retrieved deployed source confirms explicit Buffer imports and diagnostics. No database migration or application/APK rebuild was needed.

The existing 06:45 Sydney scheduled reconciliation then returned HTTP 200 / idle. This proves hosted runtime, authenticated scheduler and database execution, **not** source collection or a completed member round. Anonymous worker requests return 401. Evidence: `collector-fix-hosted.json` and `collector-fix-delivery.json`.

## Verification

- Typecheck: PASS.
- Full repository lint: PASS.
- Affected NFL/post-game/collector platform suite: 21/21 PASS (includes absent-global regression, scoring/missingness, TD reconciliation, mapping and evidence acceptance).
- Worker build: PASS.
- Changed worker/source/test secret scan: 10 files, zero findings/errors.
- Current custom-domain identity, HTTP/HTTPS/www redirects, callback/recovery boundaries, same-origin checks, private API denials and closed registration: 15/15 PASS. These are anonymous boundary checks; no positive login or email delivery was repeated.
- Existing APK download fetched without authentication and SHA-256 reverified. No new APK or physical-device pass claimed.
- No new full web build, full database suite, authenticated member gameplay or physical-device testing was necessary for this collector-only change; earlier v20 evidence remains separately recorded.

## Remaining scoring acceptance

Next **existing scheduled attempts**: 12 October at **11:05 / 11:10 / 11:15 Sydney** for weekly/PBP/rosters. Persisted cooldown expiry is approximately one to two seconds after those minute boundaries; the worker must honour its lease even if an invocation arrives before expiry. A cooldown outcome is not collection acceptance. No force/retry bypass has been added.

A passing source receipt requires its scheduled task, authenticated HTTP completion, downloaded/304 result, retained matching hash/revision and refreshed cache. If the next cycle fails, inspect the new private `stage` and `diagnostic`; do not infer success from reconciliation idle. The current member round remains unlocked/unscored; observation of a genuine completed member round remains pending. Existing isolated historical scoring acceptance is not a real competitive result.

The owner-approved staged beta does not require unattended scoring acceptance before invited users test login/cards/teams/free swaps. Source-dependent work must retain pending/delayed states when data expires or is unavailable. No final/zero scores may be manufactured. This is a collector readiness failure, not a reason to undo the already-verified free gameplay release.

## Delivery and boundaries

- Web: https://docked.com.au/app/login.
- APK: `artifacts/android/Docked-v20-NFL-Friends-Beta.apk`, v20 / 1.19-beta, package `au.com.docked.app.preview`, existing signature. Private signed delivery link remains in `private-data/friends-cutover/apk-v20-download.json`; expires **18 October 21:45 Sydney**.
- APK SHA-256: `fb42ea45d9170d21660420dee047a09b5813221230fd94ada2e45933fc294006`.
- Install by opening the downloaded APK and choosing **Update**, preserving app data. No owner/Vercel credentials or hosting bypass required.
- Owner visual approval and physical S24 acceptance remain pending. No new owner credentials, sign-in, scope approval or recipient details are required to complete this follow-up. No messages were sent.
- Real payments, prizes, withdrawals and public signup remain disabled. Existing isolated v20 TEST-credit wallet is preserved and is not real money.
- Additional cost: $0. DNS rollback snapshots, email records and historical data unchanged.

## Rollback

This change affects only the collector Edge Function. To revert it, prepare the three `supabase/functions/nfl-postgame` files from `e2c7ca2c` in an isolated checkout and deploy only `nfl-postgame` to `pojoymtniryarxxunyvz` with JWT enabled. That restores previous collector code (including its known compatibility defect); do not reset the working branch, database or web release. The v20 website rollback evidence remains `docs/qa/android-v20/rollback.json`. No domain rollback is indicated.
