# Odds provider evaluation — no provider selected

Both **The Odds API** (`the-odds-api.com`, not similarly named services) and **OddsPapi** have trial adapters behind `OddsProvider`. No key was fabricated, provider API called, plan purchased, or provider permanently configured during Phase 4. Their absent-key status remains `NOT_CONFIGURED`. The comparison objective is a reliable standard market reference and probability-research evidence, rather than exhaustive bookmaker coverage.

## What is implemented

The existing The Odds API adapter supports mapped current and historical complete head-to-head markets, conservative quota reservation and no-look-ahead historical snapshots. Its documented historical requests cost ten credits per region/market and return an earlier-or-equal snapshot. Actual rights and market coverage still require review. [Official API documentation](https://the-odds-api.com/liveapi/guides/v4/)

Current responses must now include the market-level observation timestamp. The documented bookmaker-wide timestamp is deprecated and cannot prove that a particular market is fresh. Explicit historical imports may retain the older fallback, labelled `sourceTimestampKind: bookmaker_legacy`; it is never silently promoted into current evidence. Missing current timestamps reject the market, with a regression covering the previously unsafe fallback.

The new OddsPapi trial adapter fetches one explicitly mapped fixture per instance through `/v4/odds`. It validates provider fixture, participant, sport/tournament and start identifiers plus complete outcome mapping. It preserves source/receipt times and rejects inactive, ambiguous, incomplete or exchange outcomes. Changed-price timestamps are not evidence that an unchanged old price was freshly re-observed; conservative staleness remains intentional. Standard-price classification is not inferred from an ordinary market response. [Current odds documentation](https://oddspapi.io/en/docs/get-odds)

Its historical adapter fetches `/v4/historical-odds` and reconstructs each mapped outcome from its last eligible change at or before the requested time. Inactive and simultaneous ambiguous revisions fail closed. The download's actual receipt time remains modern, and the requested decision point is labelled as a derived snapshot with a content identifier. The provider currently documents history since January 2026, so this source must **not** be assumed to support the planned 2022–2025 windows. [Historical documentation](https://oddspapi.io/en/docs/get-historical-odds)

OddsPapi current requests reserve one local trial credit before attempting the request, including failures. Historical requests are documented as free but still blocked when the account quota is exhausted; request cooldowns remain enforced. Provider remaining/used values stay null until an independently authorised account read verifies them. The local reservation is never misreported as provider quota. [Requests and quota](https://oddspapi.io/en/docs/requests-and-quota)

## Approval and evaluation gates

Before any real trial supply dedicated keys, reviewed request/retention budgets and rights covering exact regions, commercial display, storage, derived references, historical use and export. Supply explicit event/market/outcome and bookmaker/operator mappings with effective evidence. Provider IDs or a paid plan do not prove ownership independence or standard non-promotional eligibility. Current adapters deliberately cannot manufacture this classification. Results-provider authority is separate; neither trial adapter currently settles outcomes.

Evaluate event/market coverage against a predeclared universe; mapping agreement; missing outcomes; source age; same-book standard price differences; outliers; observed failures; latency; known/unknown quota costs; requested historical snapshots; and separately demonstrated result availability. Preserve source payloads only where licensed, in ignored private storage. No provider winner or numerical comparison is claimed before observations exist.

The CLI is a bounded operator trial, not a production multi-process scheduler. Shared production quota leases and source-rights approvals remain necessary before integration into polling. See [comparison commands and limits](PROVIDER_COMPARISON.md).
