# Edge Scanner

## Phase 5D observed state

Five independent probabilities and one abstention were retained before comparison. The predeclared research threshold is 5% estimated EV; no threshold was selected after seeing prices. Preview-only data display authority does not authorise the model-comparison jurisdiction policy, so comparison is UNAVAILABLE and no candidate or paper approval was attempted. This is not a NO EDGE result. The initial cohort has zero market API requests, zero candidates and zero official publications.

Candidate creation and approval/revalidation remain covered by isolated fixtures, not claimed as a genuine hosted end-to-end success. Manual approval cannot alter the retained probability. Results and live/paper release gates remain closed.

## Phase 5C research boundary

Approved raw-source datasets, normalized sporting inputs, research facts, match snapshots and model features remain separate records. Research snapshot creation and a recalculation assessment do not create a prediction or Candidate Edge. The current request path deliberately records MODEL_NOT_CONFIGURED/BLOCKED_DATA when no accepted sporting bundle and fitted executor exist.

Feature assessment checks only explicitly MODEL_ACTIVE definitions bound to the exact model configuration, current rights, known-at timestamps, freshness and structured evidence. Display-only H2H, trends, news, injuries and lineups cannot change Football V1. No active feature is installed. A future fitted executor must append a new prediction with the triggering research IDs and old/new lineage; it must not overwrite the earlier probability or silently change the canonical calibration cohort.

The existing scanner consumes a committed independent prediction before reading Market Reference. Phase 5C does not bypass that transaction boundary. It adds the governed upstream research interface; an operational research-to-prediction executor remains blocked on accepted model data, fitting and a reviewed prediction-revision policy. Market movement and sporting-model changes remain separate evidence. Neither a research content post nor an admin explanation can supply probability, create an Edge, or activate publication. Auto-publish remains off.

## Phase 5B independent official path

The current server path is runEdgeScan → recordFootballPrediction → evaluateFootballCandidate. The first call commits independently and accepts canonical event/model/window IDs and a worker lease, never prices or caller probabilities. Without a fitted estimator, an eligible configured scan retains NOT_CONFIGURED and abstains before price lookup.

A future registered estimator's committed prediction is reloaded with model/code/policy/region/data authority checks. One captured market source set supplies all three regulation 1X2 availability comparisons. Decimal EV and upward cent-rounded minimum prices select at most one candidate using frozen EV-desc/selection ordering. Candidate evidence retains prediction ID, full vector, input hash, model version and cutoff. Non-candidate predictions remain in calibration.

Owner/admin + MFA review compares fresh market evidence with the SAME prediction. No numerical overrides or runtime activation. Database guards independently recheck lineage, freshness, threshold, model, policy, region and one-Edge-per-event. Research approval is not publication; paper remains separate; live requires APPROVED_FOR_LIVE and creates the permanent official mapping. Auto-publication stays false. Notifications are private durable admin records and deep links, with no external delivery.

Earlier market-baseline sections describe preserved research infrastructure. Historical betting ROI is not an independent-model launch gate.


Phase 5 adds private, durable research operations. It does not activate a provider, strategy, region, public notification, paper run or live publication. A calculated estimated EV is not evidence of a profitable strategy.

## Execution and configuration

`npm run worker -- once` and authenticated `POST /api/internal/edge-scanner` share the same database job queue. The HTTP endpoint requires a dedicated 32–200 character ASCII bearer `SCANNER_WORKER_TOKEN`; it accepts neither query tokens nor member cookies as worker authority. Configure an external scheduler separately. No browser timer or Codex reminder runs this service.

`EDGE_SCANNER_ENABLED` and private `feature_flags.edge_scanner` both default off. The runtime switch must be enabled before processing any scan. Pausing the database flag stops scheduled jobs; an explicitly requested staff scan remains separately authorized. Manual jobs retain their actor and originating session, then check current role, active profile, account ban, session expiry/revocation and lease at execution. Global `AUTO_PUBLISH_DOCKED_EDGES=true` is rejected by configuration. Automatic publication is not implemented.

Schedules bind a provider, sport, competition, strategy version, ordinary region policy, purpose, horizon, base interval, near-event interval and quota floor. They are stored in `private.scanner_schedules`; owner/admin MFA is required to change them. Unknown or low provider quota never increases scan cadence. Scanning reads retained data and does not call an odds API. Provider ingestion has its own durable per-request quota reservations and cadence.

The strategy's exact decision windows still apply. Choose a polling/worker cadence that can cover their tolerance; late or missed windows are rejected, never reconstructed or backdated. Near-event cadence and the external scheduler must be operationally reviewed before activation.

## Durable execution

Jobs use unique schedule slots, expiring leases and bounded attempts. Each canonical market decision is committed atomically with its candidate and an append-only `scanner_run_markets` checkpoint. A process retry reuses checkpoints. Work yields after 25 seconds or a 50-market batch and resumes through the same job; completed markets are excluded from subsequent batches. Larger catalogs are not silently truncated. Normal yields do not consume failure attempts.

Candidate deduplication binds market, strategy/hash, selection, purpose, region, retained snapshot IDs and decision window. Refreshing a wall clock alone does not create another candidate. Failed market evidence is retained as a rejection; a subsequent scheduled run can evaluate newly available evidence. A completed failed run remains an audit fact.

`scanner_runs` records actual events/markets, fresh/stale/unknown-freshness counts, qualified/new candidates, rejections and errors. Successful or degraded completed scans explicitly record `providerRequests: 0` and `creditsConsumed: 0` because they only read the cache. Provider poll runs separately retain actual charged requests. Before any scan, dashboard measurements are **null/unavailable**, not zero.

## Data and model boundaries

Current observations have `evidence=market_data`. They are not forward-paper selections or live publications. Their raw payloads, receipt hashes, reviewed configuration and exact event mappings are private. Metadata cannot upgrade an unknown or promotional price. Current source use rechecks the active provider configuration, rights, exact competition/bookmaker/classification approval, ownership, timestamps, retained raw expiry, canonical market rules, health and region permissions. Disabling or rotating a configuration immediately makes incompatible fresh observations ineligible.

Research requires an ordinary reviewed `market_data` region feature; Preview Tester social/fixture permissions grant no such access. Paper/live additionally retain the existing tips/publication gates. In the preserved legacy market-baseline path, `evaluateReference` and `MarketBaselineModel` supply the numerical values. In the independent football path, the retained sporting prediction supplies probability and fair odds, while `evaluateReference` supplies the separate eligible availability price; its optional market-pricing probability is not a model input. Manual forms cannot submit prices or probabilities. The baseline is market-derived, **UNVALIDATED**, and explicitly ineligible for live candidates. A football estimator still needs its own reviewed implementation and evidence; strategy lifecycle flags cannot relabel the baseline as independent or validated.

New Phase5 config/raw/fixture/model/recognition audit records use explicit UTF-8 bytewise canonical key ordering and normalized decimal numbers, matching `private.phase5_canonical_json`. SQL tests include exponent numbers and Unicode keys. Historical strategy/reference hashes keep their original serializer and identities. No previous ledger/configuration is rewritten.

Raw retention is bounded by licensed days and configuration expiry. `purgeExpiredMarketData` runs from worker/tick maintenance even when polling is disabled, under the exact Preview identity guard, and deletes at most 500 expired raw records per call. Derived canonical audit rows retain hashes/provenance; they do not retain the expired raw payload. Browser roles cannot read raw payloads or invoke the purge.

## Operations and alerts

All alerts are durable private admin records. There is no email, push or public delivery producer in this scanner. Daily maintenance aggregates provider outage, low known quota, stale last-success times, candidates awaiting review within two hours of start, recorded results-ingestion failures, unsettled/disputed backlog and mapping failures of at least five in current provider diagnostics. Scanner failures/degraded runs and new review candidates create their own deduplicated alerts.

Actual exceptions from the authorized community results adapter append a sanitized audit event and admin alert before failing closed; no outcome is inferred. No results provider is currently configured. Missing configuration is readiness status, not an invented ingestion failure. Daily settlement counts use the latest correction-aware settlement; active/below-minimum tip counts remain explicitly unavailable until a fresh status inspection is performed. Community counts exclude separate preview fixture tables.

Read-only owner/admin/analyst/auditor views are `/admin/edge-scanner`, `/admin/candidate-edges` and `/admin/daily`; all require the existing staff session/MFA policy. Auditor writes and ordinary member access are denied. Every new table has RLS enabled and no browser grants. Privileged SQL functions are security invokers with PUBLIC/anon/authenticated execution revoked.

## Deployment and recovery

Apply the ordered additive migration `20261003143903_phase5_edge_scanner_market_data.sql` only after the guarded Preview preimage/dry run and tests. It seeds two disabled flags and creates no sporting records, approvals, schedules or providers. Preserve the verified target identity and existing ledger. Recovery is a reviewed forward repair or restoration from the protected preimage; do not delete audit rows or rewrite prior migrations. The migration's current-evidence function edits fail if their expected original signatures/body anchors do not match.

Local regression evidence: six scanner platform tests, nine new scanner/current-data PostgreSQL tests, plus the existing nine market-reference PostgreSQL regressions. Full phase validation and actual hosted state belong in the phase QA receipts; local tests do not imply hosted execution or scheduler activation.
