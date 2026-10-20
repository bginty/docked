# Test Wallet and member cleanup — 20 October 2026

## Scope and causes

- The carry-forward banner ignored the confirmed entry. It now distinguishes a carried draft, a confirmed entry and unsaved edits without submitting anything.
- Missing score values were labelled as missing statistics even before kickoff. The private standings projection now includes each selected player's matching fixtures, and shared presentation uses fixture timing/status. Live read-only inspection matched all 21 Week 7 selections to fixtures (7 All-Star, 14 Traditional). No score, source statistic, entry or locked snapshot is rewritten.
- Marketplace reused the last tab's response while fetching the next one. Responses/errors are now keyed to the selected query, with existing generation guards. Initial requests show skeletons; background refresh retains content. Server-rendered collection and pack inventories already receive their initial data together; weekly packs already gate empty states on a successful response. Notifications now distinguish read failure from a successful empty inbox.
- Tiny Activity cards inherited minimum text/badge sizes from the full card renderer. A stable 300 × 450 canonical face is scaled as a whole, preserving the badge, multiplier, frame, serial and brand.
- Pack wrappers mixed responsive widths, automatic heights and mobile typography overrides. A shared width variable drives both dimensions; compact typography fits inside the wrapper. Family, weekly, opening and history wrappers retain their proportions. Product-family disclosures now follow the tiles at full width.
- Original Starter Pack history fetched the full fantasy state just to retrieve one receipt and offered no retry. It now uses a narrow authenticated read-only receipt route and explicit empty/error/retry states. No replacement cards are created.
- Test Wallet follows the supplied desktop/mobile mockup: real available/reserved balances, no cash-equivalent hero, six shared-navigation shortcuts, and one initially closed transaction-history disclosure. History is newest first with Load More; immutable receipts supply sale gross/fee/net. Raw references/reasons remain behind transaction details. The owner report remains available in a separate disclosure. The default wallet no longer embeds the shop.
- Page titles distinguish Rankings, Notifications, Announcements, Test Wallet and Packs, retaining existing routes and navigation grouping.

## Seller notifications and push configuration

In-app notices now use the existing immutable sale-outbox receipt for readable card identity and historical gross/fee/net values. Existing notification titles, transactions and ledger entries are not rewritten.

Web push implementation includes explicit device opt-in, denied/unsupported guidance, authenticated ownership-bound subscriptions, browser-provider endpoint validation, RLS-protected tables, a per-sale/per-subscription outbox, leased worker claims, bounded retries, expired subscription retirement, minimal authenticated receipt links and persistent service-worker deduplication. Delivery happens independently after settlement. No real account preference, subscription or notification was changed for testing.

**Live device delivery is not verified or enabled by this release.** The inspected live deployment has no push/VAPID/cron configuration keys. Its existing `docked-sale-receipts` job runs every minute and delivers in-app notices only.

Required configuration before enabling device delivery:

1. Generate one durable VAPID pair using `web-push.generateVAPIDKeys()` and store `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT` (an owner-approved support contact or site URL) as server environment settings. Never expose the private key to a client bundle.
2. Supply `WEB_PUSH_WORKER_DATABASE_URL` using the restricted `docked_nfl_worker` role and TLS, plus a strong `CRON_SECRET`. No service-role key is needed.
3. Schedule authenticated GET `/api/notifications/sale-push-worker` with `Authorization: Bearer <CRON_SECRET>` through an existing supported scheduler. Supabase Cron is available. A Vault-backed pg_net example is supplied in `scripts/sale-push-scheduler.sql`; it refuses setup until the Vault secret exists. Do not add a paid scheduling service.
4. Set `DOCKED_WEB_PUSH_ENABLED=true` only after configuration and scheduler checks. On an isolated consenting test device, opt in and verify a completed isolated sale, retry deduplication, authenticated receipt destination and permission denial. Do not send fixtures to real members. Observe a genuine scheduled execution before claiming background delivery.
5. Monitor `sale_push_deliveries` status/attempts/last_error. Claims recover after five minutes; failures back off, with a terminal `failed` status after 12 attempts. After fixing a provider/configuration fault, an authorised operator can requeue failed rows; stable delivery IDs remain unchanged. In-app notices remain independent.

Web Push follows the [web-push library API](https://github.com/web-push-libs/web-push) and [browser subscription API](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).

## Validation and evidence

- Platform regression: 506/506 pass on the first full run.
- Database regression: 189/189 pass on the first full run; new migration applied to isolated PostgreSQL fixtures. Additional rerun of the integrated test passed after stricter subscription-key validation.
- Marketplace browser flow passed with two isolated accounts: listing, visibility, repricing, removal, recovery, purchase, ownership, historical fees, responsive layouts and accessibility.
- Wallet/thumbnail browser checks cover 360, 412, 1024 and 1440 pixels, full canonical cards across all rarities, long names, keyboard accordion, true pack aspect ratios and starter empty/error/retry states. No serious/critical wallet axe violations.
- Pack browser purchase/open/replay/lost-response/reduced-motion checks pass at 1440/1024/412/360. Initial attempts exposed stale test button names and a missing Profile install-slot fixture; these test adapters/selectors were updated to the existing production interface without removing assertions.
- Weekly starter-pack browser journey passed after updating the dedicated receipt-route fixture and the existing balance-refresh error wording. It verifies opening, recovery, replay, accumulating packs, countdown resynchronisation, global balance updates and install controls. Final evidence: `docs/qa/weekly-core/browser-1792456724244`.
- Final typecheck, lint, production build and existing client-boundary scan passed. No credential canaries were injected into this local build. A final database integration rerun also passed after making the subscription upsert ownership-conditional under concurrent requests.
- One initial wallet visual runner failed because axe requires an explicit browser context; corrected and rerun. Visual review also found and corrected legacy balance-font and mobile pack-font collisions before final captures.
- Physical Android/iOS devices and real push delivery were not exercised. Browser layouts and installed-app-related safe-area/shared navigation styles were checked through isolated fixtures; do not equate this with a physical device push test.
- Final Rankings row status now reuses fixture-based wording too. The Play/picker/Rankings browser journey passed at four viewports after correcting its obsolete “Standings” heading expectation. Shared status tests, lint and a fresh production build passed after this final display change.

Screenshots in `docs/qa/member-cleanup/`: wallet collapsed/expanded at each width, Activity before/after and pack-history before/after. Before images use the prior committed renderer/CSS (`fddd6ff5`), with identical isolated records. No real member balances are used in these captures.

## Migration and recovery

`20261020001039_member_cleanup_read_models.sql` replaces only the standings read projection and adds private sale-receipt/subscription/delivery functions and tables. It does not issue packs, change scores, rewrite entries, debit credits, publish listings or send pushes. Reapplying it cannot enqueue historical sales. Existing ledgers and ownership remain authoritative.

Rollback the web deployment to `dpl_5D5ixunTWgMxS9qpNU2DNWX38rtJ` (source `5444866442f674195860d5334a1e3266238136da`) if required. Added tables may remain safely disabled; do not drop receipts, subscriptions or delivery history. Remove/disable any future push scheduler separately if delivery is activated later. Deployment receipts and final build/check results are recorded alongside QA evidence.

Hosted boundary verification caught the new push worker under the permanently retired `/api/internal` namespace (HTTP 410). The worker moved to `/api/notifications/sale-push-worker`, retaining its bearer-secret guard. Retired APIs remain disabled. This was corrected before any push activation.
