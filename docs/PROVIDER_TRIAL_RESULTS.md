> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Provider trial results — 4 October 2026

**The Odds API controlled Preview trial completed; further calls stopped.** Nine request-ledger attempts remain: **eight SUCCESS and one initial FAILED**. Successful responses report **nine credits**, with final headers showing **491 remaining / 9 used** on the owner's confirmed Free plan. The first failure has no quota headers, so the all-attempt reported-credit sum remains **UNKNOWN**, not zero or a manufactured fully measured total.

Evidence: [final request/quality ledger](qa/phase5a/operator/trial-report.json), read at 2026-10-03 23:47:33.858 UTC; [aggregate quality receipt](qa/phase5a/quality-analysis.json); [preserved first-request incident](qa/phase5a/DRIVER_INCIDENT.md). All activity was scoped to Docked Preview, Supabase `bckkllmndoxzpzdqrevb`, under **APPROVED_FOR_PREVIEW_TRIAL**. No provider key is in these receipts. This is not production activation or strategy validation.

## Measured requests and cost

| Operation                          | Recorded outcome | Header-reported credits | Balance after response | Factual output                               |
| ---------------------------------- | ---------------- | ----------------------: | ---------------------: | -------------------------------------------- |
| Initial sports catalogue           | FAILED, retained |                 UNKNOWN |                UNKNOWN | No canonical import; missing headers         |
| Reviewed sports catalogue request  | SUCCESS          |                       0 |                    500 | 87 catalogue entries                         |
| EPL current H2H, one AU region     | SUCCESS          |                       1 |                    499 | 20 events; 6 imported; 60 source vectors     |
| NBA current H2H, one AU region     | SUCCESS          |                       1 |                    498 | 44 events, all beyond seven days; 0 imported |
| La Liga current H2H, one AU region | SUCCESS          |                       1 |                    497 | 20 events; 5 imported; 50 source vectors     |
| NFL events catalogue               | SUCCESS          |                       0 |                    497 | 28 events; 16 imported; no odds requested    |
| EPL scores, three-day inspection   | SUCCESS          |                       2 |                    495 | 20 events; 0 completed; 0 with scores        |
| NFL scores, three-day inspection   | SUCCESS          |                       2 |                    493 | 29 events; 1 completed; 1 with scores        |
| NBA scores, three-day inspection   | SUCCESS          |                       2 |                    491 | 44 events; 0 completed; 0 with scores        |

The successful sequence used the revised planned nine-credit envelope: three current-odds credits plus six scores-inspection credits. The 250-credit / 25-attempt limits were safety ceilings, not targets. No paid plan was purchased, historical request made or schedule enabled. Final headers corroborate account usage of nine credits without filling the missing charge on the first failure. See [usage scenarios](PHASE5A_PROVIDER_COSTS.md).

Successful attempt durations were 0.324–2.228 seconds from ledger start to completion, including Docked validation and persistence. This one-pass sample does not estimate provider latency, availability or error rate. The failure was a Docked driver integration defect, not evidence of a provider outage.

## What the sample establishes

- **27 canonical real fixtures**: EPL 6, La Liga 5, NFL 16. NBA's earliest returned event was beyond the declared horizon; zero imports does not mean no NBA feed.
- **11 canonical football markets**, 110 complete source vectors from 10 bookmaker identifiers, **330 selection prices**. Every vector has home/away/draw outcomes matching its rules.
- Source timestamps were 2.549–102.239 seconds old at receipt. None was future-dated or over 180 seconds then; all became stale after polling stopped.
- Intentional rejection accounting: EPL 132 out-of-window vectors plus 12 exchange vectors; La Liga 129 plus 10; NBA 155 out-of-window vectors. The mixed-grain `mappingFailures` field is not an error rate.
- All price classifications remain **UNKNOWN_REVIEW**. Ten bookmaker labels do not establish ten independent operators. Pricing/availability cohorts are empty: reference availability, outliers and source disagreement are **UNMEASURED**.
- Scores inspection found one completed NFL event with scores. The required result lifecycle was not qualified; **RESULTS_PROVIDER_STATUS=NOT_CONFIGURED**, no automatic settlement.
- Owner-confirmed **Free: 500 monthly credits, history NOT_INCLUDED**. Zero historical requests, no dataset, backtest, paper selections or strategy-performance claim.

The [quality report](REAL_DATA_QUALITY.md) explains grains, denominators and exclusions. Immutable early reference diagnostics contain sentinel values while unconfigured; current projections normalize those metrics to null. They are not empirical zero-outlier or zero-availability findings.

## First failure and controlled recovery

The first zero-reservation sports operation returned HTTP 409 and retained FAILED with unknown charge. Hosted diagnosis showed that the installed `postgres` 3.4.9 reserved connection has no runtime `begin()` method, and an already stringified JSONB parameter becomes a JSON string. The repair uses explicit transaction commands on the same reserved connection and typed JSON parameters. An offline test now exercises the actual pinned driver, injected provider response, quota-handler SQL and completion serialization.

An append-only, MFA-reviewed recovery record acknowledges only that exact first legacy failure. The original row, attempt count, null charge and circuit history remain; no credit refund, counter reset or automatic retry occurred. Later operations each used a separately scoped single-use permit. [Incident and evidence](qa/phase5a/DRIVER_INCIDENT.md)

## Decision and remaining gates

**Recommendation: usable limited fixture/watchlist sample; insufficient evidence for verified references, automated settlement, historical research or betting advantage.** Stop at the completed sample. Any further cadence needs separate approval, measured quota headroom and reviewed scope. Resolve standard-price eligibility, ownership and disjoint cohorts before reference testing; retain the 180-second freshness rule. An authorised outcome lifecycle and paid historical entitlement/data are separate prerequisites.

The ledger baseline still records zero enabled feature flags, zero official publications, zero sent outbox records and zero ordinary region approvals. General polling, automatic scanner scheduling, forward paper, official publication and real email/push delivery remain closed. Real sporting imports do not confer member jurisdiction permission or convert preview simulations into genuine records.

## Earlier Phase 5 baseline, preserved

Before Phase 5A authorisation, Phase 5 found no provider key in process, `.env.local` or the verified Preview environment and made zero provider requests. Its metadata-only audit is retained at `private-data/phase5/provider-configuration-audit.json`. That historical NOT RUN finding is superseded for The Odds API by this sample; it was not an incorrect zero-data measurement. OddsPapi was not called or reevaluated in Phase 5A, and no provider comparison is claimed.
