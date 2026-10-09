> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Phase 5A controlled The Odds API trial

Prepared 4 October 2026 (Australia/Sydney), before any provider request in this phase. Branch: `codex/docked-value-platform`; initial clean source: `21e472b3670c1e6da1893e6ec4522100f87cb602`.

**Owner clarification, 4 October 2026:** use the **Free plan for now**, with a public allowance of **500 credits/month**. History is **NOT_INCLUDED**: no historical probe, sample or purchase. The current requested sequence is therefore at most **9 credits** (three one-region H2H calls, plus three optional two-credit scores inspections). Remaining balance and actual usage require recorded response headers; the monthly allowance is not an inferred balance.

The original predeclared envelope was 19 credits, including a conditional ten-credit historical sample only if a paid entitlement already existed. That conditional branch is now withdrawn. The smaller nine-credit sequence below supersedes it; the cumulative 250-credit/25-attempt safety ceiling is retained as a ceiling, not a spending target or authority to retry.

## Decision and limits

Rights decision: **APPROVED_FOR_PREVIEW_TRIAL** under the dated review in [DATA_RIGHTS](DATA_RIGHTS.md). This is an engineering decision for the owner's described consumer application, not production activation or a strategy validation. No clarification is required for the limited application uses currently reviewed. New raw-feed/export products or bookmaker-logo use are excluded.

- Only Docked Preview: Vercel `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, team `team_tf6xweKKyVCj9bTppUKttJ4l`, Supabase `bckkllmndoxzpzdqrevb`, Docked organisation `ernfnkcbalhyqpsrzdwa`.
- **250 credits maximum across the entire trial**, not per run, process, month or user; at most 25 manual request attempts. Begin with the much smaller sequence below. Quota, expiry and reviewed scope can impose stricter limits.
- General/legacy polling, scanner scheduling, official publication, forward paper and outbound delivery stay false. A one-use, expiring manual permit is required for each fixed request scope; reserve before network I/O, retain uncertain charges, deny replay/concurrency beyond the remaining budget.
- The sensitive API key stays in the Vercel server environment. No key retrieval, query-string logging, browser use, client bundle or APK copy.
- Raw responses remain private with seven-day operational retention, additionally bounded by the active approval. Retained canonical/audit records remain private or minimally projected for the application. No raw download/bulk export is added.
- Next terms review: **4 November 2026**, sooner on changed terms/product scope. An overdue/revoked review stops new reliance on data. Existing evidence is handled according to the recorded licence and retention rules.

## Predeclared request sequence

1. Once guard tests and the exact hosted identity checks pass, make one quota-free `/v4/sports` request. Save response time, selected active catalogue keys and usage headers privately. The owner has confirmed Free, while actual remaining credits stay unmeasured until a valid response. A balance alone must not imply paid historical entitlement.
2. Select only `soccer_epl`, optional active `soccer_spain_la_liga`, and `basketball_nba`; use one `au` region and `h2h` decimal prices, upcoming events only. Start with **one competition/request**, inspect before continuing. Three such calls forecast at most three credits; empty responses may cost less but reservations are not refunded speculatively.
3. For `americanfootball_nfl`, use a quota-free event catalogue request while exact moneyline tie/overtime rules remain unsupported. Do not fetch/construct NFL market benchmarks to bypass that restriction.
4. If account response/entitlement supports it, inspect at most one recent score response per selected sport (up to six credits across football/NBA/NFL with `daysFrom=3`). A completed flag and scores do not establish full cancellation, correction or overtime settlement authority.
5. **No historical call:** the confirmed Free plan excludes history. Record **NOT_INCLUDED** without probing the endpoint, sampling, buying or running a backtest. The existing replay preparation remains available for a separately authorised future dataset.

The revised planned credit envelope is at most **9 credits**, within the hard ceiling. Quota-free catalogues still count against the manual attempt limit. Additional calls require another explicit scoped manual permit, observed remaining balance and the same cumulative cap. No automatic retries or schedule. Failed or uncertain attempts remain recorded and are not erased to repeat the sequence; distinguish a planned reservation, an HTTP attempt and an observed provider charge in the final receipts.

## Acceptance and truthful fallbacks

Canonical provider IDs prevent duplicate events; changed participants/start times require review. Market timestamps govern freshness. Unknown ownership, standard-price classification or insufficient independent sources leave **REFERENCE UNAVAILABLE**. Pricing research and availability references remain separate; a research consensus is not Docked Fair or estimated EV.

Real upcoming fixtures may populate the existing Today/Upcoming/Watchlist surfaces only under their existing member/jurisdiction permissions. This does not grant ordinary region authority or convert a social tester grant into market-data permission. The community composer can submit only when its existing server-controlled benchmark checks pass. Personal promotional odds never replace the benchmark.

Scanner dry-run output is data quality/research only: **MODEL PROBABILITY UNAVAILABLE** without an approved model. Strategy remains **UNVALIDATED**; official live Edges are **OFF**; forward paper is **NOT STARTED**. Results remain pending until a sufficiently specified authorised outcome source is established.

Record measured data quality, request receipts, quota changes, failures and unresolved access separately from planned assumptions. Do not label unknown counters zero merely because no successful sample exists.
