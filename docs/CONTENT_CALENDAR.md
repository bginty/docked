> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

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

Seed durable schedules with `npm run worker -- seed`; run a supervised worker trigger every minute. Editable schedule rows are in private.schedules. The worker stores next_run and enqueues one overdue occurrence per enabled schedule on each invocation, with the original scheduledAt and a unique local-date slot key. It advances from that recorded slot, so a delayed worker catches up deterministically over subsequent invocations without duplicating a slot. This is delayed draft/report processing, not retrospective tip publication. Report cohort periods come from scheduledAt; any settlement-as-of timestamp must describe the evidence actually queried. Optional digest/watchlist schedules are disabled by default and currently create review-only previews, not recipient sends. Alerts are event-driven and require separate opt-in, fresh revalidation, local quiet hours and caps; missed or stale edge windows are discarded.

CMS workflow: draft → fact_checked → approved → scheduled/published → corrected/archived. Bodies are plain text escaped by React; arbitrary HTML is not rendered. Every revision and transition records actor/reason/evidence. Deterministic reports are drafts until review. Social publication is not configured; content can be prepared as drafts only.

## Phase 2 content and SEO review

All eight evergreen drafts now include an additional concrete exercise or evidence checklist: sensitivity to probability error, price-format equivalence, quiet-day reporting, an asymmetric margin-removal example, run-length interpretation, pending/void denominators, a closing-protocol audit and evidence provenance. Arithmetic examples are fictional and do not enter any ledger. Reading time is computed from actual text instead of the former fixed 4–6 minute labels.

Article pages expose a unique title, description, canonical URL, OpenGraph/Twitter metadata, editorial attribution, dated preparation/publication/update state and visible corrections. Published CMS entries use Article structured data with real publication timestamps; bundled educational drafts use WebPage structured data, remain noindex and are excluded from the sitemap until approved. JSON-LD is escaped against script termination. CMS withdrawal, expiry or draft status cannot fall through to an older bundled article. A configured but unavailable CMS fails closed until editorial visibility can be verified: article, catalogue and sitemap reads propagate a sanitised temporary error to the route boundary rather than reporting a missing article or an empty catalogue.

The reading room merges published CMS entries with unmatched evergreen drafts. Production sitemap entries include approved editorial content with actual modification dates; preview robots deny indexing. Private account, auth and tip routes are excluded from crawler access. The reusable social image is a generated PNG route, avoiding an SVG-only social-card dependency. Preview metadata and authenticated route controls remain distinct: robots rules never replace access checks.

Coverage architecture is deliberately small: /sports, /sports/football, /sports/nba, /sports/nfl and the allowlisted /leagues/nba research explainer. Unknown sports/leagues return 404. These pages explain settlement contracts and evidence requirements without invented fixtures, standings, performance or programmatic filler. NFL is explicitly unsupported. Additional league pages require substantive reviewed content and approved mappings before being added to the registry or sitemap.
