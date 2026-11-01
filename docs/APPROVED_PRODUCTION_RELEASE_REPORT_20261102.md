# Approved Production migrations and release gate

2 November 2026, Australia/Sydney. Continue from `78012503`; no model-approval request is outstanding. **The approved migrations are applied. Google public submission and paid activation remain blocked by the specific items below.**

## Production application — completed

| Exact migration | SHA-256 stored in Production history | Result |
|---|---|---|
| `20261101120754_commercial_google_ledger.sql` | `a9d77454705a9c827155f1a07acda040ce48e5fb6911bf793edc3e0efed7a28c` | Applied |
| `20261102010000_commercial_lineup_inventory.sql` | `c39d5da280d2d76226740d904e93732b2ca6ecffee505bf1803924b0e54e995b` | Applied |
| `20261102010001_public_customer_gameplay.sql` | `121e97e5e41d160aee4f7bcdcd92fcaee2aae87c547c17a7af7b71ded978b4f2` | Applied |

All three committed together at approximately **2026-11-01 23:15 UTC**, Production project `pojoymtniryarxxunyvz`. No blanket migration push and no duplicate logical migration. An independent new database session confirmed all three history hashes at 23:15:26 UTC.

The refreshed AES-256-GCM encrypted backup is 80,464,306 bytes, SHA-256 `faf6ddf3422281ae43e6a02c46dba785d2265142059a73fe224de95f279ea9e9`. It was restored on isolated PostgreSQL 17.11 with no network or published ports; cron execution was disabled. All three migrations applied and reapplied, with the original protected records unchanged. The whole archive authenticated and matched its digest; no plaintext dump was written to disk. The restore container is stopped. The ignored archive and encrypted rollback definitions remain under `private-data/commercial-restore-20261102b`; its operator-held key is outside Git.

Recovery scope is the logical PostgreSQL database and role definitions/membership, not Storage object bodies, role passwords, external service secrets or hosted project configuration. Those systems were not changed. Recovery must use the retained operator credentials and existing configuration records; never restore old wallet state over later transactions.

### Drift and integrity

The first strict comparison correctly stopped before writes because the NFL worker had updated `sports_feed.nfl_rounds`. A fresh backup/restore showed the same normal polling behaviour. Exact archived/live row comparison established that **only `last_checked`, `next_check`, `lease_until` could differ**: all eight round identities, fixtures, locked snapshots, lock times, purpose, stream and issues matched. This expected scheduler activity was recorded, not suppressed as generic drift. Any other change fails closed. NFL processing was not stopped.

Before and after DDL, **310 protected tables** had identical row counts and complete-row fingerprints inside the same serializable transaction. This includes Auth users, wallet state/lots/journals, card ownership/serials, pack receipts, sales, entries, scores, history and cron schedules. Existing table RLS and grants were identical. The new schemas' tables all have RLS; browser and service roles have no direct schema usage. The new runtime role is NOLOGIN, non-superuser, non-BYPASSRLS.

All commercial sales/issuance/transfers/gameplay flags remain false. Products remain unapproved; accounts, receipts, cards and other issuance/ledger/job records remain empty. Public policy and NFL/AFL/NRL programme flags are false; public round bindings are empty. Registration is false. No cash feature, prize, paid entry or NBA activation occurred. Security advisors show private default-deny RLS information and the pre-existing leaked-password-protection warning; no protection was weakened.

Evidence: `qa/approved-production-20261102/{apply,post-migration,drift,security-advisors}.json` and `restore/`.

## Release configuration and actual checks

The protected application candidate already contains the applicable source from `8dcfd9f18960936145a605595a01119a92fa1c89`; there is no application/Android/migration source difference between that candidate and `78012503`. This continuation changes operator tooling, tests and documents, so no redundant Android build or application promotion was performed.

- Live: https://docked.com.au, application `053848ed67946fdd727a5c1d8547272d383c9470`, deployment `dpl_2bWUkY1sgtshkifqRRty89oPfuzQ`.
- Protected candidate: https://docked-production-cegqqc17p-briant-s-projects.vercel.app, deployment `dpl_2KUfz1Haq2B5DUNbPM54AyQFG6Rs`. Protection credentials are not member authentication.
- Fresh post-migration HTTP checks: **19/19 live**, **19/19 protected candidate**, plus **7/7 candidate commercial/public endpoints** returning private, no-store 403. Registration remained closed; NBA API access denied. Five policy/deletion URLs returned 200.
- Typecheck and targeted ESLint passed. Two new backup-comparison tests passed, covering COPY null/backslash handling and rejecting changed fixtures, locks, issues, round identities or membership. The migration restore/reapplication and live atomic integrity tests passed. Existing broad platform/database/build and genuine TEST-order evidence is retained under its original date/scope, not claimed as rerun here.
- Signed AAB unchanged: **v30 / 1.29**, package `docked.fantasy`, `artifacts/android/Docked-commercial-candidate.aab`, 9,214,095 bytes, SHA-256 `d3837d7191e0a6bbd64a572a9ac3288fd37b440eb36e67408648fb4b3c879e29`. Google-generated v30 artifacts remain accessible with the established signing certificate. ADB currently reports no connected device; no new physical acceptance was claimed.
- Google readback: `docked_credits_4900_v1` = **A$49 / 4,900 credits** and `docked_credits_9900_v1` = **A$99 / 9,900 credits**, AU-only, no bonus, multi-quantity off, **both INACTIVE**. No new purchase, consumption or refund was made.

The prepared customer path remains native Google credit checkout → authenticated server verification → the same member's commercial wallet → separately confirmed sport-specific pack purchase/opening. Standard 1/3/9 cost 100/300/700 credits; Premium 1/3/9 cost 700/1,900/5,000. These are not direct A$49/A$99 pack SKUs. TEST and commercial funding remain separate.

## Hosted public-mode acceptance — precise limitation

Existing isolated real-Auth signup, email confirmation, NFL/AFL/NRL free-Core selection/save/entry, deletion and Google TEST wallet/pack/refund evidence remains valid for its tested environments. It is **not** a fresh hosted acceptance of the final commercial/public configuration.

The old dedicated Preview `bckkllmndoxzpzdqrevb` now fails DNS resolution. Current Supabase access exposes only the Production organisation/project. A replacement project quote is **10/month** (the connector did not return a currency field), so it was not created under the owner's no-new-recurring-cost restriction. The existing protected Vercel candidate and local isolated Auth stack are available; Production registration was not opened as a workaround. Restore access to an existing isolated Auth project or explicitly approve a separately quoted temporary host before this full journey can be completed. No synthetic identity, region approval or licence assertion will be copied into Production to bypass this gate.

## Rights, policies and Console

The [sport-by-sport rights matrix](COMMERCIAL_RIGHTS_MATRIX_20261102.md) records permitted nflverse/Wikimedia/Squiggle reuse and its obligations separately from player-card merchandising rights. No executed Docked player-card or commercial player-statistics provider agreement was established. AFL source history covers 218 matches and NRL 213, both with zero player-game records; these documented source counts are not new imports. Missing player statistics are not fabricated.

Updated policy wording is in [the publication package](policies/2026-11-01-commercial-review/REVIEW.md): purchase/refund help, recovery holds, service-discontinuation remedies, privacy, company financial-record retention and finite operational proposals. Current live URLs are [Privacy](https://docked.com.au/privacy), [Refunds](https://docked.com.au/refund-policy), [Retention](https://docked.com.au/retention), [Commercial policy](https://docked.com.au/commercial-policy) and [Account deletion](https://docked.com.au/account-deletion). They serve the truthful release-preparation version; the revised commercial Markdown drafts are not represented as published/accepted terms.

Authenticated Console observations:

- v30/1.29 Australian Production draft retained; **not submitted**. Managed publishing **on**. Ten saved changes await submission. No declaration appeared in Need attention; Actioned includes Data Safety, privacy, access, audience, financial features and content rating. This status is not Google approval.
- Reviewer sign-in details remain saved from the owner-entered credentials. No password was read, copied or placed in reports/Git. Prior reviewer gameplay acceptance is preserved; the final public-mode paid-access configuration still needs its own acceptance.
- Australian IARC result is **Mature**, with chance-based purchases and online-interaction descriptors. Certificate ID displays `-`. South Korea's separate refusal is outside the Australian-only distribution scope.
- The saved summary includes “Trading/selling of digital goods for real-world currency”. The revised questionnaire requires fresh IARC terms before its detailed questions are accessible. Terms confirmation is pending; no new questionnaire was saved or submitted. This is a specific declaration consistency check, not a request to approve the business model again.
- Final public-mode listing screenshots remain dependent on that exact hosted configuration. Existing beta screenshots have not been relabelled as public acceptance or replaced with invented paid results.

## Exact remaining actions / gates

1. Supply sport/player-card permission documents or a qualified Australian analysis supporting the exact use without additional permission; resolve the official NFL roster-source use separately from the licensed nflverse statistics. Reconcile permanent lifetime supply baselines before any commercial definitions are approved.
2. Complete the documented Australian linked-model assessment: paid random cards, multipliers, transferable value, free entry and no prizes/cash-out. The Australian M rating is evidenced; it is not gambling or IP clearance. Confirm the intended initial commercial-transfer scope and answer IARC accurately, without changing approved pricing or fees.
3. Approve the revised IARC terms step, then finish the factual rating correction where warranted. This additional prompt is required by the browser's action-time legal-agreement rule; ordinary model/submission approval is already recorded.
4. Restore approved no-cost isolated hosted Auth access, or authorize a clearly priced replacement. Complete the exact public-mode registration/confirmation/gameplay/TEST-purchase/refund/deletion/reviewer journey there and capture matching store screenshots. No public registration or real charge is needed for this acceptance.
5. Finalise the category-specific retention decisions, provider/dispute window and accounting responsibilities; implement and verify the corresponding archival/minimisation process before paid operation. Approve publication wording/consent versions, not the already approved model. Provision separately reviewed restricted commercial runtime/notification credentials and schedules with all sales gates closed until acceptance.
6. Finish Play-installed v30 acceptance when a device is available, then apply the existing conditional submission authority only after every mandatory gate is evidenced. Keep managed publishing on. Activate neither products nor public registration merely because the three dormant migrations are now present.

No further approval is requested for these migrations, the existing commercial model, or routine submission authority. Rollback is dormant-feature disablement/application rollback plus retained encrypted function/ACL evidence; do not drop ledgers, erase ownership or restore old customer balances. No public submission, money movement, prize award or customer-record mutation occurred in this continuation.
