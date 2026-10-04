# Forward calibration

## Initial manual observation cohort — Phase 5D

Use model football-goals-v1.0.0 and window 604800 to inspect the initial six-event cohort: five predictions, one abstention, zero settled. Brier score, log loss, observed-frequency calibration, uncertainty and drift are unavailable until authorised outcomes arrive. Do not display fabricated scores.

Window 604800 labels the initial manual observation within a seven-day horizon, not an exact T−7-day prediction. Future fixed-horizon scheduled cohorts must be analysed separately. No automatic refresh or refit is enabled.

The Admin **Model Performance** view measures predictive quality, not betting returns. Before a working authorised model exists it reports **NOT_CONFIGURED / no prospective predictions**; it does not show manufactured scores, drift, confidence or success indicators.

For each model/version and predeclared decision horizon, include the complete eligible prediction set, not only Candidate Edges. Retain record/settlement counts, date range, pending outcomes, missing-data state and abstentions. Execution exceptions are currently retained in scanner/job audit; the pure calibration contract supports FAILED records, but a database-to-dashboard execution-failure projection is future work. Repeated predictions or multiple horizons must not silently overweight an event; compare declared cohorts separately.

For home/draw/away probabilities and one-hot regulation outcome, multiclass Brier is `sum((p_k-y_k)^2)` (range 0–2, no division by three). Log loss is `-log(p_actual)`. Never silently clip zero probability to create a finite score: report the defined limitation/nonfinite loss. No outcomes means unavailable metrics. Voids, unresolved or contradictory results do not become sporting outcomes.

Calibration buckets show sample count, mean predicted probability and observed frequency. Small samples are descriptive, not a proven edge. There is no invented uncertainty band or model drift score. A future drift method needs a frozen baseline, explicit population/window, minimum sample and statistical rationale before display.

Model/data sanity, chronological integrity, probability validity, operational reliability and genuine prospective observations govern model approval. The owner decides sufficient observation duration later; no arbitrary months-long wait or historical betting ROI is imposed.

Forward paper remains a useful optional prospective operations stage: real sporting inputs → independent model → market comparison → immutable paper record → price tracking → authorised settlement. It never becomes historical Docked betting performance or part of public official ROI.
