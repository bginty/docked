# Local platform QA — 2 October 2026

Tested the assembled feature branch against the local optimized Next.js server. No production or hosted database was exercised.

| Check | Measured result |
| --- | --- |
| TypeScript | Passed |
| Platform unit/integration fixtures | 35 passed |
| PostgreSQL/PGlite schema/policy/lifecycle | 9 passed |
| Optimized Next.js build | Passed |
| Playwright browser journeys | 5 passed, 21.5 seconds in the recorded run |
| Production dependency audit | 0 reported vulnerabilities |
| Axe | 0 reported violations on tested routes/viewports |
| Browser runtime inspection | No errors reported in final local inspection |
| Fictional ledger | 5 settled, 2 wins, 3 losses, −0.80 units, −16.00% ROI, 2-unit drawdown |
| Unconfigured worker | Pending; no jobs/sends |

Screenshots: `home-1440.png`, `home-390.png`, `home-320.png`, `final-preview.png`. The home test focuses the keyboard skip link intentionally. Browser checks include no overflow, navigation, no retired checkout scripts, restrictions, consent defaults, legacy redirects and automated accessibility. The tests record page errors; an independent agent-browser error inspection returned none.

One local Chromium navigation measured DOMContentLoaded 234 ms, load 296 ms, first contentful paint 264 ms, and 7,708 transferred document bytes. This is a single localhost observation, not a production Core Web Vitals result, total page weight or capacity/load test.

PGlite runs actual PostgreSQL semantics with a minimal Auth-schema harness. It does not emulate Supabase email delivery, remote JWT validation, hosted concurrency, provider availability or disaster-recovery RPO. A local dump was restored into a separate instance and immutable evidence was checked. Hosted auth/MFA, real result reconciliation, queue/provider crash boundaries and the full signup→alert→settlement journey require an isolated configured environment. Do not represent these boundaries as passing live integration tests.

Raw machine-readable browser results/traces are in ignored `test-results/`; CI uploads these artifacts. Run `npm run validate`, `npm run build`, `npx playwright install chromium`, then `npm run test:browser` to reproduce local checks.
