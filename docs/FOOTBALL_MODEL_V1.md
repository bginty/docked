# Phase 5D update

The Phase 5C proposal below is retained as historical context. The deterministic research fitter, accepted source-reported training subset and retained fitted-input workflow are now implemented. See [current fitting specification](FOOTBALL_V1_FITTING.md) and [data-quality review](OPENFOOTBALL_EPL_DATA_QUALITY.md). Hosted registration/prediction status is evidenced separately in docs/qa/phase5d; no live approval or predictive advantage is implied.

---
# Football Model V1 — proposed, not fitted

4 October 2026, Phase 5C. **DRAFT / UNVALIDATED / NOT_CONFIGURED.** No independent probabilities, model fair odds or predictive advantage have been produced. There is no runnable goals estimator, fitted model or accepted training dataset. OpenFootball CC0 goals/fixture files are now a free research candidate with measured local quality gaps; they are not an operational sporting feed. The existing quote-derived `MarketBaselineModel` remains a separate research baseline and cannot become the independent football model by renaming its output.

## Proposed method

Evaluate an independent home/away Poisson goals baseline first: team attacking and defensive strength plus home advantage, estimated only from authorised sporting results. First operational candidate scope is **EPL pre-match regulation 1X2**. Its transparent score distribution naturally yields home/draw/away probabilities. This is a methodological proposal, not an assertion that goal independence is true or that it beats market prices.

Dixon–Coles adds a low-score dependence correction and time weighting; it is a plausible later challenger but introduces extra fitted choices. The original paper is evidence for the method, not evidence for Docked performance. Elo is a compact team-strength comparator, but mapping rating differences into calibrated three-way probabilities still requires training and validation. Start with the simpler goals proposal only when actual data supports it. [Dixon and Coles, 1997](https://academic.oup.com/jrsssc/article-abstract/46/2/265/6990546).

No numerical half-life, regularisation, minimum sample, promotion prior, coefficient, score-tail truncation or interval confidence level is chosen now. The exported descriptive proposal has `parameters:null` and `trainingDataHash:null`. Fit choices need a predeclared sporting-data study; an arbitrary last-five-games average is not the model. Inadequately represented/promoted teams must abstain until a justified treatment exists.

## Delivered boundary

`FootballModelProvider.estimate(event, asOfTime, modelVersion)` is versioned and sport-specific. `NotConfiguredFootballModelProvider` returns `NOT_CONFIGURED`, missing-authorised-data/reviewed-parameters/estimator reasons and null probabilities/evidence/uncertainty. The requested version string does not register or approve an implementation. An injected fictional provider exists only inside contract tests.

`validateFootballSportingInput` checks immutable as-of sporting facts and rights references; `validateFootballPrediction` checks future output provenance. `validateFootballProbabilities` accepts exactly three decimal strings, each in [0,1], summing exactly to one. Shape validation is never publication authority. A future reviewed server implementation must bind its registered version/config/input hashes to those facts and record all eligible attempts before kickoff. No HTTP/API accepts arbitrary client probabilities as an official estimate.

The exact lifecycle is **DRAFT → RESEARCH → FORWARD_CALIBRATION → APPROVED_FOR_CANDIDATES → APPROVED_FOR_LIVE → RETIRED**. State changes require authorised audited gates in the model registry; a changed material model configuration creates a new version. The descriptive proposal hash is not an operational model configuration approval. All current live/paper/publication gates remain independent and closed.

The prepared `football_independent_v1` monitoring branch compares fresh availability references with the publication's retained model probability and minimum price. It does not replace that probability with a market-implied value, reprice the immutable accounting entry or reactivate a suspended record. The legacy probability-based closing diagnostic is deliberately not populated with constant model probability; independent-model CLV remains unavailable until a separately defined closing-price metric is implemented and observed.

## Prospective calibration

`src/core/model-calibration.ts` reports one model version, one predeclared decision window and a UTC [from,to) cohort as of a recorded reporting time. Every eligible attempt belongs in the ledger; inclusion must never depend on EV, candidate approval, eventual winner or data visibility. Distinct horizons are separate reports, preventing repeated estimates for one match from receiving arbitrary extra weight.

For settled non-void predictions, the multiclass Brier score is mean `Σ(p_k − y_k)²`, range 0–2; log loss is mean `−ln(p_observed)`. No probability clipping occurs. A realised outcome assigned zero probability produces `logLossStatus:INFINITE`, a count of such predictions and JSON-safe null numeric log loss. An empty/unsettled cohort has unknown metrics, not zero quality.

Calibration includes ten fixed bins per outcome class; empty bins have null mean prediction/frequency. Reports retain attempt/outcome IDs and an evidence hash, settled/pending/void counts, failed/abstained/not-configured attempts and rates using all cohort attempts. Voids have no ordinary football outcome and are excluded from the scoring denominator. A latest manual-review outcome withdraws that prediction from scoring and counts it as pending until an appended resolution. Corrections append a complete revision chain; reports use the latest revision known by their as-of time, never future corrections. Confidence intervals, drift metrics and betting performance remain null rather than invented.

Fixtures only test arithmetic, cutoff enforcement, abstention and correction semantics. Passing them does not establish useful calibration or predictive ability. Real forward calibration can begin only after sporting rights/data, fitted implementation, reviewed configuration and lifecycle approval exist; results feed readiness is also required. See [data requirements](FOOTBALL_DATA_REQUIREMENTS.md) and [results readiness](RESULTS_PROVIDER.md).

Phase 5C adds a strict research-feature boundary and audited recalculation requests. It does not invent player-impact coefficients, fit Poisson parameters, or bypass the existing one-event/model/decision-window calibration cohort. Active-feature changes may request a future version-valid calculation with predecessor lineage; an unavailable estimator must abstain and cannot supply an invented successor prediction. Feature contributions and explanations must come from the eventual fitted calculation, never from unrelated attractive news. No active operational model features are registered at handoff.
