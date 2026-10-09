> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Provider comparison workflow

Status: **NOT RUN — credentials, source mappings and commercial trial/retention authority absent.** No comparison scores or fabricated provider history are supplied.

## Offline comparison

```sh
npx tsx scripts/provider-comparison.ts private-data/trials.json private-data/universe.json research-output/provider-comparison.json
```

This command makes no network calls. Input `trials.json` is an array of the `ProviderTrial` records defined in `src/providers/comparison.ts`. Each contains provider/competition, requested historical instant or null, actual request times/latency, success/failure/not-configured/quota status, capability evidence and the adapter result or null. Licensed raw payloads remain in the private input; the report contains only canonical comparison diagnostics and input hashes. Output is confined to ignored `research-output/`.

`universe.json` contains predeclared `eventIds: string[]` and optional `marketKeys: string[]`, where a market key is `canonicalEventId + ':' + hash(fullCanonicalRules)`. An empty denominator produces unknown coverage rather than fabricated zero coverage. Keep the expected universe independent of either provider's returned list.

## Later authorised preview trial

Only after separate trial authority and rights review:

```sh
# APP_ENV=preview; THE_ODDS_API_KEY and ODDSPAPI_API_KEY supplied securely by operator.
npx tsx scripts/provider-trial.ts --run-authorised-preview-trial private-data/provider-trial.json private-data/trials.json
```

The configuration contains `competition`, optional `asOf`, documented `rights`, `retentionApproved: true`, and two scopes:

- `theOddsApi`: approved `remaining` credit budget, `regions`, and exact existing `Mapping` (`events` and approved bookmakers/operators).
- `oddsPapi`: approved `remaining` request budget, requested `bookmakers` and `OddsPapiMapping` (`fixtureId`, canonical `rules`/`startAt`, source `sportId`/`tournamentId`/participant IDs, `marketId`, outcome-ID-to-canonical-selection mapping, `mappingEvidence`, and approved bookmaker/operator/ownership records).

The script reads keys only from environment variables, stores no persistent provider configuration, and requests each scoped provider once. `THE_ODDS_API_KEY` is preferred; `ODDS_API_KEY` is a legacy CLI alias only, and conflicting aliases are rejected. The separate hosted current-data path rejects the legacy alias. Missing keys produce NOT_CONFIGURED records without requests. A single configured source remains a useful coverage observation but cannot manufacture a cross-provider comparison. Errors are reduced to safe finite codes; credential-bearing URLs and provider exceptions are never printed. Run repeated polls only under a reviewed total budget and cooldown policy; do not create parallel instances to bypass reservation guards.

## Reading the report

Coverage uses canonical events and full-rule markets, missing event/market lists and mapping-failure counts. Price comparisons require the same canonical event, complete rules and bookmaker and snapshots within 90 seconds. Mismatches are retained but never become numeric agreement. Relative differences above the declared default 10% are labelled outliers; this is a diagnostic threshold, not a strategy setting. Lower-median request latency/source age, maximum source age, quota values and historical requested snapshots retain missingness.

Observed poll error fraction is **not continuous provider uptime**. Historical samples prove only those requested snapshots, not blanket yearly coverage. Results capability is reported only as adapter support; sporting outcomes must still pass separate rights and settlement verification. No ranking, selection, wagering or profitability claim is derived from this report. Neither adapter currently asserts standard-price classification for competitive records.

Deterministic tests use authored fictional payloads and mocked transports. They cover no provider, one provider, quota exhaustion, failed-call reservation, missing outcomes, event mismatch, historical future exclusion, unknown quota and multi-provider comparison. Tests are software evidence only.
