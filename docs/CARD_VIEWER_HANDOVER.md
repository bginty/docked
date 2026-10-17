# Card viewer and player history — 17 October 2026

## Scope and release status

The viewer work is separate from marketplace activation. The owner confirmed that additional marketplace requirements are still to follow. No trading flag, payment feature, hosted database, member balance, ownership record or deployment has been changed by this work.

## Implementation

- `CollectibleViewer` is the shared modal for Cards, pack-result card details (including Weekly Core and original Starter replays and previously transferred awards), member collections, Social card posts and Market card inspection.
- The existing `CollectibleFace`, jersey renderer, collectible CSS, rarity configuration and artwork are unchanged. The front has no new visible overlay. Its transparent keyboard/touch control opens the back; the visible flip hint appears on the back only.
- Market card inspection is separate from **View listing & offers**, **Manage listing** and transaction review. Existing transaction controls remain in those workflows.
- Play retains its selection, replacement, removal, salary and lock controls above the card. The old metadata and score panels beneath the card are removed. Sell is the only below-card action.
- Sale eligibility reuses the existing authenticated marketplace inventory and transfer restrictions. Core, another owner's card, an existing listing, competition/transaction restrictions and disabled trading all disable Sell with a reason. Listing and settlement still revalidate on the server.
- `FantasySheet` retains the existing native-dialog, Escape, focus-return and scroll-lock lifecycle. Its focus trap now excludes inactive/inert card faces.

## Authoritative history

`sports_feed.card_player_history(text)` is an admitted-session-only, read-only projection in the private schema. Only `docked_beta_app` can execute it. Direct journal grants, RLS, member permissions and scoring writes are unchanged.

The projection reads the latest authorised member-feed journal revision and only the requested player's statistics. It excludes entries, owners, wallets, other players and historical acceptance streams. It follows the verified NFL provider identity bridge for older Core cards and uses the stored game identity to deduplicate competition-specific fixture IDs.

The server reuses `scorePlayer` for base centipoints. The card uses existing `rarityPoints` integer rounding for its adjusted reference. It does not mutate or recalculate stored competition results. Review-held results are withheld. Missing/pending data, DNP/bye, provisional/final scores and a genuine zero remain distinct. Averages and games played include available played results, excluding DNP/bye; provisional results are labelled and may change.

History is scoped to a selected season, newest week first, five rows per page, with internal scrolling at fixed card dimensions. It refreshes on reopening, window focus and every minute while visible. Read requests are bounded and cancelled on unmount. No licensed historical dataset is added: only existing authorised published NFL feed history is available. Players/sports without that history show an empty state rather than invented scores.

Migration: `supabase/migrations/20261017021720_collectible_player_history.sql`. It adds one guarded read function; no table or asset migration, backfill, scoring change or financial activation. It has been exercised against isolated PostgreSQL-compatible fixtures, not applied to live Supabase.

## Verification evidence

- Platform regression: 443 tests passed in the broad run; one mail-dispatch test process exited abnormally. Its separate four-test rerun passed. Both logs are retained.
- Database regression: 174 passed. The history-specific test was extended and rerun for the verified legacy identity bridge, authoritative game identity, correction revisions, denied direct table access, expired sessions, role permissions and review holds.
- Viewer browser acceptance: actual Edge/Chromium rendering at 1440, 1024, 412 and 360px; all six rarities, unchanged front markup apart from instance SVG IDs, identical front/back dimensions, keyboard flipping, Escape/focus return, pagination without flipping, repeated modal cleanup, disabled sale states and history error recovery. Axe reported zero violations in the tested dialog states.
- Screenshots: `docs/qa/card-viewer/front-*-*.png` and `back-*-*.png`; isolated illustrative data, not production scores. Screenshots were visually inspected and the inherited form spacing corrected.
- Typecheck and full lint passed. The clean production build and client-secret boundary scan passed on retry; all 63 browser assets were free of the injected server-secret canaries.
- The first clean build compiled, then its TypeScript worker ran out of memory. A fresh build directory and bounded Node heap resolved the retry without disabling any checks. Both logs are retained.
- The existing seven-context browser regression passed at all four widths, including normal-motion pack progression with zero transaction requests. Evidence: `docs/qa/futuristic-cards/browser-1792205999401/results.json`. The first run crashed in its final animated-browser phase; its failure log is retained rather than counted as a pass.
- The existing Play/picker/standings interactive browser journey also passed at all four viewports after the selection-controls change (`docs/qa/card-viewer/play-browser.txt`).
- Weekly Core and original Starter replay journeys passed at all four widths, including opening their shared card back, empty-history state, disabled sale action and Escape. Replay issued zero new cards; isolated opening issued exactly once. Evidence: `docs/qa/card-viewer/pack-history-browser.json` and the two mobile pack-history screenshots.
- The scoped staged-file secret scan passed with no findings. This does not claim that unrelated repository artifacts were scanned or cleared.

## Pending

- Additional fixed-price marketplace requirements and the resulting activation decision.
- Live migration/application deployment and genuine hosted authenticated acceptance of this new endpoint.
- Physical Samsung S24 / Samsung Internet acceptance. Desktop Chromium mobile emulation is not physical-device acceptance.
