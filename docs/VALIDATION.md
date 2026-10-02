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
npm run research -- replay private-data/events.json private-data/manifest.json research-output/report.json
npm run research -- sensitivity private-data/events.json private-data/development-manifest.json research-output/sensitivity.json
```

`freeze` writes config, hash, actual timestamp and current code commit and refuses to overwrite an existing freeze file. Do not edit the freeze after evaluating held-out data. `import` validates a canonical dataset and writes its replay audit report; it does not establish its licence, fetch/purchase historical data or inject it into the live ledger.

Input JSON is an array of HistoricalEvent from src/research/replay.ts: exact rules, startAt, observed snapshots containing complete Quote records, and a separately authorised Result or null. Raw vendor data requires reviewed canonical mapping. Preserve true historic availability/receipt timestamps; do not substitute import time or close prices. Source evidence cannot be established by inventing an earlier timestamp.

Manifest fields: datasetId, evidence (`retrospective_backtest` or local `demo` only), oddsRights, resultsRights, retentionAllowed, configHash, dataHash=`hash(events)`, codeCommit, seed, split (development/validation/held_out/subsequent), contaminated, frozenAt, exact from/to, historicalUniverseEvidence. Rights strings must refer to actual reviewed permissions, not a self-declared licence.

Report includes all evaluated/rejected decisions, full eligible outcome probability observations, immediate and delayed ledgers, missing-window/delay exclusions, calibration Brier/log loss, day-block uncertainty, exact manifest and limitations. Calibration observations are correlated across sources and outcomes. Negative results remain in output. Reports are local private research artifacts, not automatically public claims.

The declared calibration baseline is the offered bookmaker's own proportional margin-free probability on exactly the same eligible outcome observations. `sensitivity` accepts development/validation splits only and reports every 2%/3%/5% threshold, 5/10/15-minute minimum delay, removed-operator scenario and hypothetical worse-price/fixed-fee stress. It does not select an optimal variant. Held-out/subsequent sensitivity attempts fail. Fees are assumptions, not an exchange implementation.

Private forward paper uses the owner research approval action and the `forward_paper` publication choice. It records current server time and cannot be imported retrospectively. It remains outside public queries and outbound edge notifications. Live approval additionally requires actual forward-paper evidence. These mechanisms have not produced any genuine strategy record in this build.

## Suggested study — not yet run

2022–2023 development, 2024 validation, 2025 held-out, 2026 YTD subsequent retrospective check only if coverage exists and the supposed test is genuinely untouched. Record contamination whenever outcomes influenced any selection. Threshold and delay sensitivity belong in development/validation. No arbitrary sample count proves profitability. Prospective paper decisions can start only after actual rule freeze and review; backtests cannot be relabelled forward paper.

## Verification boundaries

PGlite tests execute PostgreSQL schema, RLS, grants, triggers, constraints and queue claims with a minimal auth schema harness. They do not certify hosted Supabase Auth configuration, email verification/recovery delivery, production networking, concurrency throughput or backup RPO. Those require an isolated supplied Supabase environment. Browser tests exercise honest pending/restricted paths; live signup-to-email-to-settlement cannot be certified without authorised services and evidence.
