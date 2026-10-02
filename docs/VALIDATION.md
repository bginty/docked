# Validation and reproducibility

No historical or forward performance validation has occurred. The required fictional arithmetic returns −0.80 units and −16.00% ROI. It exists only in tests and `npm run research -- demo`; it is excluded from every public performance query.

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

Input JSON is an array of HistoricalEvent from src/research/replay.ts: exact rules, startAt, observed snapshots containing complete Quote records, and a separately authorised Result or null. Raw vendor data requires reviewed canonical mapping. Preserve true historic availability/receipt timestamps; do not substitute import time or close prices. Source evidence cannot be established by inventing an earlier timestamp.

Manifest fields: datasetId, evidence (`retrospective_backtest` or local `demo` only), oddsRights, resultsRights, retentionAllowed, configHash, dataHash=`hash(events)`, codeCommit, seed, split (development/validation/held_out/subsequent), contaminated, frozenAt, exact from/to, historicalUniverseEvidence. Rights strings must refer to actual reviewed permissions, not a self-declared licence.

Phase 2 adds real-data requirements: `fixture:false`, named odds/results providers, named reviewer, source resolution, original source-file SHA-256 hashes, canonical dataset hash, freeze artifact hash, and independent provenance when claiming an untouched held-out/subsequent set. See [the complete Phase 2 workflow](PHASE2_RESEARCH.md). Missing outcomes remain pending; contradictory mapping and future quote receipt within an older snapshot reject the input. Explicit timezone instants replace lexical timestamp comparisons.

Report includes all evaluated/rejected decisions, full eligible outcome probability observations, immediate and delayed ledgers, original-minimum-price rechecks, missing-window/delay exclusions, 5/15/60-minute availability and missingness, the declared pre-start CLV proxy, calibration Brier/log loss, day-block uncertainty, exact manifest/configuration and limitations. Calibration observations are correlated across sources and outcomes. Negative results remain in output. Reports are local private research artifacts, not automatically public claims.

The declared calibration baseline is the offered bookmaker's own proportional margin-free probability on exactly the same eligible outcome observations. `sensitivity` accepts development/validation splits only and reports every 2%/3%/5% threshold, 5/10/15-minute minimum delay, removed-operator scenario and hypothetical worse-price/fixed-fee stress. It does not select an optimal variant. Held-out/subsequent sensitivity attempts fail. Fees are assumptions, not an exchange implementation.

Private forward paper uses the owner research approval action and the `forward_paper` publication choice. It records current server time and cannot be imported retrospectively. It remains outside public queries and outbound edge notifications. Live approval additionally requires actual forward-paper evidence. These mechanisms have not produced any genuine strategy record in this build.

## Suggested study — not yet run

2022–2023 development, 2024 validation, 2025 held-out, 2026 YTD subsequent retrospective check only if coverage exists and the supposed test is genuinely untouched. Record contamination whenever outcomes influenced any selection. Threshold and delay sensitivity belong in development/validation. No arbitrary sample count proves profitability. Prospective paper decisions can start only after actual rule freeze and review; backtests cannot be relabelled forward paper.

## Verification boundaries

PGlite tests execute PostgreSQL schema, RLS, grants, triggers, constraints and queue claims with a minimal auth schema harness. They do not certify hosted Supabase Auth configuration, email verification/recovery delivery, production networking, concurrency throughput or backup RPO. Those require an isolated supplied Supabase environment. Browser tests exercise honest pending/restricted paths; live signup-to-email-to-settlement cannot be certified without authorised services and evidence.
