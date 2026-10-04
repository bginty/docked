# Independent football data requirements

Phase 5D current state: a quality-reviewed 398-match source-reported FT subset from two pinned CC0 EPL files has been accepted for goals-only research, mapped and fitted. The fitted input schema explicitly preserves date-only historical granularity; it does not claim exact historical completion clocks or settlement finality. Minimum eight accepted team matches, 365-day weighting and other declared controls are documented in FOOTBALL_V1_FITTING.md. Five genuine prospective predictions and one abstention are retained. Fresh automated sporting refresh and authorised regulation outcomes remain external/operational gaps. The Phase 5C requirements/proposal below describe the earlier state and are superseded where they say no accepted fit exists.

Phase 5C status, 4 October 2026: **MODEL DATA NOT_CONFIGURED**. [Current source evaluation](RESEARCH_SOURCE_EVALUATION.md) supersedes the earlier free-provider shortlist. Two pinned OpenFootball CC0 files have been inspected locally; their reported goals/fixtures are not canonical sporting inputs and have not been installed in the application. No fitted coefficients or approved operational model exists. Free research data is available; authoritative identity, chronology, current status and result semantics still require acceptance.

## Minimum evidence before fitting

- Stable competition, season, event and team identifiers, including renames/promotions/relegations and explicit mapping evidence. Phase 5C intentionally narrows the first research/model scope to **EPL, pre-match, full-time regulation 1X2**. Earlier generic framework support for La Liga is not an active model scope.
- Fixture kickoff in UTC, schedule revision and when it became known; home/away identity and scheduled/postponed/cancelled/rescheduled/abandoned state. Unknown or conflicting identity is ineligible.
- Completed **regulation-time** home/away goals, finality/status, completion time, provider revision and known/received timestamps. Extra time, penalties, awarded outcomes and abandoned matches require explicit handling rather than guessed scores.
- Sufficient authorised historical team/league sporting results, complete enough to assess season/venue coverage and promoted teams. Required seasons and sample thresholds must be justified from actual coverage and a predeclared research design. They are currently **UNSET**, not guessed numerical defaults.
- Dated source/version/rights reference and authority for model training, derived probability use and retained evidence. Public results display/settlement also requires its own reviewed use scope. Keys and raw payloads stay server-side.

Team-strength features, recency weights, home advantage and regularisation are future derived sporting features. Optional lineup, injury and xG feeds need separate rights/quality evidence; absence cannot be silently replaced by zero or an assumed full-strength team. No bookmaker odds, Market Reference probability, EV, price movement or community opinion enters the independent probability model.

## Implemented prospective contract

`src/core/football-model.ts` validates strict `football-sporting-input-v1` records containing the target event, `asOfTime`, `calculatedAt`, code commit, dated source approvals, selected immutable historical result revisions and explicit missing-required/optional feature names. Unknown properties (including odds) are rejected at every defined object boundary. SHA-256 uses the existing new-record `phase5Hash` canonical serializer; legacy strategy hashes remain unchanged.

Every historical result must finish before it is known, be known before local receipt, and be received by the decision cutoff. Source approvals must be known and effective at that cutoff. Target-event outcomes, cross-competition inputs, duplicate events/unresolved revisions, future information and unsupported final-score shapes are rejected. The target is scheduled and the calculation finishes before kickoff. Structural acceptance proves only a valid evidence shape, not sufficient statistical coverage or legal approval.

This is a **prospective local-availability contract**. A later historical download cannot be backdated to `receivedAt`. Future research imports require separately evidenced historical availability/as-of lineage; do not weaken the contract or use a provider's current corrected record as proof of what was known earlier.

## Future data-quality acceptance

Before fitting, retain a manifest with raw/canonical hashes, provider/rights versions, season/competition/date coverage, expected versus received fixtures, missing results/features, duplicates, mapping failures, correction history and regulation-score checks. Compute source ages from actual observations; choose freshness limits only in the reviewed model configuration. No missingness percentage, sample threshold, promotion adjustment or uncertainty interval is populated without evidence.

The eventual immutable snapshot must additionally bind fitted feature values and definitions, model configuration/version/hash, approved training-data hash, calculation time and last usable input time. These fields cannot currently be fabricated because no feature builder/fitted estimator exists. The current default provider returns null cutoff, input/config hashes, probabilities and uncertainty with explicit missing-data reasons.

Historical sporting results may support model development. Historical Docked tips, hypothetical betting results/ROI, synthetic public performance and retrospectively selected winning predictions are excluded from this work. Prospective calibration covers every eligible event at the declared model/decision window, including failures and abstentions.

## Phase 5C research boundary

Approved raw dataset snapshots, normalised source-reported data, structured evidence, Match Research Files, model features and predictions are separate stages. A successful OpenFootball adapter parse does not create a completed canonical result, publication timestamp, timezone or model input. Its missing clocks stay missing. One season's 380 rows alone does not establish fitting adequacy, promoted-team treatment or calibration.

Source rights include independent commercial, storage, public-display, derived and modelling permissions. Approved licence scope is distinct from runtime registration, freshness, reliability, canonical mapping and feature activation. Only a versioned active feature can request recalculation. Display-only injuries, lineups, H2H, player trends and weather cannot alter V1 probability. See [feature registry](MODEL_FEATURE_REGISTRY.md), [match files](MATCH_RESEARCH_FILE.md) and [source evaluation](RESEARCH_SOURCE_EVALUATION.md).
