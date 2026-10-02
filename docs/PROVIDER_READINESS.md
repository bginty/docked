# Odds and results integration readiness

No provider key was supplied or used. No request was made to a paid odds endpoint, no plan purchased and no results website scraped. Current state: `ODDS_PROVIDER_STATUS=NOT_CONFIGURED` and `RESULTS_PROVIDER_STATUS=NOT_CONFIGURED`.

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
