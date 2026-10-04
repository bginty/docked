# Phase 5A — The Odds API usage model

Reviewed **4 October 2026**. The owner confirmed **Free for now** on that date: the public allowance is **500 credits/month at $0**, with history **NOT_INCLUDED**. The completed manual trial's final measured headers show **491 remaining / 9 used** at 2026-10-03 23:47:15 UTC. All future cadence scenarios below are **hypothetical planning calculations**, not an upgrade, activation instruction or claim that source coverage passed. The measured trial is recorded separately in [PROVIDER_TRIAL_RESULTS](PROVIDER_TRIAL_RESULTS.md).

## Measured manual trial

The [retained request ledger](qa/phase5a/operator/trial-report.json) contains nine attempts: eight successful responses and one first-attempt Docked driver failure. Successful response charges sum to **nine credits**: EPL, NBA and La Liga current odds cost one each; EPL, NFL and NBA three-day scores inspections cost two each; the successful sports and NFL event catalogues reported zero. The first failed catalogue attempt has no usage headers, so its charge and the sum over **all** attempts remain unknown. Final account headers corroborate used=9 and remaining=491 without filling that historical null. No purchase or historical request occurred; calls are stopped. The measured nine-credit sequence matches the revised planned envelope, while the 250-credit/25-attempt caps remain ceilings rather than targets. This sample does not grant permission to spend the remaining balance.

## Meter and account evidence

For the implemented simple-current-odds request, budget `markets × regions` credits per competition poll. Explicit bookmaker groups, if enabled later, replace region counting: each group of up to ten books counts once. Current sport/event catalogues have no documented credit cost. A three-day scores inspection costs two credits; featured historical snapshots cost ten times market/region count. Response quota headers are the measurement authority; Docked reserves conservatively before attempting a request, including failures. [V4 quota documentation](https://the-odds-api.com/liveapi/guides/v4/)

Advertised monthly USD plans at review: Free 500 credits; 20,000 **$30**; 100,000 **$59**; 5,000,000 **$119**; 15,000,000 **$249**. History is excluded from the owner's confirmed Free plan and included in the listed paid plans. Paid prices are comparison information only; taxes and conversion fees are not established. [Official plans](https://the-odds-api.com/#pricing)

Credits reset at the beginning of the calendar month; paid subscription billing follows its billing cycle. The owner's Free-plan confirmation establishes that history is not included; a current-data call or remaining-credit number must not override that restriction. No upgrade is authorised. [Account FAQ](https://the-odds-api.com/manage/faqs.html)

## Manual trial ceiling

The initial design caps the entire reviewed trial at **250 credits and 25 attempted requests**, including zero-credit metadata requests. These are ceilings, not targets. A request needs a fresh single-use, expiring permit bound to operation/competition and configuration. Only one outstanding reservation may exist; a crash or missing completion requires operator review, not automatic retry. Known provider balance must cover a paid call. Missing quota stays unknown, and unexpected extra cost or request failure withdraws the trial source until reviewed.

The free sports catalogue is the smallest available quota/header inspection. The initial odds sample remains one approved competition, `h2h`, decimal prices, one reviewed region. NFL uses the free events catalogue while its market rules are unresolved. A scores inspection is separate and never activates settlement. History has **zero calls: NOT_INCLUDED on Free**. Do not probe that endpoint or run a historical sample. No automatic polling is enabled.

## Free-plan lean beta proposal — not activated

The Free plan can support a small fixture/watchlist beta, but not a continuously fresh verified-price service across three sports. After the manual trial passes, a separate schedule review could consider two selected observation windows per day, one football competition and NBA, with NFL facts from the free events catalogue. Skip inactive competitions and unnecessary requests; never poll separately for each user.

| Monthly assumption, 30 days                              |  Current supported scope | Only if NFL odds rules qualify later |
| -------------------------------------------------------- | -----------------------: | -----------------------------------: |
| Current H2H requests, one region, twice/day/key          | 2 × 2 × 30 = 120 credits |             3 × 2 × 30 = 180 credits |
| Explicit 20% contingency                                 |                       24 |                                   36 |
| Optional bounded scores inspections, at most three/month |                        6 |                                    6 |
| Planned upper allocation                                 |          **150 credits** |                      **222 credits** |
| Historical calls                                         |                    **0** |                                **0** |
| Plan cost                                                |             **$0/month** |                         **$0/month** |

These are future schedule estimates, not extra trial permits. The current 25-attempt manual ceiling remains in force; scheduling requires separate authorisation and an appropriate reviewed configuration. Count all trial and other account consumption against the same 500-credit calendar-month allowance. A conservative future monthly ceiling of 400 would preserve 100 credits of headroom: if the initial trial consumed its full 250, only 150 would remain within that ceiling. Reduce scope or stop if the measured balance is lower; do not assume a fresh 500-credit balance. Free catalogue requests still need bounded frequency and request-count controls even though their documented credit charge is zero.

Two daily price observations will be stale for most of the day under the 180-second rule. Fixture facts may remain useful, while references must show unavailable whenever stale or insufficiently qualified. This proposed cadence is deliberately limited to an honest watchlist experience; it does not enable community verification, Docked Edges or a validated model.

## Higher-frequency comparisons — exceed the current Free plan

One shared ingestion serves all users. User count does not multiply provider requests. The scenarios assume 30 days, every listed competition active during every stated polling window, one simple market, no in-play polling and no additional per-event calls. Real scheduling can be lower when competitions are inactive or have no near-term events. NFL odds in these future scenarios require a separate completed rules review; the current implementation uses NFL fixtures only.

Formula: `competition keys × hours/day × 60 ÷ interval minutes × 30 × markets × region equivalents`.

| Assumption                                           |                 Lean beta |                 Normal beta |          Early production |
| ---------------------------------------------------- | ------------------------: | --------------------------: | ------------------------: |
| Competition keys                                     | 3: one football, NBA, NFL | 5: three football, NBA, NFL | 8: six football, NBA, NFL |
| Polling window, hours/day                            |                         4 |                          12 |                        18 |
| Interval, minutes                                    |                        15 |                          10 |                         5 |
| Markets per request                                  |                         1 |                           1 |                         1 |
| Region equivalents                                   |                         1 |                           1 |                         2 |
| Planned current-odds credits/month                   |                     1,440 |                      10,800 |                   103,680 |
| Explicit 20% current-data contingency                |                       288 |                       2,160 |                    20,736 |
| Optional scores: one three-day call/key/day          |                       180 |                         300 |                       480 |
| Total with contingency and optional scores           |                 **1,908** |                  **13,260** |               **124,896** |
| Smallest advertised tier covering this assumed total |        20k: **$30/month** |          20k: **$30/month** |        5m: **$119/month** |

The contingency is a planning allowance, not permission for unattended retries. Without a qualified results adapter, the optional scores line is not a settlement service. These projections exceed Free; reducing scope/cadence can reduce the requirement. None requires buying a plan now. The large jump between 100k and 5m is the published tier structure, not a recommendation to consume that allocation.

Historical research would be additional, separately authorised consumption under a future paid entitlement: `snapshots × competition keys × markets × region equivalents × 10`. For example, 100 requested snapshots of one key, market and region would budget **1,000 credits**. This is comparison arithmetic only: **no such requests are permitted under the current Free-plan task**. Historical results acquisition costs remain **UNKNOWN** until an authorised outcome source is chosen. [Historical documentation](https://the-odds-api.com/historical-odds-data/)

## Conditional cadence recommendation

Keep the manual-only state until actual response costs, source age, missingness, failure behaviour and useful fixture coverage pass review. For the confirmed Free plan, use the limited observation-window proposal above as the starting point for a later review. Far-from-event 60 minutes, within 24 hours 15 minutes, and within three hours 5 minutes is a higher-frequency comparison only; it requires recalculating the active competition/window budget and is not a Free-plan default. No in-play polling is proposed.

Those intervals can support a watchlist, but **cannot keep a 180-second verified-price freshness window continuously available**. A future verified-reference service would need narrowly scheduled refreshes inside that window, sufficient independent approved sources and an approved quota budget. Otherwise the interface must show unavailable/stale between observations; never relax freshness to match a cheaper poll rate. Source timestamps remain decisive even after a successful HTTP call. Provider nominal refresh intervals are not a guarantee of obtainable prices. [Update intervals](https://the-odds-api.com/sports-odds-data/update-intervals.html)

Before any later schedule: measure remaining/reset evidence for the confirmed Free plan, select exact competitions/regions/books, review source classification and ownership, project monthly use including the existing trial, reserve a hard cap, and obtain separate activation approval. Current strategy remains UNVALIDATED, forward paper NOT STARTED and official publication OFF. See [rights decision](DATA_RIGHTS.md), [provider evaluation](ODDS_PROVIDER_EVALUATION.md) and [overall infrastructure costs](COST_MODEL.md).
