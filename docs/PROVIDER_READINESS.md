# Odds and results integration readiness

## Key storage update — 4 October 2026

The owner supplied `THE_ODDS_API_KEY` in Vercel's sensitive Preview environment. Metadata confirmed its presence without retrieving its value. `MARKET_DATA_POLLING_ENABLED=false` is explicitly configured and verified for Docked Preview. The key has not been tested against the supplier, copied into production or used for any request. Current market data has no selected/approved provider configuration; results remain unconfigured. The accepted stable Preview deployment predates this storage change. Storing a key does not approve display/retention rights, a request budget or strategy validation. [Configuration receipt](qa/production/preview-polling-closed.json).

## Phase 5 current market-data path

`MARKET_DATA_STATUS` is separate from legacy publication odds and results status. Both provider keys were absent during Phase 5 implementation; no feed was activated and no provider endpoint was called. The admin data-health page shows each purpose separately, including the new scanner candidate count. A configured key alone cannot establish reviewed rights or healthy data.

`src/providers/market-data.ts` discovers current provider-scoped fixtures, then reuses the existing complete-market validators. It supports bounded EPL/La Liga/NBA catalogues and NFL fixture facts; NFL cannot enter the unchanged pricing/settlement strategy. Exact competition, participant and provider IDs replace fuzzy matching. OddsPapi requires reviewed sport, tournament, market and outcome-ID mappings. Fixture `updatedAt` is not a price timestamp; missing source observations and old price-change times are never relabelled fresh.

Polling requires `MARKET_DATA_POLLING_ENABLED=true`, a supported `MARKET_DATA_PROVIDER`, exact `MARKET_DATA_PROJECT_REF`, the reviewed HTTPS origin/Preview target/database binding, an immutable current `private.market_data_config` approval and its monthly budget. Legacy publication, paper, sending and odds polling stay false. `THE_ODDS_API_KEY` is preferred; the legacy importer/trial accepts `ODDS_API_KEY`, refusing conflicting aliases. Hosted market-data mode forbids the old key/path. OddsPapi uses `ODDSPAPI_API_KEY`. None may use `NEXT_PUBLIC_`.

A modern key may be stored without enabling polling only when `MARKET_DATA_POLLING_ENABLED=false` is explicit and the deployment has the reviewed Preview origin/target and exact Supabase/database binding. Supplied Vercel/provider project identifiers must match; missing or malformed polling flags with a key fail closed. Storage grants no rights, budget, scanner or publication authority. With no selected provider, current-data readiness remains NOT_CONFIGURED; with a selected provider and polling off it is DISABLED. The legacy odds path remains PENDING_RIGHTS without its separate rights record. Regression checks invoke the actual importer with fictional stored keys and verify zero database and network calls.

Every actual request reserves conservative cost in `provider_poll_runs` before I/O under a session advisory lock. Failures remain charged; known balances decrement and missing balances stay null. A reviewed local budget is required even with unknown supplier balance. The Odds API forecast uses region count; OddsPapi discovery and each fixture odds request cost one. Request caps, timeouts, redirect refusal and an 8 MB response bound limit each run. No automatic account/quota request is made.

Raw responses live privately in PostgreSQL with receipt-aware hashes and expiry capped by both reviewed retention and rights expiry. `purgeExpiredMarketData()` and `--purge-expired` delete expired raw bodies in bounded batches even when polling is disabled. Canonical observations retain hashes/provenance. The retention worker must remain scheduled before activation. Repeated identical payloads retain distinct genuine receipts. Changed mappings/start times move canonical events to manual review; terminal/review events never silently reactivate.

Snapshots carry `evidence=market_data`, not paper/live publication. Reference eligibility still requires independent source classification, ownership, regional permission, licence, timestamps and health. Default classification is `UNKNOWN_REVIEW`. An affirmative standard-price configuration requires reviewed endpoint/source evidence plus matching independent database approval; bookmaker names, prices, plans and HTTP success are insufficient. Neither existing provider schema universally proves each price non-promotional, so no positive configuration is supplied.

`monitoredMarkets` and `GET /api/market-data` expose bounded fixture facts with optional availability references. They require distinct current `market_data` regional approval; social tester grants never qualify. No model probability/fair price/EV is exposed. Missing cohorts mean null references; missing keys mean `NOT_CONFIGURED`; absent approval means `DISABLED`; outages/stale data mean `UNAVAILABLE`.

Authorised editors can inspect an optional deterministic draft at `/api/admin/market-data-editorial?window=weekend`, linked from data health. It retains event IDs, observation time, provider, configuration version/hash and displayed subset count. Its count explicitly describes only the bounded fetched subset, never provider-wide coverage. Missing evidence returns no draft. This read-only aid neither saves nor publishes; the existing CMS revision, approval and correction controls remain required. New market-data configuration, raw, fixture and model-identity hashes use the Phase 5 UTF-8/normalized-number serializer, with SQL parity tests; legacy strategy/reference hashes remain unchanged.

Prepared operator workflows, not activated:

```powershell
node --conditions=react-server --import tsx scripts/market-data.ts --status
node --conditions=react-server --import tsx scripts/market-data.ts --sync-authorised-preview
node --conditions=react-server --import tsx scripts/market-data.ts --purge-expired
```

Parser contracts were checked against [The Odds API V4 docs](https://the-odds-api.com/liveapi/guides/v4/), [OddsPapi fixtures](https://oddspapi.io/en/docs/get-fixtures), [OddsPapi current odds](https://oddspapi.io/en/docs/get-odds) and [OddsPapi quota semantics](https://oddspapi.io/en/docs/requests-and-quota). This review does not establish supplier rights or activate a feed.

At the original Phase 5 acceptance, no provider key was supplied or used: `ODDS_PROVIDER_STATUS=NOT_CONFIGURED` and `RESULTS_PROVIDER_STATUS=NOT_CONFIGURED`. No request was made to a paid odds endpoint, no plan purchased and no results website scraped. The later key-storage update above does not activate any feed.

## The Odds API

The adapter uses the official `api.the-odds-api.com/v4` current and historical endpoints, requesting decimal `h2h` only. It validates sport key, canonical competition, event identity, exact participant set, commencement instant, mapped full-game rules, bookmaker key and approved independent operator group. Timestamp formatting differences such as `Z` versus `.000Z` no longer reject the same event. Duplicate events, books, market keys or outcome names fail closed. Unknown identity/operator, stale/future markets and incomplete/implausible price vectors are rejected with diagnostics.

`OddsFetchResult` retains raw private payload, source timestamps in each quote, provider snapshot timestamp, local receipt, deterministic historical snapshot identifier, quota headers and data-health diagnostics. Diagnostics include events and parsed markets received, valid/rejected/stale markets, mapping failures, oldest observed source age and stable error codes. Counts describe received/parsed objects, not provider-wide coverage. Missing quota headers remain `null`, never zero. Current and historical prices never imply authorised outcomes.

Activation requires the Docked-specific `ODDS_API_KEY`, explicit `ODDS_POLLING_ENABLED`, `ODDS_REGIONS`, reviewed source rights/capabilities, canonical event mappings, region-effective eligible bookmakers and documented operator ownership. Historic ownership must be valid for the historic snapshot; do not project current ownership into earlier years. No bookmaker ownership is inferred from names.

Prospective evaluation, publication, dispatch and price observation recheck every offer and reference against current approvals. A fresh snapshot's former `approved` flag cannot override a revoked/expired source, changed operator ownership or conflicting ownership entries. Reference sources require current permission in at least one reviewed tips region; the offered bookmaker separately requires the exact publication/recipient region. Publication holds approval-row share locks while writing its immutable record.

The adapter forecasts one credit per region/current market or ten per historical market, reserves before a request, rejects concurrent per-instance calls, and blocks when available quota is unknown or insufficient. It synchronises authoritative non-negative integer quota headers; failures do not refund an assumed cost. Cross-process ingestion additionally needs a shared database lease/reservation and an independent monthly budget. The health screen exposes both known values and unknown state. Forecast inputs reject zero/negative/invalid intervals. These controls do not constitute a billing cap enforced by the supplier.

The ingestion implementation reserves its independent monthly budget and decrements any known provider balance in the same committed transaction before making the network call. A failed or interrupted request retains that debit; unknown provider balance remains null. It serialises polls with a session advisory lock. When initial provider quota is unknown, only the explicitly configured independent local budget can authorise the initial request; missing headers never become an invented provider balance.

Because that lock is tied to a database session, ingestion requires explicit `DATABASE_CONNECTION_MODE=direct` or `session`. A transaction-pooler connection cannot satisfy this guarantee and polling fails closed when its mode is missing/unsupported. Operators must verify the connection endpoint actually matches the declared mode. Price collection alone does not authorise decisions: `evaluateDue`, publication, dispatch and monitoring require the frozen strategy code commit to match verified `DOCKED_CODE_COMMIT` for a local build or platform-provided `VERCEL_GIT_COMMIT_SHA`. Unknown/mismatched code provenance prevents new strategy decisions and public dispatch; licensed raw collection can remain separate.

Official endpoint, quota and snapshot semantics were checked on 2 October 2026: [The Odds API V4 documentation](https://the-odds-api.com/liveapi/guides/v4/). Display, retention, derived publication and commercial rights require separate contract review before activation.

## Separate sporting outcomes

`ResultsProvider` exposes status and authorisation independently. `PendingResultsProvider` returns null. `AuthorisedResultsImport` is a canonical-file adapter for a reviewed supplier export: it requires a provider ID, rights reference, reviewer, exact input hash and explicit event allowlist. It performs no network requests and does not assert any supplier is licensed.

Records support final result, cancellation, postponement, rescheduling, abandonment, disputed/manual review, explicit void, source revision and correction references. Rule identity includes regulation/overtime/draw treatment. Final scores must contain exactly the two canonical participants. An NBA tie remains disputed; a regulation football tie is a draw. Cancellation/postponement/rescheduling/abandonment remain pending until authorised settlement instructions resolve them. A void requires an explicit reviewed reason and settlement basis.

Corrections retain all earlier revisions and must form an unambiguous supersession chain. The adapter returns the latest matching revision; it never rewrites a ledger result. Server settlement must append a correction linked to the previous event and record actor, reason and evidence. No outcomes can be guessed from historical odds, missing source responses or event dates.

To activate later, supply a Docked-authorised results supplier/export contract, exact market settlement definitions, event-ID mapping, coverage/resolution, revision policy and retention terms. Review a private canonical sample first. The adapter is ready for that sample, but no automatic settlement supplier is configured and no real settlement has occurred.
