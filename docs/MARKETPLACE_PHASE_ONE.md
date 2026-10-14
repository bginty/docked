> 14 October continuation: [Local operational acceptance](MARKETPLACE_OPERATIONAL_ACCEPTANCE.md) supersedes the PostgreSQL-unavailable gate below. Real multi-connection PostgreSQL now passes; genuine HTTP/Auth integration remains blocked by the documented Docker socket crash. No hosted release.

# Phase 1 NFL marketplace — local implementation

14 October 2026. LOCAL ONLY: no deployment, hosted migration, member transaction or messages are authorised in this milestone.

## Audit

Starting branch: `pivot/fantasy-cards-preview-v1`, base `bb798cec`. Implementation commit: `ed8bc02c`. Changes are committed locally only; no push/merge/deployment. See `qa/marketplace-phase-one/changed-files.txt` for the exact file inventory.

Next.js App Router uses admitted server identity; owner access additionally requires AAL2. `/fantasy/market` currently selects the free-swap screen, while fixed-price sales live in the test-wallet component. The financial test aggregate, immutable journal/history and CreditsSandboxStore already implement credit settlement under PostgreSQL advisory lock 71820342. Competition mutations use the same lock. Preserve that infrastructure.

Credit buys already validate price/policy, ownership version and spendable FIFO lots, then debit, book 7.5% whole-credit half-up commission and transfer atomically. Actor/request fingerprints prevent replay with different payloads. Missing pieces: durable fresh purchase review, bounded marketplace projection, listing/swap reservation symmetry, immutable sale receipt fields and explicit market UI.

Both swap UIs display stored status without applying expiry. Both acceptance paths already reject expired offers. This establishes a display defect, not an observed illicit transfer. The older free-swap SQL has no expired terminal state; prepare an additive lifecycle migration. Financial swaps use effective reservations (no cash reserve at offer); expiry must release only that offer's claim and retain history.

Existing competition transfer guard protects unlocked submitted cards in either mode and preserves locked entitlements. Listing creation needs the same check. Entry inventory already excludes open listings; add active swap reservations symmetrically. Core cards belong to the free inventory and are not sellable for credits. Do not copy them into the financial aggregate.

The previous Market loading symptom cannot be diagnosed from source alone. Existing bounded reads and identity guards will be retained; local failure/recovery tests will exercise the new view. No hosted account or expired offer is modified to reproduce it.

Implementation and evidence follow below when verified.

## Implemented locally

- `/fantasy/market`: Browse, My Listings, Activity, Swaps. Shared Docked artwork/dialogs. Packs, Wallet and the combined collection remain linked; listing/purchase UI removed from Wallet. Original GET wallet/pack/collection anchors remain safe; no POST redirects.
- Server-side filters: player, team, canonical position, rarity, price range, seven-position utility, selected round, fresh active roster and own listings. Cursor pages use a unique listing-ID tie-breaker and reject a changed filter signature. Maximum 40 rows; owned-card selection separately paginated at 40. The current small-beta aggregate is read once server-side; this is not a new SQL marketplace table/index or a claim of large-scale query efficiency.
- Fresh five-minute purchase review stored in existing actor/request history. A member purchase requires that review. Server values bind exact card, ownership version, price and policy. Confirmation is idempotent; failed/expired terms require fresh consent. The UI retains uncertain request identity across reload; it does not automatically issue another purchase.
- One existing credit transaction debits the buyer, credits seller proceeds, posts commission and transfers ownership. New sale receipts store original amounts. Historical receipts are projected from the immutable journal without changing them. 7.5% seller commission uses the existing centralized integer half-up calculation: 100 → 92 seller + 8 commission; 1,000 → 925 seller + 75 commission. No buyer surcharge. Fantasy salaries never debit credits.
- Cancel/relist only. Seller-only cancellation, repeat-safe cancelled state, sold-state rejection. No new listing expiry scheme.
- Active financial swap offers reserve both cards effectively; overlapping offers/listings/entry selection are rejected. Existing offered listed cards remain visible but cannot be bought while reserved. Expiry and cancellation release only their claim; expired records remain. This changes the old test that deliberately allowed overlapping offers; historical overlapping offers require cancellation/expiry rather than silent rewriting.
- Both free and financial swap screens apply expiry using the server observation plus elapsed time. Financial acceptance already rejected expired offers; its existing `expire-swap` command can now also be invoked by an involved participant. Free-card expiry gets an additive terminal state and exactly-once audit event on an authenticated read. No card or ledger transfer occurs at expiry. Free beta swaps retain their existing free policy; financial swap fees/free-window consent remain unchanged.
- Listing/offer creation and transfer share lock 71820342 with team submissions. Unlocked submitted cards in either mode block transfers; draft-only references do not. Individually locked snapshots survive transfer. No entry/card is automatically rewritten.
- Core cards are never copied into the credit economy or offered for credit sale. Existing free-card transfer permissions stay on their original path. K/DEF/DST cards show collectible-only seven-player utility; no future utility promised. Injury/matchup facts are not invented; available mapped fixture time is shown, unknown facts say unavailable.
- Read failures have bounded loading and retry. Query generations reject stale reads; member identity mismatches clear the view. Review/listing/cancel use accessible sheets, explicit confirmation and exact instance identity. The selector retains unsent card/price state. Filters survive URL refresh. New UI uses no new dependencies.
- Optional server-only `DOCKED_TEST_MARKET_READ_ONLY=true` pauses new listings, buys, offers and acceptances for reviewed maintenance; cancellation/expiry/read history remain available. Default behavior is unchanged unless an operator explicitly sets it. This setting was NOT applied to hosting.

## Findings and limits

| Finding | Evidence and outcome |
|---|---|
| Disconnected Market/Wallet | Reproduced in source routing; replaced by primary Market with reused credit services and separate free-swap panel. |
| Expired offer still pending | Both UIs trusted stored status. Existing server acceptance rejected expired offers. Local UI and SQL expiry/audit verification pass. The reported hosted offer was not inspected or changed. |
| Market loading failed then refreshed | Original incident root cause remains unconfirmed. Market previously awaited the full fantasy read before fetching swaps. The new Market avoids that unrelated read and adds tested failure/recovery and wrong-account protection. This is recovery evidence, not a diagnosis of Barry’s past session/network. |
| Concurrency | Embedded PGlite serializes competing operations from DISTINCT buyer actors. Rollback, cancellation/purchase, swap/purchase and seven-command/purchase scenarios pass. This is NOT a multi-connection PostgreSQL concurrency test. Docker Desktop's Linux engine pipe is absent; no native postgres/psql executable is available. Shared advisory locking still requires verification on a real local/test PostgreSQL server. |
| Authentication | Existing auth/admission/MFA paths retained. Local SQL/RLS regressions use controlled auth fixtures; browser tests use synthetic local identities. These are NOT authenticated HTTP/database end-to-end acceptance. No live Supabase login/refresh was performed for this local-only task. |
| Live NFL fixtures/injuries | Existing mapping is reused and fails honestly when absent. The review fixture intentionally has no external sports feed. No new scoring/data claims. |

## Local review

Run `node --import tsx scripts/marketplace-local.ts --serve`, then open `http://127.0.0.1:3023/fantasy/market`.
This runs the actual Market component, existing credit engine and marketplace projection with clearly labelled synthetic accounts/in-memory state. It reads no `.env` or credentials and does not connect to hosted services. Restart resets only this disposable fixture. The default local actor is Alice; automated acceptance separately exercises Bob. Use `node --import tsx scripts/marketplace-local.ts` for the two-user browser acceptance.

Screenshots contain synthetic data only:

| View | Mobile | Desktop |
|---|---|---|
| Browse | [Mobile](qa/marketplace-phase-one/browse-mobile.png) | [Desktop](qa/marketplace-phase-one/browse-desktop.png) |
| Sell Review | [Mobile](qa/marketplace-phase-one/sell-review-mobile.png) | [Desktop](qa/marketplace-phase-one/sell-review-desktop.png) |
| Purchase Review | [Mobile](qa/marketplace-phase-one/purchase-review-mobile.png) | [Desktop](qa/marketplace-phase-one/purchase-review-desktop.png) |
| Activity | [Mobile](qa/marketplace-phase-one/activity-mobile.png) | [Desktop](qa/marketplace-phase-one/activity-desktop.png) |

Physical Samsung S24 and owner visual approval remain pending. Review on S24 later: sign in as an admitted ordinary member, Browse → card details → review, My Listings → review/cancel, Activity filters, background/reopen and uncertain-request recovery. Perform mutations only with designated QA assets after the separate deployment approval.

## Barry's additional requirements

| Requirement | Implemented / evidence |
|---|---|
| Salary and statistics | Salary derives from the selected round's saved configuration, or explicitly identified current seven-player test configuration when no round is selected. Missing configuration yields **Unavailable**, not zero. Separate asking price in Docked Credits. Open has no cap. No uncontextualised statistical score is generated; details link to sourced round results and selected competition rules. |
| Collection / selling | Collection's owned-card detail links to Sell Card / Listed. The URL selects the existing owned card and correct inventory page. Free/Core or unrecognised economy cards get an explanation, never copied/minted assets. My Listings permits inspecting ineligible cards but disables confirming a new listing for them. |
| Reservation privacy | Server-only context selects the authenticated owner's competition name, slot and withdrawal-window state. Only the actual current owner receives these details; Play links lead to replace or permitted withdrawal. All other viewers receive only a generic restriction. Other entries' names/slots are not projected. |
| Confirmation / cancellation | Separate Listed, Purchased, Cancelled confirmations, direct listing link, explicit cancel review and cancel/relist price-change guidance. A sold race refreshes the listing and exposes its receipt only to the buyer/seller. Closed historical listings remain immutable. New cancellation timestamps are additive; unknown old timestamps stay unavailable. |
| Activity | Purchases, sales, cancellations, credit-swap and free-swap terminal outcomes; type filter and bounded pages. Values come from original receipts/journal or existing events. No wallet posting for cancellation, rejection, expiry or free swaps. Private counterpart identities are not projected. |
| Rejections / uncertainty | Exact credit shortfall without cash funding suggestion. Sold/cancelled/stale/reserved messages where the backend can establish them. Definitive rejection drops old consent and rereads authoritative details; truncated/unknown outcomes preserve the original operation ID and prohibit a new mutation until recovered. |
| Keyboard / mobile | Enter, repeated Tab containment, Escape and return focus verified. A focus escape discovered during testing was fixed in the shared sheet. Eight requested screenshots, 360/412/1440 page overflow checks, reduced motion and automated accessibility checks. |
| Transactions / history | Two DISTINCT buyers; fault injected after journal/state writes rolls back; cancellation/buy and swap-accept/buy produce no partial transfer; actual seven-command with explicit local auth/inventory adapters rejects listed or lost-ownership cards against purchase. Permanent instances/serials/supply and locked snapshots compare unchanged. This does not prove real multi-connection lock contention or genuine authenticated sessions. |

The authoritative free-swap SQL read keeps expired/cancelled/rejected history and reports actual terminal state. Effective expiry may be derived from the saved expiry timestamp even before cleanup. It is not falsely described as a completed trade or wallet charge.


## Verification

- Final platform suite: **338/338 passed**. The earlier sandbox-only temporary-Git permission failures were resolved by running these local fixture tests with filesystem permission; the final full run has no failures.
- Final database suite: **152/152 passed**, including additive migration application and controlled-auth RLS checks in embedded PGlite.
- Earlier focused suite: 29/29 passed. Additional targeted marketplace suite: 8/8 passed; the expanded competition-entry/purchase SQL scenario subsequently passed and is included in the final full database run.
- Browser: actual components + engine, local synthetic HTTP transport. Create listing → fresh review → 1,000/925/75 sale → deliberately truncated successful response → reload → original receipt recovery → activity. Filter refresh/clear, HTTP failure, expired-session and wrong-account read handling, expired offer, 360/412/1440 width, no horizontal overflow, axe WCAG A/AA and no console exceptions pass.
- Typecheck/lint and production web build: run receipts in `qa/marketplace-phase-one`. Windows build initially failed to create a junction; the same local build passed outside the sandbox. Client-boundary marker scan passes; it is a marker check, not proof of every possible credential pattern.
- No new scoring rules, supply allocations or pack configurations. Existing pack/rarity/scoring regressions included. No APK/native changes. Installed v22 would receive these web changes only AFTER a later authorised deployment; it does not receive this local branch now.

## Migration, compatibility and later reviewed deployment

Prepared migration: `supabase/migrations/20261014021342_marketplace_phase_one_guards.sql`. No hosted application or migration occurred.

1. Obtain a separate review/release decision for the exact commit. Save the existing hosted deployment, state revision, function definitions and verified backups using the established operator workflow; do not export private records into Git.
2. Run the prepared `qa/marketplace-phase-one/preflight.sql` read-only. Resolve any active duplicate listings, owner/version mismatch or malformed price by a separately reviewed corrective transaction; never delete/rewrite past receipts or ownership. Existing overlapping unexpired financial swaps need cancellation or natural expiry before their cards can transact. Missing old embedded receipts are expected and use journal projection.
3. Coordinate a short test-market write pause using the new read-only control in a reviewed compatibility deployment. Apply the prepared migration to the existing isolated test DB with the established migration runner. Do not apply it to a separate commercial economy. No destructive data migration or backfill is included.
4. Deploy the exact reviewed candidate using the existing Vercel project workflow. Keep all real-money, public-admission, prizes and withdrawals flags off. Use dedicated authorised hosted QA accounts to verify auth/MFA, listing/quote/buy/cancel/swap/RLS, both-mode entry reservation and exact-kickoff behavior before removing the pause.
5. Compare protected member holdings/balances and aggregate history against the saved baseline, accounting only for labelled QA operations. Reopen existing installed v22 and inspect the Market route; rebuild only if a native/configuration change is separately required.

Rollback: prefer a forward repair. First pause new market writes; preserve reads, cancellations and all completed receipts/transfers. Do NOT restore an old aggregate over completed transactions, truncate data, remove the `expired` status, or roll the server back to a version unable to preserve new receipts. A UI rollback must retain the compatible service/guard and expiry schema. The new wrappers retain their `before_marketplace` implementations for inspection, but switching to them requires review and cannot discard terminal history. No rollback SQL has been executed.

Explicit boundaries: no hosted/production changes; no real payments/payouts; no member balances/cards/teams altered; no messages or invitations sent. Local fixture balances and cards are synthetic only. Deployment/hosted acceptance are the remaining release steps, not claims made by this local milestone.


## Remaining acceptance gates — not passed by this local milestone

1. Run the prepared migration and real **multi-connection** race suite against a disposable PostgreSQL instance. On this machine Docker's engine is stopped (`dockerDesktopLinuxEngine` pipe absent); postgres/psql are not installed on PATH. PGlite's serialized transactions do not exercise blocking/deadlocks between server connections.
2. Verify the actual application HTTP → Supabase session/admission/MFA → database path with dedicated QA identities, including expiry/refresh, counterparty revocation and both sides of sale/swap/entry races. This task deliberately used no hosted credentials or member operations. Browser synthetic cookie identities are NOT this evidence.
3. Review the migration, compatibility pause/rollback and any preflight exceptions, then obtain separate hosted-test release approval. No release is implied by local passes.
4. Physical S24 and owner visual review remain pending. No APK was rebuilt, and the current hosted app/APK is unchanged. A later web-only release should reach connected v22 without reinstalling; verify that environment binding during the separate release.

No missing information is needed from Barry or the owner to finish this local implementation. Starting a disposable PostgreSQL service and providing isolated auth integration infrastructure are the specific remaining verification dependencies; neither authorises hosted changes.
