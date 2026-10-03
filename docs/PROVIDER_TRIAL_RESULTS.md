# Provider trial results — 4 October 2026

**NOT RUN. INSUFFICIENT EVIDENCE.** No authorised provider key was found in the process, `.env.local`, or the verified isolated Docked Preview Vercel project's Preview environment. The saved CLI session initially needed refresh; its normal authenticated refresh succeeded, then metadata-only verification completed. No request was made to either provider. No account, plan, key or observed data was fabricated.

Credential-presence receipt: `private-data/phase5/provider-configuration-audit.json`, project `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, verified name `docked-preview` and team `team_tf6xweKKyVCj9bTppUKttJ4l`. `ODDSPAPI_API_KEY`, `THE_ODDS_API_KEY`, legacy `ODDS_API_KEY` and `RESULTS_API_KEY` all absent. No credential values printed, no environment mutation, zero production-scoped variables.

| Measure                                  | The Odds API              | OddsPapi                  |
| ---------------------------------------- | ------------------------- | ------------------------- |
| Local credential state                   | NOT_CONFIGURED            | NOT_CONFIGURED            |
| Trial requests / credits used this phase | 0 / 0                     | 0 / 0                     |
| Account quota remaining                  | UNKNOWN                   | UNKNOWN                   |
| Events, markets, mapped coverage         | UNKNOWN — not sampled     | UNKNOWN — not sampled     |
| Latency, failures, staleness, outliers   | UNKNOWN — not sampled     | UNKNOWN — not sampled     |
| Standard-price reference availability    | UNKNOWN — no observations | UNKNOWN — no observations |
| Historical empirical coverage            | UNKNOWN — no import       | UNKNOWN — no import       |
| Results lifecycle qualification          | NOT RUN                   | NOT RUN                   |
| Recommendation                           | INSUFFICIENT EVIDENCE     | INSUFFICIENT EVIDENCE     |

Zero trial activity is an operator fact, not zero provider error rate/missingness.

## Predeclared bounded trial

1. Owner obtains a dedicated [The Odds API Starter key](https://the-odds-api.com/#pricing) ($0/month, 500 credits, no history) and/or [OddsPapi free account](https://oddspapi.io/en/pricing) (verify included allowance). Paid OddsPapi price remains UNKNOWN; do not select paid calculator options.
2. Store keys only server-side (`THE_ODDS_API_KEY`, `ODDSPAPI_API_KEY`). The isolated current-data path deliberately rejects legacy `ODDS_API_KEY`/`ODDS_RIGHTS_REFERENCE`; older CLI compatibility does not grant hosted activation, and conflicting aliases fail closed. Do not paste keys into chat/source/Android configuration. Approve scope, storage and derived display evidence separately.
3. Predeclare a common event universe: one soccer competition, NBA and NFL fixture coverage only until exact tie rules qualify. Match identical event/rules/bookmaker observations within 90 seconds. Initial no-retry envelope: at most 12 current requests per provider across four passes, plus at most 3 separately budgeted metadata/account calls. Reserve before dispatch; stop on unknown/exhausted budget or quota floor. Per-fixture and sport-batch requests have different coverage.
4. Run `scripts/provider-trial.ts` with approved mapping/rights JSON, then `scripts/provider-comparison.ts`; see [input conventions](PROVIDER_COMPARISON.md). Record request/source times, missing outcomes, mapping rejects, latency, finite safe error codes, quota evidence, payload hashes and rights. Missing key returns NOT_CONFIGURED without calling.
5. Preserve unmatched/rejected records and require sufficient independent standard sources for Market Reference. No guessed mappings, highest-price cherry-picking or actual publication.
6. Populate [REAL_DATA_QUALITY](REAL_DATA_QUALITY.md), revise recommendations from measurements, and seek approval separately before paid history. One successful poll does not establish uptime.

Pass criteria concern data usability and bounded cost, not ROI or opportunity count. Historical outcomes must not be used to tune Strategy V1 during provider selection.
