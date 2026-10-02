# Twelve-week draft editorial calendar

Timezone Australia/Melbourne. Relative weeks begin after approved editorial activation; no public launch date is assumed. Eight complete evergreen drafts are in src/content/articles.ts and /learn. Every worked example is fictional. No future fixture or result has been invented.

| Week | Tuesday educational draft                   | Friday optional watchlist draft       |
| ---- | ------------------------------------------- | ------------------------------------- |
| 1    | Value versus picking winners                | How to read a watchlist target        |
| 2    | Minimum acceptable odds                     | Why a price can expire                |
| 3    | Why no tip is sometimes correct             | Data-health checklist, no selections  |
| 4    | Bookmaker margin                            | Matching full-game settlement rules   |
| 5    | Losing runs and variance                    | How to pause and reduce notifications |
| 6    | Estimated EV versus realised return         | What a complete ledger includes       |
| 7    | Interpreting closing value                  | Missing data is not zero              |
| 8    | Backtest, paper and live records            | Why demo is never performance         |
| 9    | Revisit minimum odds using reader questions | Delayed quotes and unknown limits     |
| 10   | How probability calibration is evaluated    | Independence of reference sources     |
| 11   | Reading drawdown without chasing losses     | Safer-gambling resources review       |
| 12   | Methodology review; publish limitations     | Next research questions, no promises  |

Daily 07:30: board/service-health refresh, no mandatory email. Monday 18:00: complete prior-week ledger report draft, with losses, drawdown, availability, exclusions and missingness. Tuesday 18:00: optional approved digest. Friday 18:00: optional approved preview; price targets are not active tips. First weekday of month 18:00: methodology/performance report draft, bundled into a digest. Public-holiday calendar review is outstanding.

Seed durable schedules with `npm run worker -- seed`; run a supervised worker trigger every minute. Editable schedule rows are in private.schedules. Unique local-date slot keys prevent duplicates. Scheduler lag that misses a slot is reported as a missed run, not silent backfill. Alerts are event-driven and require separate opt-in, fresh revalidation, local quiet hours and caps.

CMS workflow: draft → fact_checked → approved → scheduled/published → corrected/archived. Bodies are plain text escaped by React; arbitrary HTML is not rendered. Every revision and transition records actor/reason/evidence. Deterministic reports are drafts until review. Social publication is not configured; content can be prepared as drafts only.
