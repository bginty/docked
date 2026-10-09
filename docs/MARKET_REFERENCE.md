> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Market Reference v1 — unvalidated methodology

## Phase 5B boundary

Market Reference describes external availability; it is **not Docked Fair**. Optional pricing-cohort implied probabilities remain labelled market research and cannot supply Football V1 features or official probability. The scanner commits a sporting prediction first, then compares regulation 1X2 outcomes using one captured source set and clock. Independent football comparison accepts `pricing: null` when the availability reference and all separate sporting-model gates are valid; it does not require a bookmaker-derived probability.

Existing rights, freshness, ordinary-price classification, ownership, mapping and regional guards remain. Unknown classification/empty cohorts stay NOT_CONFIGURED. Community still uses standard Market Reference independently of Docked's model. Earlier market-derived baseline descriptions below are preserved research methodology, superseded for official independent probabilities.


## Phase 5 integration boundary

Current licensed observations may now carry the separate `market_data` discriminator. They retain the same source/ownership/classification/freshness gates and cannot enter publication records merely because ingestion succeeded. An immutable reviewed data configuration can provide the exact availability/pricing cohorts; absent cohorts continue to produce `NOT_CONFIGURED`. Factual fixture display has its own `market_data` regional approval and exposes no model probability or estimated EV.

`MarketBaselineModel` (`market-reference-baseline-v1`) wraps this exact engine's margin-free pricing cohort. It records config/code/model/evidence hashes, input source IDs, `asOfTime` and actual `generatedAt`. It is explicitly `RESEARCH_BASELINE`, `UNVALIDATED`, `advantageClaim=false`; uncertainty is null rather than fabricated. This is a reproducible market-derived benchmark, not independent predictive alpha. The historical `model-baseline` command uses the existing dated-rights/knowledge-time adapter and frozen study binding. Results and later closing observations cannot enter an earlier estimate. Legacy V1 mathematics and immutable prior records are unchanged.

Phase 4 introduces `market-reference-v1.0.0` in `src/core/market-reference.ts`. It is an engineering hypothesis, not validated evidence of profitability, liquidity or a price any individual can obtain. The shipped cohorts are empty, so the default is **NOT_CONFIGURED**. No commercial provider was activated and no sporting performance was generated.

## Distinct reference purposes

Pricing sources estimate probabilities from complete markets: invert every decimal price, normalise the entire outcome vector to remove proportional margin, then average equally across independent operator groups. Availability sources estimate a defensible standard market price for the selected outcome. They are deliberately separate cohorts. Neither a target quote nor any bookmaker with the same operator identity as a configured pricing source may contribute to availability. A stale pricing quote does not allow its related availability brand back into the pool.

Bookmaker IDs are configured, not guessed. Ownership evidence, exact mappings, reviewed rights, active feed status and affirmative standard-price classification are required for every observation. A member's account, typed odds, screenshot, claimed bookmaker or personal promotional price supplies none of this evidence. Two feeds carrying the same bookmaker are not independent sources. The trusted database loader selects one latest retained observation per bookmaker by source time, receipt time and ID before evaluation; an ineligible latest quote is not replaced with an older attractive one. The core rejects ambiguous duplicate bookmaker/quote records if they are supplied in the same input.

Trusted provider metadata must separately declare `sourceKind: current_provider` (how Docked obtained the evidence) and `sourceType: bookmaker` (the kind of market source). These are different claims. Missing source type does not default to a bookmaker, and exchanges remain unsupported in this version. Existing adapters do not yet supply the required affirmative standard-price classification; provider connectivity alone cannot unlock a competitive benchmark.

## Deterministic v1 calculation

The configuration fixes the algorithm and thresholds and is canonically hashed. A change requires an explicitly versioned configuration and the strategy's normal review/freeze process.

1. Accept only supported complete EPL/La Liga football regulation 1X2 and NBA full-game including-overtime markets. Exact event, competition, sport, participant and settlement rules must match. Source, snapshot and Docked-receipt times must be ordered, known, no later than observation, and no more than 180 seconds old. Stop at least ten minutes before start; configuration may tighten this cutoff.
2. Reject suspended, promotional, unknown-classification, unlicensed, unhealthy, unmapped and exchange sources. Reject implausible complete-market implied totals outside 0.95–1.25. Unknown metadata stays unknown.
3. Collapse each cohort to one representative per operator, ordered by canonical bookmaker ID. Exclude the complete pricing ownership cohort from availability. At least two independent availability groups are required. The pricing estimate separately requires at least two independent pricing groups.
4. For availability, calculate the lower median: sort prices ascending and select index `floor((n−1)/2)`. Exclude prices more than 20% from this initial median. Require at least two remaining groups and a retained range no greater than 10% of the retained lower median. There is no iterative removal until an attractive answer appears.
5. The reference is the retained lower median, rounded **down** to a 0.01 tick. This never selects the maximum as a rule, interpolates a fictional price or rounds upward beyond the chosen observation. It represents a conservatively observable standard benchmark, not guaranteed execution.
6. Availability source skew must be at most 90 seconds. When estimating a market-derived research probability, the combined cohorts must meet that limit and pricing probability disagreement must be at most 0.08 for **every** outcome. Missing or divergent pricing produces `pricing: null`; the legacy market-derived candidate path then fails closed. Independent football candidates use their separately retained sporting probability and do not require this optional pricing object. Community availability benchmarks do not claim an estimated probability.

The output stores methodology/config/rules/evidence hashes, selection, reference price, conservative oldest retained source/snapshot/receipt timestamps, and separate pricing/availability source IDs and operator IDs. The evidence hash binds retained source records and decision context.

## Database evidence invariants

`private.market_references` materialises only current evidence. Its insert guard reconstructs the complete eligible cohorts from retained snapshots and effective approvals; selecting a favourable subset cannot establish a different reference. The guard verifies snapshot payload IDs, bookmakers, rules and ordered timestamps against stored columns, checks the actual source types/classification/rights/ownership, and recomputes canonical configuration, rules and source-evidence hashes. Availability sources require approval in the reference's exact region; pricing ownership may be established by another current approved policy, but cannot overlap availability ownership.

Reference source-count/operator projections and the conservative timestamp summaries must match the retained rows. Receipt cannot occur after the claimed observation. Missing required settlement-rule fields fail closed, including SQL NULL cases. A non-null probability object requires its complete minimum pricing cohort and matching de-vig arithmetic; an empty pricing-source array cannot carry a fabricated probability.

The methodology registry permanently binds a version to its configuration and hash. Material configuration changes require another methodology version, alongside the official strategy's separate freeze/review process. Market, event, source, policy and methodology locks precede final freshness checks; source age and cutoff are checked again before finalisation. Publication, community submission and actionable movement inserts assert that the referenced evidence remains current.

References, methodology registrations and movement records are append-only with RLS and no anonymous/authenticated browser grants. The protected ledgers retain their original captured accounting price. Optional personal bookmaker/promotional-price notes live separately and can be erased without removing canonical outcomes. A client-provided hash or price is never authority.

## Evidence and historical compatibility

Current operation accepts only `current_provider` observations. Explicit research mode can process historical or authored fixture evidence, and its output remains `evidenceMode: research`. Download time is never relabelled an earlier receipt. Future observations cannot decide an earlier reference. Test fixtures are clearly fictional and do not populate public performance.

The research CLI now dispatches validated reference configurations to the same `evaluateReference` and `observeReferencePublication` functions, while preserving the legacy path. Its strict historical adapter requires dated source rights, ownership, classification, mappings, regional eligibility, schedule/lifecycle state and independently evidenced archive availability. Actual download time remains separate; the research knowledge clock cannot become current-provider evidence. Freeze binding includes configuration, region, code commit, timestamp and exact study windows. Private reports preserve captured accounting odds, actual observation missingness and separate closing/calibration diagnostics. See [the research workflow and remaining evidence requirements](VALIDATION.md#phase-4-research-support-boundary). No real history or validation has been supplied. Provider trial payloads do not automatically satisfy this evidence schema.

`reference-v1.0.0` and `community-standard-v1` retain their original bookmaker-specific meaning. Existing ledgers are never rewritten as though this method existed previously. New publication/submission records retain their captured benchmark permanently; later observations append status evidence when sources, price or status change. V1 reference status does not automatically reactivate after falling below minimum or suspension. A recovered above-minimum price is SUSPENDED, rather than incorrectly labelled below minimum, and cannot create a second official benchmark. EXPIRED can progress to SETTLED after verified settlement; neither can reopen as ACTIVE.

Golden tests cover normal multi-source prices, a missing source, staleness, large outliers, suspension, promotions, unsupported exchanges, disagreement, missing draw, complete three-way markets, ownership overlap, future evidence and price movement. Passing those tests establishes software behavior only. Selection of source cohorts, thresholds, empirical availability and historical suitability still require licensed research and approval.
