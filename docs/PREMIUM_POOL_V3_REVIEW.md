# Premium rarity pool v3 — local review

15 October 2026. Based on source `a9744a65` (previous live application source `7730267b`). The owner subsequently authorised deployment of this reviewed Premium change. Release outcome is recorded below when verified. No member accounts, credits, cards or messages were used for QA.

## Configuration and behaviour

New configuration: `premium-nine-seven-test-v3`. The explicit transition clones the currently active Premium product and changes only its ID/version, effective time and weights. Price (currently 1,800 test Docked Credits), nine-card count, player positions/status/freshness policy, duplicate-player policy, expiry and fail-entire-pack policy are retained. Existing Standard configuration and its active version are unchanged.

| Rarity | Integer weight / 10,000 | Per-card attempt |
| --- | ---: | ---: |
| Ultra Rare | 9,000 | 90% |
| Legendary | 990 | 9.9% |
| Icon | 10 | 0.1% |
| Rare / Elite | 0 / 0 | Excluded |
| Core | Not a purchased-pack weight | Excluded |

Every card is Ultra Rare or better. There is no additional guaranteed Legendary/Icon slot. The new version rejects changed weights or guaranteed slots in server validation. Ordinary members cannot register configurations; database registration is immutable and the state trigger requires exact registered configuration documents.

The existing secure server RNG draws a rarity first, independently for each slot, then selects uniformly among eligible players with remaining supply in that rarity, excluding already selected players. No odds are redistributed. An empty selected-rarity pool fails the entire purchase. Allocation uses a private cloned state; debit and persisted ownership only follow successful allocation, inside the existing transaction/lock path. Lifetime caps, serials and ownership logic are unchanged.

The UI uses the server product projection and shared `packOdds` helper. It displays per-card attempts only. No at-least-one percentage is displayed, avoiding a misleading completed-pack frequency: the theoretical independent attempt calculation would be `1 - (1 - p)^9`, before supply checks. Conditioning on successful supply checks can change observed completed-pack frequencies.

## Existing purchases and replays

Audit confirmed nine-card purchases already persist all nine allocated instance IDs, full product configuration and configuration hash at purchase, before the member opens the pack. Opening/replaying reads this result; it does not draw again. Existing unopened v1/v2 packs therefore retain their original cards and guarantees. The upgrade does not edit any pack, entitlement, receipt, card, balance or serial. Legacy single-card entitlements retain their original opening path. Old offers are not active for new purchases after transition. The pack list exposes the purchase-time configuration version.

No hosted inventory audit or repair is needed for this local implementation. The future activation validates the entire supplied economy and refuses incompatible state, multiple active Premium products, pre-existing extra guaranteed slots or an inactive conflicting v3 version. It does not guess or rewrite affected records.

## Local preview and evidence

- Preview: http://127.0.0.1:3023/fantasy/test-wallet#packs
- Start: `node --import tsx scripts/marketplace-local.ts --serve --visual --premium-v3`
- This is the existing synthetic HTTP preview, using real domain purchase/open commands and member-view components. It is **not** genuine hosted authentication or a PostgreSQL-backed HTTP acceptance run.
- [Mobile Premium panel](qa/premium-v3/premium-412.png)
- [Desktop Premium panel](qa/premium-v3/premium-1440.png)
- Browser evidence: `docs/qa/premium-v3/browser.json`; includes the existing reveal interruption/replay/accessibility tests. Reveal transport tests use fixtures and remain distinct from the synthetic HTTP purchase test.
- Database evidence uses isolated PGlite and actual existing SQL migrations/triggers. It is **not** a separate-connection concurrency test. The production locking/RNG/issuance algorithms were not replaced.

Focused tests cover every integer rarity boundary in all nine slots, nine distinct awards, Icon serial/cap exhaustion, rollback after eight provisional awards, insufficient balance/supply, single settlement on retry, original unopened pack/replay identity, Standard preservation, API/UI odds agreement, immutable registered configuration, permissions, configuration rollback and idempotent activation.

Final verification: **349/349 platform tests, 153/153 embedded database tests, 8/8 focused browser tests passed**. Typecheck, repository lint, clean-environment production build, client-boundary canary scan (55 browser assets) and `git diff --check` passed. Full platform/database outputs and browser JSON are retained in `docs/qa/premium-v3/`. Initial test-authoring assertions expected different rejection text; these were corrected to the actual safe rejection messages before the passing final runs. No implementation bypass or suppressed test was used.

## Configuration migration and rollback

No schema or privilege migration is required. `applyPremiumPackTransition` reuses `credits_sandbox.pack_configuration`, `state` and append-only `history`. The caller must run it in one operator transaction; it takes the same advisory lock as purchases and a state row lock, registers the exact immutable configuration, appends one history revision, and atomically replaces only the active Premium offer. A protected-state digest asserts all holdings, balances, receipts and supply remain unchanged.

Local-only runner: set `LOCAL_PREMIUM_DATABASE_URL` to an explicit localhost database named `docked_*local*`, then run `node --import tsx scripts/premium-pack-local.ts`. Default is a transaction rollback review; `--apply` commits only to that local QA database. It has no hosted default and rejects remote targets. Embedded database tests exercise the same transition function, including rollback and repeat application.

Future hosted activation requires separate authorization and verified target/backup review. Do not deploy this app and assume it changes a persisted product: the reviewed configuration transition is also required. Do not run the historical `apply-barry-review.ts` script to activate v3; it intentionally describes the earlier v2 change.

Before activation commit, ordinary SQL rollback discards the whole transition. After activation, stop new Premium sales if necessary, retain the v3 configuration, all receipts/instances and subsequent ledger history, and use an audited active-offer transition only. Never restore an old entire-state snapshot over purchases. Re-enabling older Premium odds requires an explicit reviewed offer/disclosure decision, not a silent rollback. Existing receipts remain openable regardless of whether their product is currently on sale.

## Files

- `src/core/card-economy.ts`: additive v3 configuration transition and immutable v3 weight validation.
- `src/core/pack-odds.ts`, `src/core/member-test-wallet.ts`, `src/components/member-test-wallet.tsx`: authoritative disclosure, confirmation and purchase-time configuration context.
- `src/server/premium-pack-transition.ts`, `scripts/premium-pack-local.ts`: atomic audited registration and guarded local runner.
- Local preview/build helpers and focused platform/database/browser tests.

The local implementation phase made no hosted changes, member purchases, grants, invitations or messages. Physical S24 acceptance remains unperformed. The subsequent owner-authorised release is recorded below.

## Authorised release preparation

The owner requested deployment after reviewing the local result. Read-only hosted preflight verified the intended database, registered v2 products, test-only wallet/admission controls, 489 eligible players, and preservation of 14 existing purchased packs (one unopened). Prices remain Standard 900 / Premium 1,800 test credits. Existing live rollback: `dpl_4KKgVnB3qHLosnWKiM7w8TXLg1nH` / source `7730267b`.

A hosted rollback-only rehearsal identified a driver-specific JSON serialization issue: passing JSON strings to postgres.js double-encoded parameters for JSONB columns. The transition now passes objects, which both drivers serialize correctly. The focused embedded database test passed again and the hosted PostgreSQL rehearsal passed with complete rollback; no product was activated by that rehearsal. Its protected-state hash was unchanged. The release-only runner `scripts/premium-pack-hosted.ts` verifies the exact project, registered configuration, existing Standard hash and test economy, and stores an affected-aggregate backup privately before applying. No schema or privilege changes are needed.

## Live release — 15 October 2026, 15:41 Sydney

- Live packs: https://docked.com.au/fantasy/test-wallet#packs
- Source committed and pushed: `1a72636892bc5862263e17088f349beeba37f246`.
- Deployment: `dpl_3Etm1PzzUD6CsJNv6pvNkjMZFNYh`, existing project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`. Both docked.com.au aliases verified against that deployment.
- Staged production with `--skip-domain`; candidate checks 7/7 passed, then promoted; live checks 7/7 passed. These are anonymous read-only HTTP/asset checks, not authenticated hosted purchase acceptance. [Candidate](qa/premium-v3/candidate.json), [live](qa/premium-v3/live.json), [release decision](qa/premium-v3/decision.json).
- Configuration transition committed atomically at aggregate revision **75**, version `premium-nine-seven-test-v3`, configuration hash `fd6f7415bb66ae176881208164f9d6d69ac85fe26c3aa4138977d83cc25f0a9a`. The post-commit read verifies exact weights, price, count, player pool and derived UI disclosure. [Application receipt](qa/premium-v3/configuration-apply.json), [read-only verification](qa/premium-v3/configuration-verify.json).
- Member activity advanced the aggregate between preflight and cutover. The transaction used the latest state (revision 74), preserved **all 16 purchased packs, including one unopened pack**, and asserted every non-configuration field unchanged. No existing member activity was overwritten. Standard's full configuration hash is unchanged. We made no hosted pack purchases, grants, trades or member commands.
- Private affected-aggregate backup was written and read back before activation; its hash is retained in the application receipt. This is not a full Auth/storage backup and must never be restored over subsequent transactions.
- Source/evidence secret review: the unchanged scanner reported one existing intentional build-canary template in the credential-free build helper, with zero exact known-secret matches. The raw FAIL and reviewed classification are separately retained; the scanner was not weakened. Private grant material, unrelated files and the old APK-download capability were excluded from the commit/export.
- Android shell confirmed `au.com.docked.app` loads `https://docked.com.au/app`. Fully close and reopen the installed app, or refresh the browser. No new APK, uninstall or clearing data is required.
- Rollback reference remains `dpl_4KKgVnB3qHLosnWKiM7w8TXLg1nH` / `7730267b`. Before reverting to that application, pause new Premium offers through an audited active-product change; otherwise its older UI would omit the v3 guarantee wording. Preserve v3 registrations, receipts, cards, serials and ledger history. Re-enabling v2 for new purchases requires its own reviewed disclosure decision.
- Real payments, cash redemption, withdrawals, prizes and public registration remain disabled. Additional recurring cost $0. No messages/invitations. Physical S24 verification remains pending; this release does not claim a hosted transactional purchase test.
