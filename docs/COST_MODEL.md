# Phase 5 ingestion cost model — checked 4 October 2026

**No purchases. Full operating cost UNKNOWN.** USD/month, before tax/FX. Provider cost follows monitored competitions, markets, source sets, active hours and cadence; it is not multiplied by registered members. Ingest once and serve authorised canonical views to many members. Current data trial spend is $0 because no provider request was made. Existing account invoices were not inspected.

### Planning scenarios

The Odds API current featured-market formula is `keys × active hours/day × 60/interval minutes × 30 days × markets × regions`. A key may represent a competition rather than a whole sport. One market per key below. The extra 20% is an explicit request reserve, not measured usage or a promise to cover unknown results/history costs.

| Assumption                                       | Lean beta | Normal beta | Early production | Higher-frequency production |
| ------------------------------------------------ | --------: | ----------: | ---------------: | --------------------------: |
| Approved competition keys                        |         2 |           3 |                3 |                           6 |
| Active hours/day                                 |         4 |          12 |               18 |                          24 |
| Poll interval minutes                            |        15 |          15 |                5 |                           2 |
| Regions                                          |         1 |           1 |                1 |                           2 |
| Monthly current-odds credits                     |       960 |       4,320 |           19,440 |                     259,200 |
| Credits with 20% reserve                         |     1,152 |       5,184 |           23,328 |                     311,040 |
| Smallest listed paid tier covering this estimate | 20k / $30 |   20k / $30 |       100k / $59 |                   5m / $119 |
| Hosting + two-project DB priced floor            |       $55 |         $55 |              $55 |                         $55 |
| Conditional subtotal before UNKNOWN categories   |       $85 |         $85 |             $114 |                        $174 |
| Complete monthly bill                            |   UNKNOWN |     UNKNOWN |          UNKNOWN |                     UNKNOWN |

Current prices: [The Odds API](https://the-odds-api.com/#pricing) (free 500 credits/month, no history; paid monthly tiers above), [Vercel](https://vercel.com/pricing) ($20 Pro developer seat including $20 usage credit), [Supabase](https://supabase.com/pricing) ($25 Pro, $10 compute credit covers one Micro, second Micro $10). These are hypothetical future paid floors, not subscriptions requested or bought. A temporary 500-credit trial is smaller than even the lean continuous scenario. OddsPapi paid scenarios are **UNKNOWN pending a real account quote**; its dynamic pricing page's unloaded zeros are not a price.

The scanner starts with a configurable 15-minute research cadence, independently of provider polling. It does not relax the 180-second source-age limit: many scans will correctly reject old observations. Near-event refreshes and 1/5/15/60-minute price monitoring require a separate quota forecast; no continuous freshness is promised at sparse polling frequency. No NFL research coverage or strategy expansion is assumed in the number of keys.

### Additional categories (all scenarios)

| Category                                 | Current / future treatment                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hosting overage / durable worker trigger | UNKNOWN from measured CPU, transfer, execution/cron needs; a local worker is not an operating hosted scheduler           |
| Database/auth scaling                    | $35 two-Micro paid floor above only; actual compute/MAU/storage capacity UNKNOWN                                         |
| Raw/canonical/object storage             | UNKNOWN retained bytes, rights and retention; measure snapshots × sources × bytes plus indexes/backups                   |
| Email                                    | $0 external delivery in this phase; future consented volume/product approval separately budgeted in audience model below |
| Push                                     | Disabled; future provider/volume UNKNOWN                                                                                 |
| Historical odds                          | No recurring acquisition enabled; exact per-run manifest/budget/owner approval in HISTORICAL_DATA_PLAN                   |
| Results data                             | UNKNOWN, especially historical outcome/correction archive; no guessing or odds-only settlement                           |
| Monitoring                               | UNKNOWN external uptime, retention and on-call needs; existing consoles do not prove operational coverage                |
| Analytics                                | No separate vendor bought; internal events add database/retention load, UNKNOWN                                          |
| Domain                                   | UNKNOWN existing renewal invoice; DNS unchanged                                                                          |
| Backups                                  | Pro daily seven-day DB allowance; offsite/raw/object recovery UNKNOWN, no optional PITR purchase                         |
| Other infrastructure                     | UNKNOWN CI, private storage and supervised worker hosting                                                                |

The earlier 1k/10k/50k/100k audience estimates below remain labelled planning scenarios for web/email demand. They are not additional provider charges to add to the Phase 5 ingestion scenarios. Add shared current + historical + metadata/outcome credits before selecting a plan; never charge two whole subscriptions for one shared account by accident.

## Earlier audience model — checked 2 October 2026

USD per month, excluding tax and foreign-exchange charges. **The full operating cost is UNKNOWN.** The figures below are conditional, priced infrastructure floors; they exclude unquoted results rights and unmeasured capacity. They are not capacity guarantees or forecasts of tips, engagement or profit. No subscriptions, credits or services were purchased. This local preview sends no external email and makes no licensed-provider calls.

The previous model covered only 1k/10k/50k users and included arbitrary usage reserves. This revision adds 100k, low/base/high demand, separates every requested cost category and leaves unsupported prices UNKNOWN. It also corrects the earlier historical estimate: two snapshots per sport per day cannot reproduce two decision windows for events with different start times.

## Verified rate inputs

| Service              | Rate used                                                                                                                                                                                                                                                                                                                                  | Primary source                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Vercel Pro           | $20/month for one developer, with $20 usage credit. Extra compute/build/origin-transfer usage depends on region and measured use.                                                                                                                                                                                                          | [Vercel pricing](https://vercel.com/pricing)              |
| Supabase Pro         | $25/month, first Micro project covered; another Micro preview project adds $10. 100k MAU, 8 GB database/project, 100 GB file storage included. Above allowances: database $0.125/GB, files $0.0213/GB, uncached egress $0.09/GB. Larger compute is separate. Daily database backups retain seven days; optional PITR starts at $100/month. | [Supabase pricing](https://supabase.com/pricing)          |
| Resend email API Pro | $20/month for 50k emails; $0.90 per additional 1,000-email bucket. Scale starts at $90/100k. The calculations use Pro plus overage, conditional on suitability and permitted volumes.                                                                                                                                                      | [Resend pricing](https://resend.com/pricing)              |
| The Odds API         | 20k credits $30/month; 100k $59; 5m $119; 15m $249. Historical access is listed on paid tiers. These prices do not by themselves establish redistribution or archival rights.                                                                                                                                                              | [The Odds API pricing](https://the-odds-api.com/#pricing) |

## Activity assumptions

These are planning inputs, not observed analytics. Registered users are distinct from monthly active users (MAU). Page transfer uses decimal GB. A volume scenario with edge alerts is conditional on genuine, eligible selections; actual alerts may be zero.

| Input                                                    |                         Low |                         Base |                         High |
| -------------------------------------------------------- | --------------------------: | ---------------------------: | ---------------------------: |
| MAU / registered users                                   |                         20% |                          30% |                          60% |
| Pages / active member / month                            |                           5 |                           10 |                           30 |
| Average transfer / page                                  |                      250 KB |                       300 KB |                       500 KB |
| Separately opted-in digest members                       |                         25% |                          50% |                          75% |
| Digests / opted-in member / month                        |                           2 |                         4.33 |                         8.66 |
| Separately opted-in edge members                         |                          5% |                          10% |                          25% |
| Planning average edge messages / opted-in member / month |                           2 |                            4 |                            8 |
| Service/auth messages / registered member / month        |                         0.1 |                          0.2 |                          0.4 |
| Total planned email / registered member / month          |                        0.70 |                        2.765 |                        8.895 |
| Consent-based analytics                                  | 1 event/page for 10% opt-in | 2 events/page for 30% opt-in | 3 events/page for 60% opt-in |

Model formulas: `MAU = users × active share`; `views = MAU × pages`; `email = ceil(users × (digest share × digest frequency + edge share × edge frequency + service frequency))`. Email estimate = `$20 + $0.90 × ceil(max(email − 50,000, 0) / 1,000)`.

The email arithmetic uses a single API-delivery scenario because that matches the implemented adapter. It does **not** classify optional digests or sports alerts as transactional. Obtain written provider acceptance, permitted-content classification and volume/rate limits before sending. If Resend requires its marketing-contact product for optional mail, the required marketing plan is **UNKNOWN** until selected and re-quoted, and a tested broadcast adapter is required. Do not silently add a second product or assume the two products are interchangeable. The current global daily cap also limits deliverable volume; it must never be raised just to match this spreadsheet.

## Demand at each audience size

Each cell is **low / base / high**. Email volumes include authentication, service and separately opted-in optional messages.

| Registered users | MAU                      | Page views                    | Transfer GB     | Emails                     | Conditional email API cost |
| ---------------- | ------------------------ | ----------------------------- | --------------- | -------------------------- | -------------------------- |
| 1,000            | 200 / 300 / 600          | 1,000 / 3,000 / 18,000        | 0.25 / 0.9 / 9  | 700 / 2,765 / 8,895        | $20 / $20 / $20            |
| 10,000           | 2,000 / 3,000 / 6,000    | 10,000 / 30,000 / 180,000     | 2.5 / 9 / 90    | 7,000 / 27,650 / 88,950    | $20 / $20 / $55.10         |
| 50,000           | 10,000 / 15,000 / 30,000 | 50,000 / 150,000 / 900,000    | 12.5 / 45 / 450 | 35,000 / 138,250 / 444,750 | $20 / $100.10 / $375.50    |
| 100,000          | 20,000 / 30,000 / 60,000 | 100,000 / 300,000 / 1,800,000 | 25 / 90 / 900   | 70,000 / 276,500 / 889,500 | $38 / $224.30 / $776       |

Traffic figures are app-delivery demand, not Supabase database egress; do not bill the same bytes against both services without measuring the actual path. Bots, anonymous readership, retries, static assets, exports and provider ingestion are not included and must be measured separately. All modeled MAU are below the included 100k threshold; this does not establish adequate database compute.

## Shared odds ingestion

Odds are polled once for the whole service, not once per member. A provider sport key can identify a football competition, so "three endpoint keys" is not three broad sports. NFL remains unsupported.

| Input                                    |       Low |       Base |       High |
| ---------------------------------------- | --------: | ---------: | ---------: |
| Approved sport/competition endpoint keys |         2 |          3 |          6 |
| Bookmaker regions                        |         1 |          1 |          2 |
| Markets per request                      |         1 |          1 |          1 |
| Interval and active hours/day            | 5 min; 8h | 5 min; 16h | 1 min; 24h |
| 30-day credit estimate                   |     5,760 |     17,280 |    518,400 |
| With 20% request headroom                |     6,912 |     20,736 |    622,080 |
| Smallest listed paid tier covering model | 20k / $30 | 100k / $59 |  5m / $119 |

The application’s 180-second source-freshness rule remains unchanged. Five-minute polling creates intervals in which no current quote can qualify; the low/base scenarios accept those missed opportunities. Tighter decision-window polling and 5/15/60-minute observations need their own request forecast. API plans do not establish two independently owned, licensed reference sources or an eligible offered bookmaker. Additional regions and markets multiply credits. Snapshot retention sizes, retries and per-event endpoints remain explicit measured inputs.

## Monthly cost categories

| Category                            | Low scenario                                                                               | Base scenario                          | High scenario                                                                  | Included in priced floor?                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Hosting                             | $20 base + UNKNOWN usage                                                                   | $20 base + UNKNOWN usage               | $20 base + UNKNOWN usage                                                       | $20 only                                                    |
| Database/auth                       | $35 minimum for production + isolated preview; additional compute UNKNOWN                  | Same; query/load measurements required | Same; larger compute likely but size UNKNOWN                                   | $35 only                                                    |
| Storage                             | UNKNOWN retained bytes and retention terms                                                 | UNKNOWN                                | UNKNOWN                                                                        | No; file allowance/overage formula above                    |
| Email                               | Audience table                                                                             | Audience table                         | Audience table                                                                 | Conditional API arithmetic only                             |
| Push notifications                  | $0 while disabled                                                                          | $0 while disabled                      | $0 while disabled                                                              | No paid push adapter selected; enabled service cost UNKNOWN |
| Current odds API                    | $30                                                                                        | $59                                    | $119                                                                           | Yes, conditional on permissions                             |
| Historical odds                     | $0 recurring when no import runs; run budget below                                         | Same                                   | Same                                                                           | No import purchased                                         |
| Current and historical results data | UNKNOWN — authorised source and rights quote required                                      | UNKNOWN                                | UNKNOWN                                                                        | No                                                          |
| Monitoring                          | Basic provider console allowance; external uptime/log retention/on-call service UNKNOWN    | UNKNOWN                                | UNKNOWN                                                                        | No unquoted external service                                |
| Analytics                           | No separate vendor fee for internal consent-only events; database/retention usage UNKNOWN  | Same                                   | Same                                                                           | No extra vendor line; usage remains unpriced                |
| Domain                              | UNKNOWN — existing docked.com.au renewal invoice not supplied                              | UNKNOWN                                | UNKNOWN                                                                        | No                                                          |
| Backups                             | Seven-day database backup allowance in Pro; raw/object backups and offsite exports UNKNOWN | Same                                   | Same; PITR optional from $100/month, retention/compute requirements to confirm | Included database allowance only; no PITR assumed           |
| Other recurring infrastructure      | UNKNOWN worker host/trigger, CI usage, secrets/log retention, safe SMTP sink hosting       | UNKNOWN                                | UNKNOWN                                                                        | No                                                          |

Daily database backups do not substitute for an authorised raw-dataset archive and a verified object-storage restore. An on-disk preview dataset is not durable production storage. Database disk overage, file storage, database compute and external worker hosting are separate costs and must not be merged into an arbitrary reserve.

### Conditional priced floors, not total bills

`floor = hosting base + two-project database minimum + odds tier + email API scenario`.

| Registered users | Low floor | Base floor | High floor | Full monthly total |
| ---------------- | --------: | ---------: | ---------: | ------------------ |
| 1,000            |      $105 |       $134 |       $194 | UNKNOWN            |
| 10,000           |      $105 |       $134 |    $229.10 | UNKNOWN            |
| 50,000           |      $105 |    $214.10 |    $549.50 | UNKNOWN            |
| 100,000          |      $123 |    $338.30 |       $950 | UNKNOWN            |

These floors exclude all UNKNOWN rows, hosting overages, database scaling, optional PITR and any required separate marketing plan. For a preview-only phase, no production stack needs to be purchased merely to match these future scenarios. The user's current account invoices were not inspected, so existing actual spend is UNKNOWN.

## Historical acquisition budget

The proposed windows remain development 2022–2023, validation 2024, held-out 2025 and fixed-rule 2026 YTD. Coverage may require a preregistered amendment. The final request count is UNKNOWN until canonical events and provider coverage are inventoried.

Forecast **distinct provider requests** from the manifest: sport key, region/bookmaker set, market and requested snapshot time. Deduplicate requests that genuinely share a snapshot; do not assume all events have the same daily decision time. Count decision, delayed-availability and closing-reference observations separately. Results acquisition is a separate licensed budget. Historical endpoints return the nearest snapshot at or before the requested time and charge 10 credits per region per market; an archive’s time resolution can make a planned measurement unavailable. [Historical odds documentation](https://the-odds-api.com/liveapi/guides/v4/)

The following are request-budget examples, **not event counts, confirmed coverage or data imports**:

| Acquisition envelope              | Unique one-region, one-market snapshot requests | Credits including 20% headroom | Listed tier covering envelope | What remains UNKNOWN                                                 |
| --------------------------------- | ----------------------------------------------: | -----------------------------: | ----------------------------- | -------------------------------------------------------------------- |
| Small coverage pilot              |                                           1,000 |                         12,000 | 20k / $30 for one month       | Rights, actual event coverage, outcome source                        |
| Broader evaluation import         |                                          60,000 |                        720,000 | 5m / $119 for one month       | Exact manifest count, delays/close completeness, results             |
| Dense sensitivity/coverage import |                                         500,000 |                      6,000,000 | 15m / $249 for one month      | Actual request geometry, retries, archival and redistribution rights |

If live polling and history share one subscription, add their credits before choosing a tier; do not double count a full plan or borrow a budget silently. Quota reservation and a stop threshold must precede the first call. Legal, security, research review, customer support, results rights and independent audits require separate scope and quotes. Recheck all prices and contractual suitability before authorising any purchase.
