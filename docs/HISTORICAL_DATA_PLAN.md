> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Historical data and acquisition gate — 4 October 2026

## Phase 5B supersession — 4 October 2026

The revised forward-only product direction supersedes any historical Docked betting-performance or historical betting ROI launch gate below. No retrospective Docked tips or profits will be reconstructed. Historical sporting statistics remain valid licensed model inputs; chronological model calibration, data-quality and software replay tools remain available. The official record starts only at its first genuine prospective live publication. See [model architecture](DOCKED_MODEL_ARCHITECTURE.md), [forward calibration](FORWARD_CALIBRATION.md) and [official record](OFFICIAL_RECORD.md). Older design details below are preserved as research/historical context, not current live-release prerequisites.

No historical dataset was bought, imported or evaluated in Phase 5. No strategy edge is established. Initial scope: football 1X2 and NBA moneyline; NFL only after exact tie/settlement semantics qualify. No props, racing, in-play or parlays.

## Coverage matrix

| Dimension                         | The Odds API                                                                                  | OddsPapi                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Advertised earliest featured odds | June 2020; EPL/NFL 6 June, NBA 27 June                                                        | January 2026 onwards                                                    |
| Cadence                           | Ten-minute initially; five-minute from September 2022                                         | Outcome changes, not regular executable-price observations              |
| Access                            | Paid historical endpoint                                                                      | Up to three books/call; account quota must not be exhausted             |
| Decision timestamp                | Nearest archive snapshot at/before request                                                    | Last non-ambiguous active change at/before decision                     |
| Book/market coverage per period   | UNKNOWN until sampled; only after actual addition                                             | UNKNOWN until sampled/account scope verified                            |
| Clocks                            | Source, archive snapshot and receipt distinct                                                 | Change creation, fixture update and receipt distinct                    |
| Missingness / delays / outliers   | UNKNOWN                                                                                       | UNKNOWN                                                                 |
| 2022–2025 chronology              | May support it; not qualified                                                                 | Not supported by documented start date                                  |
| Historical outcomes               | Not established; recent scores are not an archive                                             | Settlement endpoint exists; archive/correction completeness unverified  |
| Rights                            | Storage/research/derived integrated use in terms, subject to restrictions and Docked approval | Written confirmation needed for Docked retention/derived display/export |
| Featured archive request cost     | 10 × regions × markets credits                                                                | Unbilled; cooldown and quota-exhaustion gate still apply                |

Evidence: [The Odds API archive](https://the-odds-api.com/historical-odds-data/), [API](https://the-odds-api.com/liveapi/guides/v4/), [terms](https://the-odds-api.com/terms-and-conditions.html); [OddsPapi history](https://oddspapi.io/en/docs/get-historical-odds), [quota](https://oddspapi.io/en/docs/requests-and-quota), [terms](https://oddspapi.io/en/legal/terms). Marketing availability is not completeness.

## Chronological windows

Preferred, **conditional** on genuine odds plus authorised outcomes: development 2022–2023; validation 2024; untouched held-out 2025; fixed-rule 2026 YTD retrospective. Freeze the inventory/splits before opening outcomes. Book/operator mappings must be effective at the historical instant, not projected backwards.

If only 2026 qualifies, a provisional alternative is January–March development, April–June validation, July–September untouched retrospective test, then prospective collection from a preregistered October start. Adopt only after sample sizes, season gaps, missingness and independence are assessed **without outcome performance**. NBA seasonality may make this unusable; defer evaluation/collect prospective data rather than fabricate samples.

Five/ten-minute archives cannot guarantee exact one-minute availability. Missing 1/5/15/60-minute samples remain missing unless a predeclared tolerance admits an actual observation. Never interpolate executable prices.

## Required spending approval record

Before acquisition specify provider, mechanism, competitions, full rules/markets/books, dates, cadence, distinct request count, credits, monthly plan/cost, retained bytes, rights and expected research value. Count decision/delay/closing/retry requests and existing live usage. Deduplicate only truly shared requests. Results acquisition is separate.

Illustrative **budget envelopes**, not import recommendations or coverage proof:

| One-region/one-market requests | Credits with 20% headroom | Listed tier     | Purpose                      |
| -----------------------------: | ------------------------: | --------------- | ---------------------------- |
|                          1,000 |                    12,000 | $30/month, 20k  | Small coverage pilot         |
|                         60,000 |                   720,000 | $119/month, 5m  | Broader conditional research |
|                        500,000 |                 6,000,000 | $249/month, 15m | Dense sensitivity envelope   |

[The Odds API prices](https://the-odds-api.com/#pricing). **Do not purchase.** Required request count, outcomes cost and total are UNKNOWN until inventory. OddsPapi paid account cost UNKNOWN; unbilled history is not a promise of every book for free.

## Reproducibility

Reuse `npm run research -- ...` import/validate-data/freeze-strategy/replay/stress-test/report and the existing pricing engine. Keep source hashes, snapshot IDs, actual receipt, reviewed archive-availability evidence, mapping versions and exclusions. A new download never becomes an old local observation.

Only data available by decision time may generate candidates. Closing odds, later movement/features and results are evaluation-only. Preserve code/config/manifest hashes, ordered selections, splits, delays/missingness, calibration/uncertainty and losses. Unknown outcomes remain pending. Material changes after held-out inspection require a new version and disclosed validation plan.
