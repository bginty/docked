# Phase 3 local QA evidence

This directory separates real local preview checks from isolated, explicitly fictional interaction fixtures. It is software evidence, not a community launch, account population, historical study or live performance record.

## Before

Captured before rebuilding Phase 3 source, from the completed visual milestone build `clk6RldtqJMhZT-lWqwXa`. The original public site was running on `http://localhost:3000`. `before/` preserves homepage, edges, results, article, sports and locked member dashboard screenshots at 1440 and 390 pixels.

`before/performance.json` records three fresh Chromium contexts per viewport against a warmed local standalone server, device scale factor 1, no CPU/network throttling and a 1200 ms observation after network idle. Baseline medians:

| Viewport | LCP | CLS | DOMContentLoaded | Transferred bytes |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 1000 | 464 ms | 0 | 67.5 ms | 925,252 |
| 390 × 1000 | 284 ms | 0 | 247.8 ms | 450,990 |

These are local lab observations. Viewport emulation is not mobile hardware; results are not field Core Web Vitals or a production capacity forecast. `node docs/qa/phase3/capture.mjs after` repeats the same method without building or deploying.

## What the browser suite verifies

- Real routes at 390, 430, 768, 1366 and 1920 pixels: Home, Community, composer, profile, Top Docked, notifications, search, membership, competitions, deals, moderation and leaderboard audit. Without the dedicated account environment, private routes show their actual access gates and no private data. Public commercial previews show disabled functionality.
- Existing sports/education/anonymous/account-denial regressions remain in the complete suite. Their new captures go under `after/sports-regression/`; earlier milestone evidence is preserved.
- Isolated interactive fixtures use the real client components and current styles, with simple Next navigation adapters. The official card uses actual server-rendered fixture markup. Every fixture displays a prominent DEMO label. API responses are intercepted in the browser; no authenticated session is forged and no database, provider, messaging or ledger write occurs.
- Fixture journeys cover official priority above community content, retained losing records, provisional qualification, verified price review, explicit permanent confirmation, changed-price reconfirmation, social-only promotional content, follows/reactions/comments/block/report, separate notification consent, moderation, disabled commercial drafts and audited snapshot controls.
- Accessibility scans retain WCAG 2/2.1/2.2 AA tags, overflow assertions and image checks. These automated checks do not constitute a complete human accessibility audit.
- The PWA check registers the actual worker, verifies that only the public offline shell is cached, then disconnects the browser and checks the offline page. Private pages, API responses, images and prices are never put in the service-worker cache.

## Findings during implementation

The administrative commercial-draft form initially triggered Zod 4's runtime code generation under the existing strict Content Security Policy. The shared membership schema now configures Zod's `jitless` mode before constructing schemas. The browser regression retains the strict policy and exercises the form; no `unsafe-eval` permission was added.

The final review found that community cards and the composer could display an internal market identifier instead of the market and settlement scope. They now use the canonical readable market label while preserving the original identifiers in selections and API submissions. A price-review regression checks the visible regulation-only label.

Repeated follow controls could retain their old local state when a server refresh supplied a changed relationship or notification preference. The internal state now resets when those confirmed server values change. A browser regression rerenders the same profile with updated follow and consent flags. Following alone still does not enable notifications.

The fixture bundler reads modules through Node because native esbuild parent-directory enumeration is restricted in this Windows sandbox. This is test infrastructure only. It does not change production bundling, resolve application authentication or substitute a hashing implementation.

## Acceptance boundary

The dedicated Supabase/Auth preview remains an external prerequisite for real signup, verification, profile persistence, role/MFA and session-based browser journeys. Local PostgreSQL and API authorization tests provide separate evidence; isolated screenshots cannot certify that hosted lifecycle. Genuine provider data and regional approval are also still required before verified competitive submission can be used operationally.

Authenticated feed performance, actual hosted session lifecycle and production capacity remain unmeasured until that dedicated environment exists. The results below do not remove those boundaries.

## Final local acceptance

- The complete suite passed **27/27** on build `h_B18PJV4WBBRiBIcb7zA` in 463.9 seconds, with no skipped, failed or flaky cases. See [full browser report](after/browser-results-full.json).
- After readable market labels and follow-state refresh were repaired, all **11 Phase 3 cases** passed again on final build `xlc1Befe4FdeUzigRM4DH` in 165.5 seconds, again with no skipped, failed or flaky cases. See [final Phase 3 report](after/browser-results-final-phase3.json). The other 16 cases cover unchanged public-site behavior.
- The final run includes 60 real route/viewport checks, five isolated interaction cases and the actual service-worker offline check. Real routes reported no page or console errors, accessibility violations or document overflow. Fixture page-error checks passed; deliberately intercepted rejection responses exercise closed states and changed-price recovery.
- Manual pixel review covered mobile Community and Membership gates, desktop Top Docked, desktop/mobile DEMO Home, the changed-price form, retained-loss profile and disabled administrative draft. Layouts remained readable and the official/community distinction remained clear. Full-page captures can position sticky navigation mid-image; the DEMO Home viewport captures show its actual placement.
- There are **12 before screenshots and 169 after screenshots**, including **19 clearly labelled DEMO captures**. `after/sports-regression/` contains 77 captures from the complete run; those public routes did not change in the final fixes. Phase 3 route and DEMO captures were refreshed in the final run. Twelve public comparison captures were refreshed during the final performance run.

Useful starting points: [Community mobile](after/community-390.png), [membership mobile](after/membership-390.png), [Top Docked desktop](after/top-1366.png), [DEMO Home mobile](after/DEMO-home-390-viewport.png), [DEMO Home desktop](after/DEMO-home-1366-viewport.png), [DEMO price change](after/DEMO-price-moved-390.png), [DEMO retained loss](after/DEMO-profile-loss-1920.png), [DEMO disabled draft](after/DEMO-disabled-deal-draft-390.png), [offline shell](after/offline-shell.png).

## Matched performance observations

Final capture: 3 October 2026 at 01:27:30 UTC, Chromium `153.0.8010.12`, final build `xlc1Befe4FdeUzigRM4DH`. The same script, viewports and three-fresh-context method were used without competing test runs. This measures the anonymous homepage only.

| Viewport | Metric | Before median | After median | Change |
| --- | --- | ---: | ---: | ---: |
| 1440 × 1000 | LCP | 464 ms | 464 ms | 0 ms |
| 1440 × 1000 | CLS | 0 | 0 | 0 |
| 1440 × 1000 | DOMContentLoaded | 67.5 ms | 429.3 ms | +361.8 ms |
| 1440 × 1000 | Transferred bytes | 925,252 | 932,389 | +7,137 (0.77%) |
| 390 × 1000 | LCP | 284 ms | 268 ms | −16 ms |
| 390 × 1000 | CLS | 0 | 0 | 0 |
| 390 × 1000 | DOMContentLoaded | 247.8 ms | 232.2 ms | −15.6 ms |
| 390 × 1000 | Transferred bytes | 450,990 | 457,991 | +7,001 (1.55%) |

Image transfer remained 630,926 bytes on desktop and 158,400 bytes on mobile. Desktop DOMContentLoaded increased; it is not hidden or replaced by a preferred run. Three local samples do not establish the cause, statistical significance or real-user impact of that change. LCP remained unchanged on desktop, mobile LCP was slightly lower, and CLS remained zero. These measurements do not demonstrate improved production performance or certify the authenticated application.

Raw runs and method: [before](before/performance.json), [after](after/performance.json). Repeat with `node docs/qa/phase3/capture.mjs after`; preserve an existing report before rerunning. `summarize-browser.mjs` records compact per-case results and the current build ID from Playwright's completed JSON output.
