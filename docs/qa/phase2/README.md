# Phase 2 validation evidence — 2 October 2026

Application source commit: `c4c67d7`. Preview tooling/browser/CI commit: `5666249`. Subsequent documentation commits do not alter the tested application. This is local acceptance evidence, not a production release or proof of strategy profitability.

## Final results

| Check | Result |
| --- | --- |
| `npm run validate` | PASS: TypeScript, 72 platform tests, 26 PostgreSQL/PGlite tests |
| `npm run lint` | PASS, zero warnings |
| `npm run build` | PASS, optimized Next.js build including standalone output |
| `npm run check:client` | PASS, all three server credential canaries absent from 17 browser assets |
| `npm run test:browser` | PASS: eight tests, zero skipped/flaky/unexpected, 90.5 seconds on final run |
| Automated accessibility | Zero axe violations on tested desktop/mobile pages and isolated status fixtures; not complete WCAG certification |
| Console probe | 19 routes, zero console errors and zero uncaught page errors; see [browser-console.json](browser-console.json) |
| `npm audit --json` | PASS: zero reported vulnerabilities across production and development dependencies |
| `npm run worker -- once` without DB | PASS: reports pending configuration, performs no jobs or sends |
| Git whitespace check | PASS |

The CLI fixture integration executes import, validation/replay and integrity-checked reporting in private temporary storage. It is fictional test evidence only. PostgreSQL tests apply both migrations in order and exercise actual SQL/RLS, cross-user and privilege attacks, private provider payload denial, lifecycle gates, immutable records, paper/outbox separation, correction relationships, account revocation/erasure, quota failure accounting, historical policy continuity and backup/restore. A minimal Auth schema is used for SQL tests; real Supabase GoTrue behaviour is not simulated as verified.

The final browser rerun follows a real failure discovered at 390px: the horizontally scrollable results table lacked keyboard focus. The fix adds named focusable table regions. The regression explicitly focuses the table, presses ArrowRight and verifies scrolling, alongside axe. No test was weakened.

## Screenshots

| Requested view | Evidence | Meaning |
| --- | --- | --- |
| Homepage desktop | [home-desktop-1440.png](home-desktop-1440.png) | Actual local preview |
| Homepage mobile | [homepage-390.png](homepage-390.png) | Actual local preview |
| Edges | [edges-390.png](edges-390.png) | Actual restricted/no-provider preview |
| No edge | [no-edge-isolated-fixture-320.png](no-edge-isolated-fixture-320.png) | Isolated component harness, no public fixture data |
| Results | [results-390.png](results-390.png) | Actual inaccessible-record state; unknown values N/A |
| Methodology | [methodology-390.png](methodology-390.png) | Actual local preview |
| Article | [article-390.png](article-390.png) | Actual labelled educational draft |
| Signup | [signup-390.png](signup-390.png) | Optional consents unchecked, service not configured |
| Member dashboard | [member-dashboard-locked-390.png](member-dashboard-locked-390.png) | Actual access gate, not an authenticated journey |
| Admin dashboard | [admin-dashboard-locked-390.png](admin-dashboard-locked-390.png) | Actual staff/MFA gate |
| Data health | [data-health-locked-390.png](data-health-locked-390.png) | Actual staff/MFA gate |
| Forward paper | [forward-paper-locked-390.png](forward-paper-locked-390.png) | Actual staff/MFA gate |

Separate `fixture-edge-*-320.png` images cover active, price below minimum, expired, suspended and settled presentation. They carry a visible fictional-fixture heading and are produced with server-rendered components in a browser test page. They are never inserted into a database or exposed through an application fixture route. Existing `../platform/home-*.png` screenshots were refreshed by the preserved original browser suite at 1440/390/320px.

## Secret-boundary reproduction

Build in preview with these **non-secret test markers**, then run the scanner. CI performs the same check. Do not substitute real credentials into a test log.

```powershell
$env:APP_ENV='preview'
$env:SENDING_ENABLED='false'
$env:SUPABASE_SECRET_KEY='DOCKED_BUILD_CANARY_SUPABASE_20261002'
$env:ODDS_API_KEY='DOCKED_BUILD_CANARY_ODDS_20261002'
$env:EMAIL_API_KEY='DOCKED_BUILD_CANARY_EMAIL_20261002'
npm run build
npm run check:client
```

The scanner proves those build-time values are absent from browser assets; it is not a claim that arbitrary future changes cannot leak secrets. Database modules also use Next's `server-only` boundary. `npm run start` copies standalone static assets and launches only on loopback; no hosted deployment occurs.

## Still pending

Dedicated Docked Supabase service, security/performance advisors against that service, real email verification/recovery in a local sink, authenticated member/staff browser journeys, remote Auth erasure retry, hosted concurrency/load tests, current licensed odds/outcomes, real historical research and forward-paper validation. Protected screenshots do not certify inaccessible authenticated screens. Follow [../../PREVIEW_SUPABASE.md](../../PREVIEW_SUPABASE.md); do not weaken the gates to make screenshots look complete.
