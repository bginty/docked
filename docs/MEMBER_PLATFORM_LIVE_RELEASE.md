# Member platform live release — 19 October 2026

Live at **https://docked.com.au**. The public release identity was verified at 06:12:35 UTC (17:12 Sydney).

- Deployed commit: `f3d9d1b6f89be28ea458a8ea02c0dfebbdcbf187`.
- Vercel deployment: `dpl_9Z3chVNU7R1qBaSKww3CysR1n2et`, READY, production, Sydney region.
- Main feature commit: `f215b5af`; final follow-up handles signed-out announcement access and the operator script's PostgreSQL JSON encoding.
- Supabase migrations applied in order: `20261019050004`, `20261019050005`.

## Activated and checked

The six products are active at Premium 9/3/1 = **5,000 / 1,900 / 700** credits and Standard 9/3/1 = **700 / 300 / 100**. Live readback checked exact card counts and per-card odds. Economy revision advanced from 152 to 153 for catalogue configuration only. Existing wallet balances, card ownership, purchases and receipts matched the protected pre-release snapshot. Repeating configuration left revision 153 unchanged.

**Three eligible existing accounts each received one unopened weekly entitlement**. Exactly three unique account/interval records exist; an immediate retry issued zero. No pack was opened by this release and no credits were deducted. The current eligible Core pool contains 456 players. Next entitlements fall on **26 October 2026 at approximately 17:07:34 Sydney time**. Permanent legacy cutover is recorded; existing legacy entitlements remain valid.

Both existing-infrastructure Cron jobs are active and genuine scheduled executions succeeded:

- `docked-weekly-core-entitlements`: first observed success at 06:08 UTC, subsequent success at 06:11 UTC; no duplicate packs.
- `docked-sale-receipts`: first observed success at 06:08 UTC, subsequent success at 06:11 UTC.

There were no new sales queued during this acceptance window, so **actual live sale-notification delivery is not claimed**. Retry/deduplication/settlement isolation passed the isolated database tests. Web push remains unavailable/unconfigured.

Two weekly NFL Week 6 schedules are published: Traditional awards 5/3/1 Standard 9 packs; All-Star awards 5/3/1 Premium 9 packs. Future applicable NFL rounds use the configured templates. Season prizes remain unannounced. **No prizes were paid**. No sample announcements were published; the archive is correctly empty until an authorised owner publication.

Existing full-PPR game-log data and saved half-PPR competition execution were not changed. The four affected competition IDs and the unresolved historical Social caption/attachment mismatch remain documented in [the implementation handover](MEMBER_PLATFORM_UPDATES.md).

## Recovery and release checks

Fresh scoped recovery: `private-data/member-platform-live-recovery`, captured at 06:02 UTC. SHA-256 `514e50caade88b298f0237754869cc96d87a4d1e8ca36b57b73b1504e9b14dd1`.

Offline restore drill passed **85 tables, 4,308 rows, 119 primary/unique constraints and 93 foreign keys**. Five external foreign keys and the scoped-restore limitations are recorded in the public recovery receipt. Private snapshots, credentials and account manifests were not uploaded or committed.

Both hosted builds completed successfully. The tested staged production candidate was promoted without disabling Vercel protection. Final live `/api/beta-release` identifies the exact commit/deployment above. Protected candidate Packs, Prizes and announcements routes returned 200; unauthenticated CSV export returned 403. Final signed-out announcements display Sign in without the generic load failure. `/api/status` returned 200; private card-statistics preview remained 404. GET on the POST-only NFL status route returned 405, not a statistics-health assertion.

Final deployment runtime error query returned no error/fatal groups in the immediate verification window. The first candidate's logs contained the deliberate unauthenticated probes; the uncaught announcement authentication case was corrected in the final build. This is a short observation window, not continuous monitoring or signed-in end-to-end acceptance.

The earlier full suites passed 491 platform tests and 187 database tests, plus final cutover and native PostgreSQL weekly tests. The follow-up passed typecheck/lint and its hosted build and signed-out HTTP check. Physical Samsung, installed-app and a new two-account purchase/sale were not performed in this deployment session.

## Recoverable operator retries

- First scheduler invocation was rejected because pooled SQL could not execute explicit transaction statements. The existing scripts then ran on a reserved connection and both jobs were verified before activation.
- First catalogue attempt rolled back when PostgreSQL received a JSON string instead of an object. Corrected parameter binding to `tx.json`; the successful transaction preserved protected member state. The committed operator helper includes the correction.
- The first promotion succeeded but its CLI wrapper failed parsing the empty response. Deployment readback established success; it was not blindly retried. Final promotion handled the empty response correctly.

## Barry's checks

1. Refresh Docked and open [Packs](https://docked.com.au/fantasy/test-wallet?view=packs): six products and My Packs weekly entitlement/countdown.
2. Open [Prizes](https://docked.com.au/fantasy/prizes): Traditional/All-Star and Weekly/Season selectors; Season stays unannounced.
3. Open Cards and use Export collection CSV; inspect Social and its announcement archive.
4. For any normal authorised sale, check the seller's in-app receipt and Activity amounts. No extra test purchase or push was sent by the release.

Evidence: [live database acceptance](qa/member-platform/live/live-acceptance.json), [scheduled execution](qa/member-platform/live/database-verified.json), [activation](qa/member-platform/live/activation.json), [release identity](qa/member-platform/live/live-http.json), [recovery](qa/member-platform/live/recovery.json).
