# Validation and reproducibility

## Phase 5 baseline preparation

The CLI adds `model-baseline` using `MarketBaselineModel` and the same strict `HistoricalReferenceEvent[]` as reference replay. It selects each last actual pre-decision snapshot, requires schedule/status knowledge at that decision, applies all dated rights/ownership/mapping/classification/region proofs, then calls the shared reference engine. It never passes results or later closing prices to the model. The report distinguishes historical `asOfTime` from actual computation `generatedAt`. Model/config/source evidence/code hashes and explicit null uncertainty are retained. This market-derived benchmark does not establish independent alpha or replace a study's declared comparison design.

```powershell
npm run research -- model-baseline private-data/reference-events.json private-data/reference-manifest.json research-output/baseline.json private-data/reference-strategy.json
```

Real baseline runs require the same clean frozen commit, exact config/region/date split and immutable manifest linkage as replay. Fixture outputs are explicitly fictional; no real baseline, historical dataset or performance validation was run. Existing legacy/reference commands and held-out sensitivity denial remain intact. Focused offline regressions cover unchanged shared probability, future-source rejection, later-result/closing-price independence and future-issued approvals. Provider fixtures exercise request reservation, missing timestamps, unsupported rules and exact identity without any network request.

No historical or forward performance validation has occurred. The required fictional arithmetic returns −0.80 units and −16.00% ROI. It exists only in tests and `npm run research -- demo`; it is excluded from every public performance query.

## Phase 4 research support boundary

The research CLI now dispatches explicitly by the validated strategy algorithm. Legacy configurations retain `evaluate`/`observePublication` and offered-bookmaker accounting. Reference configurations use `evaluateReference`/`observeReferencePublication`, the same calculation and observation functions used prospectively. Unknown algorithms and incompatible source schemas fail; an old V1 report cannot be relabelled as evidence for the new hypothesis.

`src/research/reference-dataset.ts` defines the required historical input contract. Every source requires independently reviewable archive availability, actual retrieval time, complete prices, contemporaneous feed state, mappings, standard-price classification, ownership and regional eligibility. Dated approval evidence includes both effective bounds and `knownAt`; future-issued backdated evidence cannot qualify an earlier decision. Each event also requires evidence of when its schedule became known, and each snapshot requires its then-known lifecycle status. Missing metadata is a blocked input, never a default approval.

The reference adapter preserves publication probability, minimum and accounting price. Later price observations cannot rewrite them or automatically reactivate a suspended selection. Availability and delayed-entry samples use actual observations; missing samples remain unknown. The separate closing probability diagnostic never selects an earlier Edge. Brier/log loss are reported for eligible outcome vectors, with no independent calibration baseline asserted for the new hypothesis. Choosing a comparison baseline remains a research-plan prerequisite; the legacy offered-book baseline is not silently reused.

Real replay is bound to the actual validated frozen config and hash, exact region context, code commit, freeze timestamp and study-window boundaries. The CLI requires that clean frozen commit. Stress variants are development/validation only and preserve original source hashes plus explicit derived-data lineage. Reference source cohorts remain empty in the shipped configuration. No licensed history, new-model empirical study, research freeze, strategy approval or forward performance has been generated. Passing the offline fixtures establishes implementation behavior only. A provider-specific licensed source normalizer and independently checked evidence are still needed before genuine research; the schema cannot authenticate a licence or an archive merely because a string is supplied.

## Commands

```powershell
npm ci
npm run validate
npm run build
npx playwright install chromium
npm run test:browser
npm run research -- demo
npm run research -- freeze
npm run research -- import private-data/events.json private-data/manifest.json research-output/import-report.json
npm run research -- validate-data private-data/events.json private-data/manifest.json research-output/data-quality.json
npm run research -- replay private-data/events.json private-data/manifest.json research-output/report.json
npm run research -- sensitivity private-data/events.json private-data/development-manifest.json research-output/sensitivity.json
npm run research -- stress-test private-data/events.json private-data/development-manifest.json research-output/stress.json
npm run research -- report research-output/report.json research-output/report.md
```

`freeze` (alias `freeze-strategy`) requires a clean committed working tree, writes config, hash, actual timestamp and current code commit, and refuses to overwrite an existing freeze file. Do not edit the freeze after evaluating held-out data. `import` and `validate-data` validate the canonical dataset and write data-quality reports without revealing strategy results. They do not establish its licence, fetch/purchase historical data or inject it into the live ledger. Real-data replay verifies the freeze artifact and requires that same clean code commit. All output commands refuse to overwrite existing artifacts. `report` verifies artifact integrity before producing a private readable summary.

For the reference methodology, first prepare a reviewed, explicitly versioned strategy JSON with separate source cohorts, a four-window study JSON, and an exact region identifier matching the historical approvals. The following are configuration workflows, not commands that have been run on real history:

```powershell
npm run research -- freeze-strategy private-data/reference-strategy.json private-data/study-splits.json AU:NSW
npm run research -- import private-data/reference-events.json private-data/reference-manifest.json research-output/reference-import.json private-data/reference-strategy.json
npm run research -- validate-data private-data/reference-events.json private-data/reference-manifest.json research-output/reference-quality.json private-data/reference-strategy.json
npm run research -- replay private-data/reference-events.json private-data/reference-manifest.json research-output/reference-replay.json
npm run research -- stress-test private-data/reference-events.json private-data/reference-development-manifest.json research-output/reference-stress.json
npm run research -- report research-output/reference-replay.json research-output/reference-report.md
```

The optional fifth configuration argument is needed by reference data-quality commands and authored fixture replay. Real replay/stress loads the frozen configuration; if an additional config is supplied it must match that freeze. No-argument freeze and omitted data-quality configuration retain the original V1 conventions. The region above is only syntax: it creates no legal approval. Preserve each freeze and its outputs in a version-specific archive; never overwrite the current freeze to tune held-out results.

Input JSON is an array of HistoricalEvent from src/research/replay.ts: exact rules, startAt, observed snapshots containing complete Quote records, and a separately authorised Result or null. Raw vendor data requires reviewed canonical mapping. Preserve true historic availability/receipt timestamps; do not substitute import time or close prices. Source evidence cannot be established by inventing an earlier timestamp.

That input remains the legacy contract. Reference input is `HistoricalReferenceEvent[]` from `src/research/reference-dataset.ts`: `rules`, `startAt`, `schedule {knownAt,reference}`, snapshots containing `observedAt`, `eventStatus {status,knownAt,evidence}`, complete `sources`, and a separate result or null. Each source retains its provider/bookmaker/type, prices, source/snapshot/archive-availability/archive-retrieval instants, availability evidence, suspension state, dated rights/ownership/classification/mapping/eligibility objects and feed-health evidence. Approval intervals are `[effectiveFrom,effectiveTo)` and `knownAt` must not exceed the decision. `eligibility.region` must match the manifest's required `referenceRegion` for availability books; pricing ownership may use another evidenced active region, matching prospective behavior. The freeze also binds `referenceRegion`.

The adapter maps independently evidenced `archiveAvailableAt` to the common engine's knowledge-clock field **only in research mode**, with `historical` provenance. Actual `archiveRetrievedAt` remains unchanged in the hashed input. This does not assert that Docked received the data historically, and current-provider operation rejects these research sources. Complete as-of market state must come from the licensed normalizer; it is not inferred from a later download, final event schedule, modern ownership list or latest final-result status.

Manifest fields: datasetId, evidence (`retrospective_backtest` or local `demo` only), oddsRights, resultsRights, retentionAllowed, configHash, dataHash=`hash(events)`, codeCommit, seed, split (development/validation/held_out/subsequent), contaminated, frozenAt, exact from/to, historicalUniverseEvidence. Rights strings must refer to actual reviewed permissions, not a self-declared licence.

Phase 2 adds real-data requirements: `fixture:false`, named odds/results providers, named reviewer, source resolution, original source-file SHA-256 hashes, canonical dataset hash, freeze artifact hash, and independent provenance when claiming an untouched held-out/subsequent set. See [the complete Phase 2 workflow](PHASE2_RESEARCH.md). Missing outcomes remain pending; contradictory mapping and future quote receipt within an older snapshot reject the input. Explicit timezone instants replace lexical timestamp comparisons.

Report includes all evaluated/rejected decisions, full eligible outcome probability observations, immediate and delayed ledgers, original-minimum-price rechecks, missing-window/delay exclusions, 5/15/60-minute availability and missingness, the declared pre-start CLV proxy, calibration Brier/log loss, day-block uncertainty, exact manifest/configuration and limitations. Calibration observations are correlated across sources and outcomes. Negative results remain in output. Reports are local private research artifacts, not automatically public claims.

For legacy V1, the declared calibration baseline is the offered bookmaker's own proportional margin-free probability on exactly the same eligible outcome observations. Legacy `sensitivity` retains its 2%/3%/5% threshold, 5/10/15-minute delay, removed-operator and hypothetical worse-price/fixed-fee scenarios, now using the selected frozen base config. Reference stress reports its frozen threshold and +2/+4 percentage-point variants, allowed 5/10/15-minute delays and each removed operator. Unsupported safety-bound cases are explicitly labelled. Neither selects an optimum, and held-out/subsequent sensitivity attempts fail. Reference calibration has no declared independent baseline. Fees are assumptions, not an exchange implementation.

Private forward paper uses the owner research approval action and the `forward_paper` publication choice. It records current server time and cannot be imported retrospectively. It remains outside public queries and outbound edge notifications. Live approval additionally requires actual forward-paper evidence. These mechanisms have not produced any genuine strategy record in this build.

## Suggested study — not yet run

2022–2023 development, 2024 validation, 2025 held-out, 2026 YTD subsequent retrospective check only if coverage exists and the supposed test is genuinely untouched. Record contamination whenever outcomes influenced any selection. Threshold and delay sensitivity belong in development/validation. No arbitrary sample count proves profitability. Prospective paper decisions can start only after actual rule freeze and review; backtests cannot be relabelled forward paper.

## Verification boundaries

PGlite tests execute PostgreSQL schema, RLS, grants, triggers, constraints and queue claims with a minimal auth schema harness. They do not certify hosted Supabase Auth configuration, email verification/recovery delivery, production networking, concurrency throughput or backup RPO. Those require an isolated supplied Supabase environment. Browser tests exercise honest pending/restricted paths; live signup-to-email-to-settlement cannot be certified without authorised services and evidence.
