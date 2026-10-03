# Docked build status

Started 2 October 2026. Branch `codex/docked-value-platform`. Working tree was clean.

## Current milestone: Phase 3 community integration

Phase 3 continues from the clean visual checkpoint `e54adf2` on `codex/docked-value-platform`, protected by local rollback tag `docked-before-phase3-2026-10-03`. The implementation adds an authenticated mobile app shell; canonical official Edges pinned above discussion; private social profiles, follows, blocks, mute, comments, reactions, saves and moderation; provider-verified immutable community Edges; profiles and Top Docked; consent-aware in-app notifications; and a PWA offline shell. Official strategy calculations and historical validation controls remain separate and unchanged.

Community pricing is fail-closed. No odds key, current standard-price classification contract, authorised results source, dedicated Supabase credentials or genuine historical data is configured. Missing data does not become a competitive record or zero performance. The official strategy remains **UNVALIDATED** and forward paper remains **NOT STARTED**. No production, DNS, live email, billing, prize or affiliate action was performed.

Free functionality and the original first-year growth strategy are preserved. Pro, subscriptions, competitions, prizes and deals have reviewed draft schemas and admin interfaces but **cannot activate** through runtime flags or ordinary direct database writes. No payment details are collected and no automatic month-13 conversion exists.

Implementation and validation evidence: [community architecture](COMMUNITY_ARCHITECTURE.md), [Edge integrity](EDGE_INTEGRITY.md), [odds verification](ODDS_VERIFICATION.md), [Top Docked](TOP_DOCKED.md), [membership](MEMBERSHIP_ENTITLEMENTS.md), [moderation](MODERATION.md), [notifications](NOTIFICATIONS.md), [privacy retention](PRIVACY_RETENTION.md), [Phase 3 QA](PHASE3_QA.md). QA distinguishes actual unconfigured routes from explicitly labelled isolated DEMO success states; neither fixture tests nor UI readiness establishes a profitable strategy or hosted acceptance.

Final local validation passed: TypeScript, lint, 105 platform/unit/integration tests, 49 PostgreSQL/PGlite tests, the complete 27-case browser suite and all 11 affected Phase 3 browser cases repeated after the final UI repairs. Production build `xlc1Befe4FdeUzigRM4DH` and the 27-asset browser credential-canary scan passed. Dependency audit reported zero vulnerabilities; source secret scan reported no findings. The five-width Phase 3 route matrix reports no axe violations, overflow or console/page errors. Local median LCP was unchanged at 464 ms desktop and 268 ms at 390px; desktop DOMContentLoaded increased by 361.8 ms, documented with the full measurement limits and screenshots in the QA evidence.

Next external step remains a dedicated Docked local Supabase stack with a safe mail sink, following [PREVIEW_SUPABASE.md](PREVIEW_SUPABASE.md). Apply all five ordered migrations, create only isolated test accounts, and exercise the complete real Auth/account/community lifecycle. A supplied project must be verified by organisation, project reference and purpose before any remote mutation. Oura is out of scope. Supplier standard-price metadata and separate results rights, current regional legal approval, retention basis, hosted concurrency/load/security checks and explicit deployment authority remain release gates.

## Preserved milestone: visual sports identity

The sports identity milestone continues from clean Phase 2 commit `8fa346c`. It adds a cinematic football homepage, ten photographic sport categories and substantive sport pages, a consistent pictogram system, photographic editorial/edge/results context and responsive navigation. Coverage labels remain derived from the existing configuration: football and basketball are research; the other eight sports are coming soon. No sport is labelled LIVE.

See [VISUAL_IDENTITY.md](VISUAL_IDENTITY.md) for implementation and scope, [IMAGE_RIGHTS.md](IMAGE_RIGHTS.md) for the twelve delivered assets and [visual QA](qa/visual-sports/README.md) for before/after evidence. The pricing engine, strategy rules, historical controls, server authentication and production state are unchanged. Local preview remains http://localhost:3000.

Final visual validation: TypeScript, lint, 77 platform tests, 26 PostgreSQL tests, 16 browser tests and the production build passed. Browser checks cover five widths from 390 to 1920 pixels, plus existing 320px journeys. Two accessibility regressions were repaired. Repeated runtime image-optimizer stalls were removed from the delivery path using 49 prebuilt responsive WebPs, with decode/hash checks and a cancelled-image/revisit regression. Normal tested pages report zero axe violations, console/page errors and runtime optimizer requests. Authenticated dashboards remain access-gated pending the dedicated preview authentication environment; screenshots distinguish those gates from authenticated UI.

## Phase 2 checkpoint (preserved)

Phase 2 continued from clean A–F commit `261cd83`; it did not restart the project. Senior review found and repaired material auth/RLS, consent, strategy provenance, matching, quota, historical replay, immutable evidence, correction, queue, CMS and result-visibility issues. Additive implementation now includes admin data health, explicit strategy lifecycle, separate forward-paper reporting, privacy analytics and a safe local mail adapter. See [PHASE2_REVIEW.md](PHASE2_REVIEW.md) for findings and regression evidence, and [qa/phase2/README.md](qa/phase2/README.md) for final measured validation.

Final local checks passed: TypeScript, lint, 72 platform tests, 26 PostgreSQL tests, eight browser tests, optimized build and client-secret marker scan. Full dependency audit reported zero vulnerabilities. Automated scans found no axe violations on tested pages; a separate 19-route probe recorded zero console/page errors. Fresh screenshots include explicit access-gate states for authenticated areas. This does not certify the unavailable hosted account lifecycle.

Dedicated Supabase preview: **NOT CONFIGURED**. Inventory contained only an unrelated project, which was not used. Docker is unavailable; real Auth/mail-sink acceptance and hosted advisors remain pending. Ordered migrations and RLS are tested locally in PostgreSQL. Odds and results providers are **NOT_CONFIGURED**. Genuine historical data is absent, the strategy is **UNVALIDATED**, and forward paper is implemented but **NOT STARTED**. No real emails or production changes occurred.

Exact next action: make the dedicated local Supabase stack available with an approved Docker runtime, then follow [PREVIEW_SUPABASE.md](PREVIEW_SUPABASE.md) to test accounts and confirmation mail locally. Alternatively provide a specifically identified Docked Preview project; hosted signup/recovery remains disabled until a safe sink is proven. Supply credentials securely, never in source control or chat. Cost totals remain UNKNOWN; [COST_MODEL.md](COST_MODEL.md) separates verified conditional floors from unquoted rights and unmeasured usage.

## Verified starting point

- Repository: https://github.com/bginty/docked.git. Original branch: `codex/docked-static-paypal-launch`.
- Source checkpoint: `0b7baa1d86126888a485221e03c10c94bfb54949`, tag `docked-storefront-before-value-2026-10-02`.
- Remote main verified read-only: `6086b28690b28cc5df01d521982bfa4d4e6d02a8`.
- GitHub Pages serves main/root. CNAME is docked.com.au; apex resolves to GitHub Pages IPs.
- No AGENTS.md found in repository or checked parent directories. No relevant environment keys or .env files found. No existing backend.
- Original deployment/support evidence remains in docs/STATIC_PAYPAL_DEPLOYMENT.md and docs/STATIC_PAYPAL_ROLLBACK.md.
- Oura and other projects are out of scope and untouched.

## Delivered local implementation

| Milestone | Implemented                                                                                                                                                                                                  | Boundary                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A         | Repository audit, rollback branch/tag, archived storefront, Next/TypeScript shell, SQL migration/RLS, Supabase Auth handlers, retired URLs                                                                   | No hosted migration or domain change                                                                                                         |
| B         | Replaceable provider contracts, The Odds API adapter, canonical mappings, shared ingestion, quota/circuit controls, deterministic pricing, isolated fixtures                                                 | Odds credentials, actual mappings and reviewed rights are absent                                                                             |
| C         | Analyst publication with immutable evidence/atomic outbox, accounts/preferences/saved tips/personal records, settlement/corrections, filtered one-unit results and measured availability/closing diagnostics | Full hosted authenticated journey and authorised outcome source are pending                                                                  |
| D         | Reproducible import/replay/freeze CLI, manifest hashes, no-look-ahead checks, delayed benchmark, baseline calibration, day-block uncertainty, development sensitivity, prospective paper controls            | No licensed dataset, completed study, paper track record or strategy approval                                                                |
| E         | Eight evergreen articles, 12-week calendar, CMS workflow, durable schedules/jobs, reviewed report drafts, consent-aware edge/onboarding dispatch, admin controls                                             | Optional digest/social schedules produce drafts; campaign recipient review/expansion is an operator integration step, not an active campaign |
| F         | Local optimized build, platform/PostgreSQL/browser checks, screenshots, local restore drill, cost model and deployment/rollback runbooks                                                                     | Hosted security/auth/email/load/backup checks and release authority remain gates                                                             |

These are implementation scope commits. Verification applies to the assembled branch, not a claim that each intermediate commit is a deployable release.

## Real, fictional and pending

- Real: executable application, database constraints, pricing/replay/accounting logic, provider boundaries, UI, tests and documentation.
- Fictional: authored test fixtures only. Required five-bet arithmetic is −0.80 units / −16.00% ROI. No fixture is in a public performance query.
- Pending: all genuine odds/results imports, strategy performance, live publications, actual members, outbound messages and public launch date. The UI displays pending/restricted states. Nothing asserts profitability or independently audited execution.

## A–F baseline verification (preserved)

`npm run validate`: TypeScript plus 35 platform tests and nine PostgreSQL/PGlite tests passed. Database checks include RLS/IDOR denial, immutability, frozen configuration, publication/outbox atomicity, withdrawal/settlement idempotency and a local dump/restore drill.

`npm run build`: optimized Next.js production build passed. `npm run test:browser`: five tests passed at desktop/390px/320px, including public pages, restricted API/admin paths, failed signup without services, retired URLs and axe checks. No axe violations on tested pages; no full WCAG certification. `npm audit --omit=dev`: zero reported vulnerabilities at the check. See docs/qa/platform/README.md for scope and measured timings.

`npm run research -- demo`: expected fictional accounting output. `npm run worker -- once`: clean pending response without DATABASE_URL, no jobs or sends. No genuine historical study was run.

## Preview and next action

Local preview: http://localhost:3000 (run `npm run build` then `npm run start` if stopped). No shareable hosted deployment exists. Source branch: `codex/docked-value-platform`.

Next permitted operational step: configure an isolated Docked preview database/auth environment and safe mail sink, apply the migration there, then verify the complete authenticated lifecycle. Credentials and a specific target must be supplied securely. No production mutation is currently justified. An education-only cutover is a separate reviewed release after entity/support/privacy content and hosting authority are resolved.

Remaining release blockers: contracted odds and authorised results; historic universe/mapping evidence; reviewed historical and prospective paper research; effective-dated regional/legal approval; verified legal entity/support pages; authenticated sender/domain configuration; dedicated least-privilege production DB role; durable private storage on ephemeral hosting; monitored worker capacity and provider quotas; hosted restore/security/concurrency checks; exact release/DNS authority. Optional digests need explicit recipient/content approval, and future anonymous region-aware record access needs a trusted eligibility design. Public actionable records currently require verified eligible accounts.
