# Play loading and owned-card selection — 23 October 2026

## Changes

- NBA, AFL and NRL private-beta Play now reads settled ownership rather than the full eligible roster. The same filter feeds Auto Select, position pickers, draft validation, entry validation and future rollover.
- Only opened, owned ledger cards or genuinely owned legacy cards qualify. Other members' cards, unopened packs, missing ownership records and catalogue-only Core availability are excluded. Existing private-beta admission, MFA, sport, position, salary and lock guards remain enforced.
- Current editable entries retain their saved artwork and show a replacement notice when a saved card is no longer owned. Locked/historical snapshots and results are preserved. No ownership, wallet, grant, pack, scoring or historical data is rewritten.
- The collection empty state no longer promises free catalogue selection, matching the owner's latest instruction.

## NFL loading investigation

Production logged `fantasy_screen_unavailable` for Play. Its bounded request allows 15 seconds. The read chain repeatedly evaluates the NFL inventory projection. That projection extracted fields from the large shared JSON ledger for each card; the same projection was invoked multiple times in the request.

The migration extracts the relevant ledger sections once into materialized CTEs before joining owned cards. An actual read-only Production comparison returned identical card objects for all three active credit-access accounts: 157, 106 and 117 limited cards. That query improved from 3,623–3,736 ms to 153–186 ms. After migration, the complete seven-player inventory read, including legacy cards and identity mapping, measured 574–820 ms over nine reads; earlier reads measured approximately 4,800–6,100 ms. These are database measurements, not authenticated handset page timings. Existing logs did not retain the underlying exception, so they cannot prove every previously reported load failure had this cause.

## Verification

- 607/607 platform tests passed on the final serial run. A pre-existing random-allocation test was corrected to verify the drawn card's actual rarity instead of assuming every Standard draw was Rare.
- Database suite: 195 tests passed initially; 11 resource-failed files/cases were rerun serially and all 20 contained cases passed (215 successful cases across the completed runs). Initial failures were Windows process/resource failures and PGlite memory allocation failures. The targeted ownership/admission/economy suite also passed 12/12.
- NBA/AFL/NRL real React + disposable PGlite browser journeys passed at 412×915 and 1440×915: owned-only picker, unowned search rejection, exact 8/22/13-slot lineups, draft, entry and reload persistence. Screenshots are in sport subdirectories. These use isolated synthetic owned grants, not Production member sessions.
- TypeScript, lint, clean Production build and client-secret canary scan passed. Canary scan checked 84 browser assets. Broad heuristic secret scan flags eight unchanged pre-existing test/local-infrastructure files; no changed implementation file is flagged.
- Production migration rehearsed twice in a rollback transaction, then applied and independently verified. Twelve protected tables have matching before/after fingerprints, including credits state, ownership, drafts, locked snapshots, entries and results. Zero ownership or wallet writes. Internal helpers are inaccessible to public, anonymous, authenticated and runtime roles; member-facing guarded functions retain their existing grants.
- Read-only Production ownership diagnostics found Owner: NBA 18 / AFL 18 / NRL 9; Barry and Luke: zero in those sports. These counts may legitimately change with future purchases/transfers. The repair does not issue cards to fill missing positions.

## Release and recovery

Migration: `20261023052447_play_owned_inventory.sql`. Recovery snapshot was privately retained and read back successfully. This is an application recovery snapshot, not a full Auth/Storage disaster-recovery backup. Previous function definitions are saved privately under `private-data/play-owned/rollback-*.sql`; restoring them and promoting the captured prior deployment reverses the release without changing member records.

The release script preserves existing feature flags and registration restrictions. Exact release identity and hosted checks are recorded in `release/`. There was no authenticated Docked browser session available during this task; signed-in Production gameplay must not be inferred from owner SQL diagnostics or isolated browser tests.
