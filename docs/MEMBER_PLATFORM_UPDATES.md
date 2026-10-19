# Member platform release — 19 October 2026

## Delivery status

Implemented on `codex/member-platform-updates`, based on deployed marketplace commit `7ba9b8c4b613627aec94c6b211552b382f9b20a7`. The original working directory and its unrelated uncommitted changes are preserved. This release has **not been applied to Production**. All mutation tests used isolated fixtures. No real member credits, ownership, statistics, competition results, announcements or push deliveries were changed.

## Changes

- **Scoring:** player-reference explanations now derive from `nflPostgameWeights`, including full-PPR receiving. Saved competition rules are shown separately when different. No execution weights, source statistics, salaries, rarity multipliers or locked snapshots were changed.
- **Weekly packs:** retained the existing atomic four-Core allocator, permanent UTC schedules, interval uniqueness, catch-up and saved opening receipts. Background refresh failures now retain the last confirmed count/countdown. Activation closes new legacy ten-card NFL starter claims; already earned legacy entitlements and saved allocations remain valid. The activation script must use the same advisory lock as allocation.
- **Paid catalogue:** six immutable product versions, family-level odds/details, responsive gold/blue tiles and one/three/nine-card purchase, opening and replay. Product upgrades preserve historical products, old prices, receipts and holdings. Old eight-card receipts are not converted. The server guard retains the existing retirement, permanent supply and ownership protections.
- **Round status:** derives entries-open/in-progress/statistics/review/final labels from fixture timing, explicit live states, entry deadline, visibility, finalisation and available-score state. Missing values remain distinct from zero/DNP/bye.
- **Social attachments:** saved identity, not caption/name/array position, drives both thumbnail and viewer. Invalid attachments show unavailable; compose state is keyed to the actual awarded card. Existing historical attachments are not rewritten.
- **Redemption:** ordinary members see a concise beta-unavailable state with balance distinctions and existing history, without a synthetic identity/bank workflow. No cash capability was enabled.
- **Navigation:** NFL Kicker filter removed; customer-facing terminology uses Rankings with existing URLs preserved. Play refreshes on focus/resume and periodically, retaining dirty lineup drafts.
- **Sale receipts:** a transactional SOLD-transition outbox captures actual settlement gross, fee, net and card snapshot. A retryable worker and authenticated notification-read catch-up create one in-app receipt per sale. Activity links focus the settled sale. Delivery failure does not reverse settlement. **Web push is not implemented or configured**; in-app receipts remain available independently.
- **CSV:** authenticated server export includes all currently owned, opened cards across sports, independent of UI pagination/filtering. UTF-8 BOM, CRLF, escaped values, formula protection, stable columns and UTC timestamps. Unlimited Core serial/cap fields remain blank. No other user's balances or private data are exported.
- **Official announcements:** existing owner/MFA review and audit workflow extended to published snapshots, pin/unpin and archive. Draft edits do not replace the published snapshot until approved publication. Text is rendered escaped; CTA destinations are allowlisted. Banner appears above every ordinary feed tab; archive/detail routes are authenticated. No sample announcements were published.
- **Prizes:** stable catalogue references support 5/3/1 Standard 9 packs for Traditional and Premium 9 packs for All-Star. Templates apply only from an explicitly reviewed season/week, preserve existing published schedules and never issue awards. Season remains unannounced. Selectors now update local state and browser history without waiting for a full authenticated server navigation, clear stale competition IDs on mode changes, retain week and respond to Back/Forward. Buttons explicitly use `type="button"`.
- **Loading:** shared Light Sweep startup boundary and local placeholders; ordinary navigation keeps the shell. No artificial delay; reduced motion, failure and Retry states retained.

## Established causes and limits of the investigation

### Weekly packs

Read-only Production inspection found `sports_feed.weekly_core_control.enabled=false`, zero schedules and zero weekly packs. Existing cron jobs handle NFL ingestion/locks and authentication mail, but no weekly entitlement job exists. The previously recorded app gate `DOCKED_WEEKLY_CORE_ENABLED` is also false; recheck its deployed value during release. The allocator itself passed isolated PostgreSQL concurrency/opening tests. Removing disabled copy alone would not activate issuance.

There is also a legacy acquisition path (`nfl_starter_entitlements` / `nfl_allocate`) that could create ten Core cards on first read/open. The cutover migration stops **new** legacy entitlement creation after weekly activation and rejects direct new legacy allocation. Its first-activation timestamp remains set when weekly issuance is paused. Existing entitlement history is retained. This is a product cutover, not a card deletion.

### Scoring execution discrepancy

Current game-log receiving is full-PPR: five receptions + 76 receiving yards = **12.60** base points. Four observed NFL 2026 Week 6 competitions still use **0.5 points per reception**:

| Competition ID | Saved execution |
| --- | --- |
| `b828817d-0ba9-4edd-87a3-fe6dd23ad7a0` | NFL Week 6 post-game beta / legacy |
| `8841bf7d-5952-47c4-b926-40b04fdc5cba` | Rarity test |
| `70de1f8e-b789-4331-99aa-6afb0c31a8a2` | Traditional seven-player |
| `315280d3-7413-4c2d-8a63-fef6d7e37003` | All-Star seven-player |

Saved competition contracts also contain kickoff/punt-return and offensive-fumble-recovery TD categories outside the game-log contract. This is an **execution mismatch**, not merely outdated prose. It remains unchanged pending an explicit decision about future competition rules. Completed/frozen competitions must not be silently recalculated.

### Social mismatch

One observed attached-card post was mismatched:

- Post `40c8acb4-b343-4308-a856-4f119c8963eb`: caption names Jake Ferguson / ULTRA RARE; post sport NFL.
- Saved card `0ac163a4-5fdc-47cd-9b97-a268e123c351`, player `f1000000-0000-4000-8000-000000000002`: Arlo Vale / Core / football / GK.
- Thumbnail and opened details both use that same historical snapshot. The mismatch is between caption and attachment; there is no evidence here that rendering swaps IDs.

The historical creation mechanism and intended attachment are **not established**. Do not replace the card from the caption alone. Any record repair requires identification of the intended owned card and separate review. No bulk repairs were performed.

### Prize selectors

The prior implementation routed every selector change through a full server request and cleared week on competition changes. The implementation now uses already authorised schedules locally, preserves week and keeps the URL synchronised. All combinations and history navigation pass isolated browser tests. The original reported live touch failure was not independently reproduced in an authenticated Production session; this report does not assert an unobserved browser/network cause.

## Verification

The checked-in browser receipts distinguish fixtures from live verification. No browser test buys or awards real member cards.

- Platform suite: 491 passing tests. Initial run had two stale expectations (removed Kicker filter and point formatting); fixed and rerun, not described as an uninterrupted pass.
- Database suite: 187 passing checks before the final cutover; final rerun is recorded in `docs/qa/member-platform/verification.json`.
- Integrated database test covers all six products through purchase/open, stable prize references, historical schedule preservation, no Season rewards, announcement/outbox permissions, delivery failure/retry/dedupe, migration replay and weekly legacy cutover.
- Native isolated PostgreSQL verifies weekly concurrency, opening replay, fixed cadence and delayed catch-up. Docker was not reset or required.
- Packs browser test at 1536, 1440, 1024, 412 and 360px purchases/reveals/replays all six sizes (9/3/1/9/3/1), confirms cancellation and repeated-submit safety, no overflow and no serious accessibility violations.
- Prizes/announcements/loading browser fixtures verify selector combinations, URL history, unpublished empty states, responsive layout, reduced motion and failure/Retry. Weekly browser fixtures verify countdown, four-card opening and recovery.
- Typecheck, lint and supported Webpack production build pass. A final operator-script lint finding for an explicit `any` was corrected using the inferred transaction type, then lint and typecheck reran successfully. Default Turbopack initially rejected the external dependency junction; the supported Webpack build succeeded without disabling security or changing source protection.
- Built client canary scan: server credential markers absent from 166 browser assets. Whole-repository heuristic secret scan flags eight pre-existing test/tool files; no claim of a clean whole-repository scan. Changed-file scan is separately recorded.
- Actual rendered desktop/mobile images were visually reviewed. Initial pack tiles were too tall; compacted and recaptured. These are viewport tests, **not a physical Samsung device, installed PWA or Android-shell acceptance claim**.

### Screenshots

- [Packs mobile](qa/member-platform/browser-1792387726065/packs-412.png)
- [Packs desktop](qa/member-platform/browser-1792387726065/packs-1440.png)
- [Announcement mobile fixture](qa/premium-member-release/browser-1792387736862/announcements-412.png)
- [Announcement desktop fixture](qa/premium-member-release/browser-1792387736862/announcements-1440.png)
- [Weekly countdown](qa/weekly-core/browser-1792387234787/profile-countdown-412.png)
- [Prizes](qa/premium-member-release/browser-1792387736862/prizes-published-412.png)
- [Light Sweep](qa/premium-member-release/browser-1792387736862/loader-412.png)

## Release and recovery procedure

1. Review the final commit and refresh the existing protected recovery snapshot before hosted migrations. Include schema/functions/permissions, catalogue aggregate and immutable product/receipt tables, legacy and weekly entitlements/allocations, wallet/ownership history, announcements/events, prize schedules/events/templates, notification records/outbox and cron configuration. Verify restore into an isolated database; never replace Production wholesale with a local database.
2. Apply `20261019050004_member_platform_updates.sql`, then `20261019050005_weekly_core_legacy_cutover.sql`. Neither activates weekly packs, purchases cards, publishes announcements or pays prizes. The cutover's effect begins when weekly control is enabled.
3. Run `npx tsx scripts/member-platform-release.mts` for a read-only revision/catalogue check from the existing protected operator working directory. After reviewing cutoff and revision, run with `--apply --project=pojoymtniryarxxunyvz --expected-revision=<current> --first-season=<reviewed> --first-week=<reviewed>`. The operator transaction registers immutable six-product terms and prize templates together; it asserts unchanged balances/holdings/purchased terms and aborts if the revision or existing template differs. Save its non-secret receipt. This script does **not** enable weekly issuance.
4. Deploy and verify the exact candidate with current environment controls. Keep real money, deposits and redemption disabled. Verify the global credit balance from the authoritative wallet.
5. Install `scripts/weekly-core-scheduler.sql` and `scripts/sale-notification-scheduler.sql`; both create **inactive** jobs using existing Supabase Cron, with no new paid service.
6. Weekly activation needs a reviewed eligible-account manifest. Three credit-enabled accounts were observed; this is not a claim that all three satisfy every eligibility predicate. Re-evaluate admission/setup/access under lock immediately before activation. Preserve existing valid schedules. For each eligible account without a schedule, create exactly one activation entitlement, timestamped by the server, then one per earned seven-day interval. No registration-date backfill or credit debit. Enable the app gate and backend control in the coordinated release, reconcile, then enable cron. Use advisory lock `71820342` during the activation transaction to serialise legacy allocation/cutover.
7. Enable the sale receipt job. Verify a genuine successful `cron.job_run_details` execution, weekly job-run receipt and interval count; for sales verify an authorised real settlement's outbox and one in-app notification. No test pushes to real users. Hosted scheduled execution is **not yet verified**.
8. Web push requires an explicit subscription/preference store, service-worker push handling, server-held VAPID key pair and retry/deduplication delivery implementation. None exists in the inspected deployment. Do not advertise push, request permission or claim delivery until that path is implemented/configured and tested with isolated subscriptions. In-app receipts work without it.
9. Owner may create/review/publish an actual announcement; sample fixture text must not be published. Publication is not a broadcast-push action.

Recovery: pause affected cron jobs/app issuance gates first; retain entitlements, receipts and outbox for retry. Roll back app code only to a schema-compatible version. Restore or repair only the affected configuration/records from the verified snapshot under an audited transaction, preserving any subsequent legitimate sales/openings. Do not delete earned packs, reverse settled wallet entries or downgrade immutable purchased terms merely to roll back UI. Do not disable the weekly control and then allow legacy claims during a rollback without retaining the acquisition cutover.

## Remaining acceptance

Hosted deployment/configuration and approved real-member activation have not occurred in this implementation session. Genuine cron execution, push delivery and physical Samsung/installed-app acceptance are not claimed. After release, Barry and the owner should check Packs purchase confirmation/replay, Profile countdown with unopened packs, Prizes mode/period/Back navigation, Social announcement/archive and matching attached-card viewer, full CSV download, and one authorised sale receipt. No test purchase should occur without a reviewed card/credit scope.
