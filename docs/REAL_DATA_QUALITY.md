> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Real data quality — 4 October 2026

**Measured, bounded Preview sample; not a validated pricing or results service.** The authorised The Odds API trial retained 27 real upcoming fixtures, 11 canonical football markets and 110 bookmaker-market vectors containing 330 individual selection prices. Standard-price classification and bookmaker independence remain unverified, Market Reference is NOT_CONFIGURED, model probability is unavailable, and no official Edge or performance result was created.

The [final trial ledger](qa/phase5a/operator/trial-report.json) was read at **2026-10-03 23:47:33.858 UTC** (4 October in Sydney). Additional [aggregate evidence](qa/phase5a/quality-analysis.json) and [read-only SQL](qa/phase5a/quality-analysis.sql) verify retained data without exporting raw responses. These are one-pass observations, not estimates of uptime, long-run missingness or full competition coverage.

## Grain and declared scope

Current-odds requests used one `au` region, `h2h`, decimal prices, a **168-hour upcoming horizon** and a maximum of 50 imported events per response. Retained football markets are regulation 90 minutes plus stoppage time, with home/away/draw outcomes. NFL was fixture-catalogue inspection only. The NBA request returned future events, but none within the horizon.

- A **fixture** is a canonical provider-mapped event.
- A **market** is one canonical event/rules combination.
- A **source vector** is one bookmaker's complete market prices at one observation; the importer field `quotesImported` counts vectors.
- A **selection price** is one outcome inside a vector. All 110 retained vectors have exactly three outcome keys matching their stored rules, including Draw: 180 EPL prices and 150 La Liga prices.

| Scope                              | Raw events returned | Beyond seven days | Imported fixtures | Canonical markets | Retained source vectors | Selection prices |
| ---------------------------------- | ------------------: | ----------------: | ----------------: | ----------------: | ----------------------: | ---------------: |
| EPL current odds                   |                  20 |                14 |                 6 |                 6 |                      60 |              180 |
| La Liga current odds               |                  20 |                15 |                 5 |                 5 |                      50 |              150 |
| NBA current odds                   |                  44 |                44 |                 0 |                 0 |                       0 |                0 |
| NFL event catalogue                |                  28 |                12 |                16 |                 0 |                       0 |                0 |
| **Total for these four responses** |             **112** |            **85** |            **27** |            **11** |                 **110** |          **330** |

All 27 in-window events were retained; none of these 112 events had already started at receipt. The imported share, 27/112 (24.1%), reflects the intentionally limited horizon, **not a 75.9% provider failure or missingness rate**. The earliest returned NBA start was 20 October 2026. NFL odds were not requested, so zero NFL markets does not measure price coverage. Scores-response events are a separate sample and are not added to this table.

## Exclusions and mapping

| Current-odds scope | Returned source-market vectors | Outside-horizon vectors | In-window exchange vectors excluded | Accepted bookmaker vectors | Total rejected vectors | Importer's `mappingFailures` counter |
| ------------------ | -----------------------------: | ----------------------: | ----------------------------------: | -------------------------: | ---------------------: | -----------------------------------: |
| EPL                |                            204 |                     132 |                                  12 |                         60 |                    144 |                                   26 |
| La Liga            |                            189 |                     129 |                                  10 |                         50 |                    139 |                                   25 |
| NBA                |                            155 |                     155 |                                   0 |                          0 |                    155 |                                   44 |
| **Total**          |                        **548** |                 **416** |                              **22** |                    **110** |                **438** |                               **95** |

The 22 in-window exchange vectors are `betfair_ex_au`; exchange support is disabled. Every rejected vector in these three responses is accounted for by horizon or exchange exclusion. No in-window source had an unmapped bookmaker identifier. The `mappingFailures` field mixes units: EPL is **14 excluded events + 12 exchange vectors**; La Liga **15 + 10**; NBA **44 excluded events**. It must not be divided by event or vector counts and presented as a mapping-error rate. The canonical mapping table has 27 rows and **zero duplicate provider-event identifiers**; that does not prove future cross-provider matching.

The 10 retained bookmaker identifiers are `betr_au`, `betright`, `ladbrokes_au`, `neds`, `playup`, `pointsbetau`, `sportsbet`, `tab`, `tabtouch` and `unibet`. Each contributed 11 vectors. Mapped `bet365_au` and `dabble_au` were absent from retained in-window vectors; general availability is not established. Bookmaker identity is not independent-ownership evidence: no independent cohorts were approved.

## Freshness, shape and unresolved quality

| Check                                             | Measured result and limitation                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Complete retained outcomes                        | 110/110 vectors have three rule-matching outcomes including Draw; 330 individual prices                                     |
| Decimal range                                     | 1.03–36; descriptive range, not an outlier or betting recommendation                                                        |
| Market timestamp provenance                       | 110/110 use `market_observation`; no retained missing timestamp or bookmaker-wide fallback                                  |
| Source age at receipt                             | EPL 11.239–102.239 seconds; La Liga 2.549–77.549 seconds                                                                    |
| Future or stale at receipt                        | 0/110 future; 0/110 over the 180-second limit                                                                               |
| Stale later                                       | 90/110 at the final ledger read; 110/110 by the 23:49:57 UTC aggregate check. No automatic refresh                          |
| Retained JSON shape                               | 110/110 snapshot payloads are objects; seven private raw responses are arrays                                               |
| Mapping/manual review                             | 27 mapped events; zero duplicate mapped IDs; zero mapped events in manual review at report time                             |
| Raw retention                                     | Seven responses, none expired at report time; earliest expiry 10 October 2026 23:42:07.239 UTC                              |
| Standard-price classification                     | 110/110 are `UNKNOWN_REVIEW`; ordinary-looking prices do not prove eligibility                                              |
| Pricing / availability reference                  | **NOT_CONFIGURED / UNMEASURED**: source lists empty; no availability rate or independence claim                             |
| Cross-source outliers / disagreement              | **UNKNOWN / UNMEASURED** without eligible cohorts; price range is not an outlier test                                       |
| Suspended, closed, postponed or corrected markets | **UNKNOWN** lifecycle coverage. Unsupported explicit fields are rejected, but absence/disappearance cannot establish status |
| Historical decision/delay/closing coverage        | **NOT_INCLUDED** on Free; zero historical requests, no dataset or replay                                                    |

Raw retention is seven days and bounded by approval. Canonical evidence and audit records follow separate documented retention rules; this report does not authorise bulk export or raw-feed publication.

## Diagnostics that are not measurements

The first immutable data-only diagnostic records precede the blocked-reference projection repair. They include placeholder zeros for outliers/stale observations and a sentinel excluded count while `status=NOT_CONFIGURED`. Those fields are **not measured counts**. Their `pricingReady=0` / `availabilityReady=0` cannot establish a 0% availability rate without a configured eligible universe. Their bounded selection listing is not the complete market universe. Current read projection normalizes blocked/unconfigured reference metrics to null without rewriting historical records.

The separately queried source timestamps and raw-vector exclusions above are genuine measurements. `providerRequests=0` in a data-only diagnostic means that diagnostic performed no additional HTTP requests; the trial ledger is the authority for the nine recorded attempts.

## Results inspection and next decision

Separate score inspections returned EPL 20 events with zero completed/scored, NFL 29 with one completed/scored, and NBA 44 with zero completed/scored. `settlementReady=false` throughout. One populated NFL score response does not qualify cancellation, postponement, abandonment, regulation/overtime, manual review or corrections. Results remain NOT_CONFIGURED and settlement pending.

One initial Docked driver failure and its reviewed repair remain in [trial results](PROVIDER_TRIAL_RESULTS.md) and the [incident record](qa/phase5a/DRIVER_INCIDENT.md). Successful request-ledger durations were 0.324–2.228 seconds, including server processing and persistence; they are not isolated provider latency or an uptime sample.

The sample supports **bounded fixture/watchlist integration readiness only**. Before another separately approved trial, specify standard-price evidence, ownership groups, pricing versus availability cohorts, region and rules; then measure reference availability over a predeclared decision-time universe. Keep source-age limits unchanged. An authorised result lifecycle and, for historical research, a separately authorised paid dataset remain prerequisites. No ROI, CLV, calibration or strategy advantage was measured.
