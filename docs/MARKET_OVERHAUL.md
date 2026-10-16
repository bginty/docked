# Marketplace, privacy and portfolio valuation — owner review

Implemented locally on the existing beta branch. No hosted migration, deployment, feature activation or member-asset mutation was performed. All transaction and browser mutations used isolated loopback QA accounts.

## What changed

- Market has prominent **Sell / Swap** and **Buy / Browse** actions. Browse excludes the member's own listings; listing selection opens their eligible inventory with search, filters and paging. One confirmation sheet supports credit sale, swap offers, or both. Editing atomically cancels/replaces immutable listing terms; old offers cannot settle against changed terms.
- Buyers propose credits, one eligible card, or a card plus credits. Sellers review the exact cards, counterpart, expiry and fee before acceptance. Decline/cancel and durable idempotent retry remain available. No counteroffer or multi-card settlement was enabled.
- The existing wallet journal, ownership versions, supply records, reservation checks and PostgreSQL transaction/advisory lock remain authoritative. Both cards and any credit component settle together. No second ledger was created.
- Existing notification mute, global/per-card offer preferences, follower restrictions, blocking, minimum credits, cooldown, duplicate and expiry checks remain server-enforced. The credit minimum applies only to the credit component.
- New-account collection onboarding discloses the admitted-member default with an opt-out. Existing private collections remain private; changing them requires an explicit acknowledgement. Owners can hide/show all or selected cards. Visibility does not authorise purchase. Deliberate card-post snapshots retain their original post audience.
- Collection filtering is shared by profile, market, legacy-card and alternate wallet projections. Direct runtime collection calls also require a current authenticated session. Browser database roles cannot execute the privileged helpers or access the old unfiltered helper.
- Profile Teams reads only saved locked snapshots under an explicitly approved competition publication policy. It requires the server deadline and **all** configured rolling player locks to have passed. Drafts, still-editable selections, card IDs and ownership projections are excluded. The publication policy starts empty: no existing contest is opted in. EPL remains private under its existing rules.
- Cards now includes an owner-only **Estimated portfolio value** panel, coverage and methodology. It uses the last 30 days of completed public credit sales for the same player/rarity/edition. Each physical card contributes only its latest sale. At least three distinct cards, two buyers and two sellers are required. The integer median limits outlier influence. Matching journal and ownership-transfer evidence is required. Asking prices, private offers, swaps, self-sales, stale/future sales and inaccessible card records are excluded. Unpriced cards are explicitly unvalued, not worth zero. Sealed pack contents are excluded. These estimates are test credits with **no cash value**, before fees, not guaranteed prices or settlement inputs.

## Root causes repaired

1. Hosted market read-only protection was intentionally rejecting mutations, but the UI did not receive that capability and offered actions that failed only after submission. It now shows paused state and disables unavailable actions.
2. The old swap form required the counterparty and requested cards upfront. Buyer-initiated proposals now let a seller simply declare openness to swaps.
3. Credit private-offer acceptance tried to create a second active listing and failed with “Already listed.” The replacement flow closes the original inside the same atomic settlement and retains both histories.
4. Alternate wallet/listing projections needed the same per-card privacy filter. Privacy and aggregate reads now share the transaction lock.
5. Browser review found URL-dependent server/client initial state giving Market the wrong selected tab. The initial render is now stable and the URL is read after mounting. Shared offer styling was moved to the stylesheet actually loaded by profiles; paired cards align side by side.

## Approved combined fee

Owner instruction, 16 October 2026: **max(7.5% of credits, existing per-member swap-fee quote)**. Existing whole-credit half-up rounding applies. This fee is deducted once from the seller's credit proceeds; no additional swap fee is charged for the combined transaction and the exchanged card has no invented credit value. The credit component must cover the disclosed fee. Terms are snapshotted and rechecked before acceptance. Pure credit sales and pure swaps retain their existing rules. This fee approval does not activate hosted trading.

## Files and migrations

Core: `credits-policy.ts`, `credits-sandbox.ts`, `private-card-offers.ts`, `marketplace.ts`, `member-test-wallet.ts`, new `portfolio-valuation.ts`, and social preference schemas.

Server: corresponding wallet/market/offer/social services; new `market-visibility.ts` and `lineup-privacy.ts`; existing API routes.

UI: Market, private offers, profile, social settings/onboarding, collection wallet hook, new portfolio summary, and shared Market/Social CSS.

Apply these migrations **in order**, only to an approved isolated environment after backup/review:

1. `20261016022724_market_offers_collection_privacy.sql`: listing preferences, immutable offer guard, collection helpers/preferences, locked-lineup publication policy.
2. `20261016030854_market_publication_alias_fix.sql`: disambiguates the saved-slot JSON alias.
3. `20261016032317_market_collection_session_guard.sql`: preserves the active-session boundary on the new projection, including owner reads.

They do not rewrite assets, historical receipts, balances or existing visibility choices. No publication policy rows are inserted. Preserve a database backup and application revision before applying; do not drop histories as a rollback. The local full migration chain was exercised in database tests and the isolated PostgreSQL harness.

## Verification and evidence

Evidence directory: `qa/market-overhaul/`.

- Full platform regression: **397/397 passed** (`platform-full.txt`), including existing fantasy, packs, ownership, wallet and security cases.
- Full database regression: first run **155/159**, with four failures from the explicit security-definer allowlist. After reviewing and listing the three intended helpers, an uninterrupted rerun passed **159/159** (`database-full-final.txt`). No broad allowlist exemption was added.
- Session-boundary follow-up: **31/31 passed** (`session-guard-regressions.txt`). Final focused tests including expired-session reads, repeated offered-card use, cancellation/acceptance, fees and portfolio valuation: **32/32 passed** (`final-focused-retry.txt`). This followed one test expectation correction: cancelling an already closed swap listing is an existing safe no-op, not an exception; it leaves cards and journal unchanged.
- Actual local GoTrue + restricted PostgreSQL + Next HTTP: seven completed groups verify all three offer structures, duplicate concurrent acceptance, two competing buyers, immutable edits/cancellation, global/per-card privacy and alternate API denial, existing-user consent, tester admission and owner AAL1 denial. `http-completed-browser-timeout.json` records those passed groups and the following browser cold-compile timeout. It is **not** an uninterrupted combined-suite pass.
- Separate PostgreSQL fault injection after both transfer/ledger writes: rollback preserved cards, balances, commission, history, requests and aggregate revision; another connection could not observe intermediate writes (`postgres-rollback.json`).
- Browser stage was resumed separately. Signed-in local mobile/tablet/desktop screenshots and assertions cover 360/412/1024/1440 widths, no Market page overflow, listing sheet, offered-card preview/review, nested Escape cleanup, scroll restoration, offer history and portfolio coverage. Tests use actual routes and sessions. Synthetic local player metadata is labelled and does not fabricate real jersey numbers/cities.
- Clean production build and client-boundary scan: **passed**, 58 browser assets checked with build-time canary credentials absent. Typecheck and lint passed; final logs are retained.
- Nine heuristic secret findings remain in the raw scan, so this is **not a clean secret scan**. Eight are reviewed fixture/infrastructure expressions (seven unchanged; one local QA port/volume generator). The ninth is the old untracked APK capability, previously documented as revoked; it was not used, printed, staged or reverified here. See `secret-review.json`. No exclusions were added.

Earlier failed fixture attempts, SQL alias failure, security allowlist failure, browser timing/locator failures and type errors remain in the evidence directory. Retries are identified rather than described as first-pass success.

## Screenshots

- [Mobile seller collection](qa/market-overhaul/screenshots/sell-412.png)
- [Mobile listing confirmation](qa/market-overhaul/screenshots/listing-412.png)
- [Card-plus-credit offer review](qa/market-overhaul/screenshots/offer-review-412.png)
- [Offer history](qa/market-overhaul/screenshots/offers-412.png)
- [Portfolio mobile](qa/market-overhaul/screenshots/portfolio-412.png)
- [Portfolio desktop](qa/market-overhaul/screenshots/portfolio-1440.png)
- [Desktop seller collection](qa/market-overhaul/screenshots/sell-1440.png)

## Preview and activation requirements

**No deployment performed.** The existing private-offer guard intentionally requires a local runtime, a loopback database, its explicit local flag, and no Vercel runtime. It was not weakened to make hosted settlement appear available. Real-money redemption, banking and document collection remain disabled.

Before hosted trading acceptance:

1. Owner transaction/policy/security approval for replacing the local-only guard with a separately reviewed, narrowly scoped hosted-beta capability. This must restrict admission to the intended testers and keep cash features disabled.
2. Fresh verification of protected Preview access and an Auth/database isolated from Production, using the existing no-public-signup infrastructure. Prior receipts are not current verification.
3. Approved target backup and ordered migration application; verify no existing private collection becomes visible. Do not change the live member balances or inventories as test data.
4. Use authorised isolated hosted QA identities for ownership/wallet/race/privacy acceptance before enabling tester settlement. Current results are local, not hosted acceptance.
5. Explicit competition publication policy approval before enabling post-lock public lineup views. Until then other members' lineups stay private.

Physical Samsung S24 acceptance remains pending: seller selection, keyboard/amount entry, nested Back dismissal, scrolling after cancellation, offer review, rotation, background/resume, and all five navigation tabs. Desktop Chromium mobile emulation is not physical-device testing. Existing NFL/EPL competition/scoring rules were not changed.
