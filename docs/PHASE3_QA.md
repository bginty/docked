> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Phase 3 validation record

Phase 3 continues `codex/docked-value-platform` from clean commit `e54adf2`. The local annotated rollback tag is `docked-before-phase3-2026-10-03`. Phases 1–2, sports imagery/provenance and official strategy rules are preserved.

## Baseline actually run

`npm run validate` passed before implementation: TypeScript, 77 platform tests and 26 PostgreSQL/PGlite tests. The preceding visual build remained on localhost while baseline screenshots/performance were captured. See [baseline evidence](qa/phase3/before/performance.json): build `clk6RldtqJMhZT-lWqwXa`, three fresh contexts per viewport, no CPU/network throttle, desktop median LCP 464 ms and 925,252 transferred bytes; 390px median LCP 284 ms and 450,990 bytes; CLS 0 at both widths. This is a local lab comparison, not mobile hardware or field performance.

## Validation protocol

The assembled implementation must pass typecheck, lint, platform/integration tests, ordered PostgreSQL/RLS tests, production build, browser journeys, accessibility/overflow/console checks, dependency audit and secret checks before final commits. Record actual results and build identifiers here at completion; a schema or fixture test does not certify a hosted service.

Backend integration tests use real embedded PostgreSQL with a minimal isolated Auth schema. Fixtures are explicitly fictional, never inserted into a running application's database or public results. Browser success-state fixtures run outside application routes and may stub transport to exercise client controls. They do not establish real signup, supplier verification or sporting performance. Real routes without services must show unavailable/restricted states and reject writes.

## External environment boundary

Environment presence checks on 3 October found no `DATABASE_URL`, Supabase URL/publishable/secret key, odds key, results provider/rights or email key. Only `.env.example` exists at the repository root; Docker was not found. No hosted database was touched. Hosted advisors and actual GoTrue confirmation/revocation flows remain unavailable. Use a dedicated Docked stack and local mail sink before full authenticated acceptance. Do not use the unrelated Oura project.

`npm audit --json` completed with zero vulnerabilities on 3 October: 225 dependencies reported. No dependencies were installed or changed for Phase 3 at this checkpoint.

## Review findings during implementation

- New community gates require their own effective policy feature, not an inherited tips approval. Existing 18+ attestation cannot establish eligibility in a jurisdiction requiring a higher minimum age; these features fail closed there.
- Community conversions are server-only analytics events. Client telemetry cannot forge a successful post, follow, comment, notification open or verified Edge submission.
- Free membership does not automatically expire into Pro or payment. New runtime flags and database constraints reject commercial activation; tests also attempt privileged direct SQL writes.
- Unicode lookalikes and badge characters could impersonate the reserved account during development. Shared validation and SQL guards now reject them; legitimate ordinary international display names remain supported.
- Canonical community queries initially inherited social visibility filtering. They now retain all qualifying wins/losses while pseudonymising restricted identities and disabling social interactions. Profile privacy, blocks and erasure cannot improve performance by removing losses.
- Ranking initially risked sorting rounded display figures. It now sorts exact Decimal net units/drawdown, with sub-cent regression coverage. Rising comparisons cannot cross calendar-window boundaries or incompatible rules.
- Submission initially captured the database clock before waiting for locks. It now locks the market and rechecks actual server time, latest policy, source rights, freshness and cutoff afterward. PGlite exercises constraints; simultaneous multi-session timing still needs the dedicated service.
- Direct-ID social interactions now enforce the linked official/community Edge feature and region; an approved social feature alone cannot bypass tip access.
- Image upload authentication/rate limits now precede bounded streamed body parsing and Sharp decoding. Missing/forged Content-Length cannot bypass byte limits. Images remain private quarantine, stripped of metadata and incapable of verifying performance.
- In-app fanout no longer silently truncates at 100 followers. Durable jobs retain a cursor; each bounded worker pass rechecks recipient preferences, individual follow opt-in, region, privacy, pause, quiet hours and caps. No email or push path is enabled.
- Repeated commercial draft submissions now reuse a content hash and create no duplicate/orphan audit record. Free/Pro and award constraints remain closed even through direct SQL attempts.
- Browser verification found Zod's generated object parser violated the strict CSP in new admin forms. The shared browser schema now uses `jitless` interpreted parsing; the form regression passes without adding `unsafe-eval`.
- Community cards and price review initially exposed opaque market IDs. Readable labels now derive from canonical market/settlement rules; matching, confirmation and storage retain the original IDs. Unit and browser regressions retain the regulation/overtime distinction.
- Follow controls initially ignored refreshed server props after their first render. Keyed state now resets when the server-confirmed follow or notification preference changes; the client regression rerenders the same profile to verify both controls.

## Reproducible commands

Run `npm run validate`, `npm run lint`, `npm run build`, `npm run test:browser`, `npm audit --json`, `node scripts/check-secrets.mjs` and `npm run check:client`. The client boundary check requires a build with the documented `DOCKED_BUILD_CANARY_SUPABASE_20261002`, `DOCKED_BUILD_CANARY_ODDS_20261002` and `DOCKED_BUILD_CANARY_EMAIL_20261002` values in the three server-only key variables. They are test strings, not credentials; never add public aliases. Clear them after that process. The heuristic source scan reports filenames only and is distinct from the actual built browser-asset marker check.

`npm run worker -- once` was run without database credentials and returned its explicit pending state: no jobs or sends performed. No prospective paper validation was started.

## Assembled source validation

- `npm run validate`: passed TypeScript, **105 platform/unit/integration tests** and **49 PostgreSQL/PGlite tests**, zero failures. The baseline was 77 and 26 respectively.
- `npm run lint`: passed with zero warnings permitted.
- `npm run build`: passed; final build ID **`xlc1Befe4FdeUzigRM4DH`** includes the readable-market and refreshed-follow-state repairs. An initial attempt encountered Windows' lock on the preceding local standalone server; after verifying and stopping that Docked process, the build completed. No other project process was stopped.
- Canary credential build + `npm run check:client`: passed across **27 browser assets**. The local server was started in a separate process without those markers. Its `/api/status` confirms both providers `NOT_CONFIGURED`, database/feed/strategy/publication false.
- `node scripts/check-secrets.mjs`: zero findings in the source/text scope recorded in [secret-scan.json](qa/phase3/secret-scan.json). It is a heuristic check, not a guarantee against every possible secret encoding.
- Standalone delivery resolves Sharp from its bundled Next dependency successfully; the upload transformation dependency is present in the distributable build.
- The complete browser suite passed **27/27**, with no skipped, flaky or failed cases, on assembled build `h_B18PJV4WBBRiBIcb7zA`; see [the preserved complete report](qa/phase3/after/browser-results-full.json). After the two presentation/state fixes, **all 11 affected Phase 3 cases passed again** on final build `xlc1Befe4FdeUzigRM4DH`, with no skipped, flaky or failed cases; see [the final targeted report](qa/phase3/after/browser-results-final-phase3.json). Typecheck and lint passed again after the final component change.

The added PostgreSQL coverage comprises 3 commercial draft/disabled-state checks, 11 social/identity/privacy/notification checks and 9 community ledger/settlement/ranking-job checks. Platform tests include actual API-handler authentication-before-body-read probes, strict input and spoofing controls, request byte bounds, exact metrics/ranking, changing observations and commercial flags. Embedded database transactions, UI fixtures and remote service acceptance are distinct layers; only the first two are locally available.

## Browser, accessibility and measured performance

The final Phase 3 matrix covers 12 real routes at 390, 430, 768, 1366 and 1920px: **60 route/viewport checks**, zero detected axe violations, horizontal overflows or console/page errors. Five explicitly labelled DEMO interaction journeys and the real offline-worker check also pass. The unchanged sports suite remains covered by the complete 27-case run. Fresh screenshots, per-viewport records and both browser reports are indexed in [the evidence directory](qa/phase3/README.md).

The repeated local lab method uses three fresh contexts per width, a warmed standalone server and no network/CPU throttling. Final medians from [after/performance.json](qa/phase3/after/performance.json):

| Metric | Desktop 1440px before → after | Phone viewport 390px before → after |
| --- | ---: | ---: |
| LCP | 464 → 464 ms | 284 → 268 ms |
| CLS | 0 → 0 | 0 → 0 |
| DOMContentLoaded | 67.5 → 429.3 ms | 247.8 → 232.2 ms |
| Transferred bytes | 925,252 → 932,389 | 450,990 → 457,991 |

Desktop DOMContentLoaded increased by 361.8 ms in this small sample; it must not be described as an across-the-board performance improvement. Image bytes are unchanged, and total transferred bytes increased about 0.77% desktop / 1.55% mobile. These observations do not establish causality, field Core Web Vitals, mobile-device behavior or authenticated/production capacity. Real-device, hosted latency and concurrency measurements remain release checks.
