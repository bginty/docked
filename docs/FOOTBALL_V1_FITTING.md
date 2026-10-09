> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Football V1 fitting and execution

Phase 5D supersedes the Phase 5C absence of an estimator. The implemented model is research-only; installation and actual prediction receipts are recorded separately under `docs/qa/phase5d`. It is not approved for candidates or live publication.

For home team h and away team a:

`log λ_home = intercept + home_advantage + attack_h + defensive_weakness_a`

`log λ_away = intercept + attack_a + defensive_weakness_h`

Minimise the weighted Poisson negative log likelihood (constant factorial terms omitted), plus `0.5 × ridge × Σ(team coefficients²)`. Positive defensive weakness means more conceded goals. Team coefficients shrink towards league-average zero; the scoring intercept and home effect are unpenalised. Ridge makes the team/intercept parameterisation identifiable. Solve deterministically with a Cholesky Newton step and Armijo backtracking; refuse a nonconverged/singular fit. A fixed byte-equivalent training order, manifest and implementation reproduce coefficients within floating-point tolerance; hashes bind the actual retained output.

The predeclared research specification is a 365-day exponential half-life, ridge 1, minimum eight accepted matches per prediction team, maximum 100 iterations and maximum gradient `1e-8`. No alternative was selected on historical betting profit. Daily age uses source dates, not invented historical UTC kickoff times. A match's dataset observation clock must precede the training cutoff; same-day reported scores are excluded. Unknown, sparse and promoted teams abstain despite shrinkage. Prior-season EPL results provide early-season context; no Championship data or unlicensed cross-competition conversion is used.

Independent Poisson score masses yield home/draw/away. Adaptive tails are bounded at `1e-12`; the computed vector is normalised and rounded to twelve decimal places with the away residual ensuring an exact decimal sum of one. Expected scoring rates outside `(0,20]` abstain. There is no justified uncertainty interval or confidence score. Independent goals, static team strengths, omitted injuries/lineups/xG and source-reported score quality remain limitations.

[Dixon and Coles](https://rss.onlinelibrary.wiley.com/doi/10.1111/1467-9876.00065) motivates Poisson team modelling and dynamics. A low-score dependence term is a reasonable challenger, but adds a fitted parameter and constraints. V1 retains the simpler explicit baseline; no claim that it is superior is made. Evaluate future versions with time-safe proper probability scores and prospective calibration. A material refit/configuration/source change creates a new model version; old predictions and official records never change.

## Data and execution boundary

Strict sporting-only schemas reject additional price/prose/probability fields. No market provider or network adapter is imported by the fitter. Fixture metadata identifies the upcoming match; it contributes no betting prices. Retained canonical labels use explicit aliases; the manual workflow checks the exact home/away pairing and Europe/London scheduled time against the reviewed OpenFootball fixture. Unknown or conflicting mappings stop for review.

`football_training_manifests` stores the full training rows, manifest, fitted state, hashes, observation cutoff, fitting time, code revision and actor. It is private, RLS-protected and append-only. `football-fitted-input-v1` binds a current canonical event to that manifest without pretending historical results had exact completion timestamps. The legacy input schema retains its original guards. The prediction ledger requires a real leased worker, matching implementation/configuration, current rights, current event and committed input. The market path still requires a separately committed prediction.

Source observation age is retained independently of calculation time. A new calculation does not refresh a stale source. Official candidate gates, strategy/code binding, current Market Reference and jurisdiction checks remain unchanged. Current Preview data-only permission is not sufficient to approve a model candidate or paper publication. Missing comparison authority produces unavailable comparison, not “no edge”.

## Controlled manual commands

Local data review: `npx tsx scripts/football-data-study.ts`; numerical study: `npx tsx scripts/football-fit-study.ts`. These exclusive-write study receipts are not hosted predictions and cannot silently replace a prior study.

After migration review, genuine disposable MFA and a clean committed implementation, run `node --conditions=react-server --import tsx scripts/hosted-preview/phase5d-model-cycle.ts MODE --confirm-project=bckkllmndoxzpzdqrevb`, with modes in order: `register`, `predict`, `comparison-readiness`.

Registration computes coefficients server-side from retained sporting rows. It does not accept caller probabilities. Prediction evaluates every mapped upcoming retained EPL event within seven days in chronological order, including promoted-team abstentions. The first manual cohort uses window identifier 604800 for an initial observation inside a seven-day horizon; actual timestamps remain explicit. It is not an assertion that every prediction occurred exactly T−7 days. Do not pool this cohort with later fixed-horizon scheduled observations.

No schedules are enabled. Later automation needs an audited source refresh/input-preparation workflow, frozen observation windows, quota approval, source renewal and operational acceptance. Do not simply enable the scanner against an ageing initial snapshot. Results stay pending until an authorised regulation-result adapter is configured. Manual outcome entry is not a permission bypass. The official record remains empty until a separately authorised genuine live publication.
