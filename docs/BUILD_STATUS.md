# Docked build status

Started 2 October 2026. Branch `codex/docked-value-platform`. Working tree was clean.

## Current milestone: Phase 2

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

| Milestone | Implemented | Boundary |
| --- | --- | --- |
| A | Repository audit, rollback branch/tag, archived storefront, Next/TypeScript shell, SQL migration/RLS, Supabase Auth handlers, retired URLs | No hosted migration or domain change |
| B | Replaceable provider contracts, The Odds API adapter, canonical mappings, shared ingestion, quota/circuit controls, deterministic pricing, isolated fixtures | Odds credentials, actual mappings and reviewed rights are absent |
| C | Analyst publication with immutable evidence/atomic outbox, accounts/preferences/saved tips/personal records, settlement/corrections, filtered one-unit results and measured availability/closing diagnostics | Full hosted authenticated journey and authorised outcome source are pending |
| D | Reproducible import/replay/freeze CLI, manifest hashes, no-look-ahead checks, delayed benchmark, baseline calibration, day-block uncertainty, development sensitivity, prospective paper controls | No licensed dataset, completed study, paper track record or strategy approval |
| E | Eight evergreen articles, 12-week calendar, CMS workflow, durable schedules/jobs, reviewed report drafts, consent-aware edge/onboarding dispatch, admin controls | Optional digest/social schedules produce drafts; campaign recipient review/expansion is an operator integration step, not an active campaign |
| F | Local optimized build, platform/PostgreSQL/browser checks, screenshots, local restore drill, cost model and deployment/rollback runbooks | Hosted security/auth/email/load/backup checks and release authority remain gates |

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
