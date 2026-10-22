# Private multi-sport implementation and verification

This checkpoint integrates NBA, AFL and NRL into the existing application, account admission, wallet, marketplace and Social services. NBL is excluded. The intended release is invitation-only fictional testing, not a real-player launch.

## Implementation

- Existing NBA admission is reused for server-enforced AFL/NRL access. Email confirmation, expiry, account status and owner MFA remain mandatory.
- NBA keeps its approved eight-player weekly rules; AFL keeps 22 slots; NRL retains the provisional 13-player configuration. AFL/NRL salary values are explicitly artificial QA units, not approved commercial caps.
- Opened test-pack ownership projects into the existing lineup inventory within the same transaction. Free fixture cards remain; transfers do not rewrite locked entry snapshots.
- Standard and Premium nine-card test packs reuse existing prices and probability tables, excluding Core. Isolated fixture registries cannot become permanent player/card inventory.
- Shared-wallet purchases, fixed-price sales, private offers and combined swaps reuse existing settlement. Sales remain 5%, capped at 2,000 credits. Historical fees remain unchanged.
- Fixture Social attachments require ownership when posted and are visible only to admitted testers. Historical posts retain their original card after transfer; old owners cannot create a new attachment to it.
- Immutable fictional catalogue records do not require a fabricated periodic roster verification. Real-player freshness protections remain unchanged.
- Versioned scoring journals support the existing NBA weekly aggregator and AFL/NRL provisional rules, including verified DNP and corrections. No real-data schedules are activated.

## Verification at this checkpoint

587 platform tests and the frozen 206-test database suite passed. Four final focused database tests also passed, covering the three isolated sport economy lifecycles and owner operations permissions/reporting. Earlier harness failures were corrected before release; they were not ignored.

Local browser journeys passed for NBA/AFL/NRL lineup and collection screens at 412 and 1440 px. Pack shopping/reveal/history passed at 360/412/1024/1440 px. Marketplace listing, repricing, removal, purchase, stale-consent protection, lost-response recovery, recorded fee, ownership and activity passed at mobile and desktop sizes. Card-plus-credit offer creation and acceptance also passed for each sport, including lost-response recovery for both commands, no debit before acceptance, and one ownership exchange. The 1,000-credit sale component records a 50-credit fee and 950-credit proceeds. Serious/critical accessibility checks passed in the tested flows. These use real components and isolated local data/transport, **not authenticated hosted acceptance**.

Statistics-service regression: 109 tests passed in the separate repository at `4251632` (implementation checkpoint `0330912`). No new commercial feed was enabled.

Build, typecheck, lint and browser-secret-boundary checks passed. The repository heuristic secret scan flags eight pre-existing test/template files; no new credential is intentionally stored. Docker remains in `starting` and its Linux API returns 500, preventing a fresh real-Postgres concurrency run. Existing locking/transaction infrastructure is retained; PGlite is not reported as multi-connection concurrency evidence.

## Release boundaries

Six additive migrations passed transaction-and-rollback rehearsal and were applied to the exact beta database, including the read-only owner operations report. All ten monitored record groups were unchanged inside the migration transaction. A later comparison preserved nine whole-table fingerprints; NFL round processing timestamps had progressed. A separate comparison with the recovery snapshot confirmed only `last_checked` and `next_check` changed, with fixtures, locked snapshots, identities and lock times unchanged. A private application-data/function recovery snapshot was read back and hashed. It is not a full Auth/Storage backup or a tested disaster-recovery restore.

The private fixture implementation and follow-up are live at `fe5a6b24070cb2e358322c8945ca8885b134750e`; 17 candidate and 17 live HTTP checks passed, including closed registration and unauthenticated API denial. The follow-up corrects stale offer-fee wording, scopes the inbox to the selected sport, preserves offers during refresh failures, and adds browser acceptance for combined offers. `release/` receipts identify the exact deployed commit. Promotion used the reviewed commit and verified isolated-economy preparation. Promoting the previous application deployment is reversible; disable affected private sport/commerce flags if suspension is needed, and retain audit records and additive registries.

## Genuine remaining dependencies

No newly verified real NBA, AFL or NRL catalogue was loaded: **0 for each sport**. Existing official-source/provider investigations do not establish complete current-contract rosters and commercial usage permission. Fictional player counts must never be reported as verified real players. Real roster provenance, eligible positions, data rights/credentials and permanent issuance approval remain required. Commercial statistics and permanent issuance stay disabled.

The in-app browser is now usable. The live home page and login form were opened; the login form has no authenticated member session. No hosted sign-in, purchase or trade has been claimed. Do not bypass confirmation/MFA or manufacture a member session. Owner, Barry and Luke have confirmed/admitted database identities; Brenton is allowlisted but still requires email confirmation. These database facts are not proof of a successful member login.
