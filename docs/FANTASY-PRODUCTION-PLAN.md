# Production free-play implementation — 8 October 2026

Baseline: Preview delivery `7de60d06`, readiness `f9bdfe04`, same preserved branch. User now authorizes resolving the blockers with free starter packs and daily non-transferable rewards. No real-money flow, new paid infrastructure, Preview data migration or holding-page replacement before verification.

## Work order

1. Verify and copy v8 APK to Desktop; use existing Chrome/Gmail if available, otherwise prepare a ready-to-send message with the existing verified private link.
2. Verify separate production resource availability and zero-cost provisioning. Keep Preview and holding page operational. Missing owner/policy/SMTP facts remain fail-closed.
3. Add production-only database entry points and a DB-owned deployment mode. Reuse card/edition/provenance/pack/lineup/scoring invariants; preserve the Preview command interface and three-member cap in Preview mode.
4. Add a permanent per-account starter receipt and server-UTC daily reward receipt. Default daily award: 10 non-transferable gameplay points. Optional controlled card rewards must use predeclared stock and persist outcomes. No test-credit ledger access, paid packs, cash-style listings or unrestricted admin actions in production.
5. Reuse public Auth, current Terms/Privacy consent, onboarding and social moderation. Add production branding/navigation/homepage, starter/reward UI and explicit disabled marketplace where mechanics remain unapproved.
6. Test environment isolation, SQL permissions, eligibility, idempotency, scarcity, rollback, concurrency, scoring fairness, browser layouts, dependency and secret safety. Run actual production-safe smoke tests only when a verified production backend/auth deployment exists.
7. Stage and verify production before DNS/promotion. If external prerequisites remain blocked, preserve the holding page, finish independent implementation/tests, and report precise owner actions.

## Review and initial checkpoint

Astra High performed a bounded read-only architecture review with no delegation or writes. Its findings require separate production command/read projections, SQL-level monetary denial, immutable account/period claims, current policy consent, bounded/private state and retention of the transaction lock until real PostgreSQL races verify any replacement. Main agent implements fixes/tests. No Ultra audit.

APK copied to `C:/Users/61412/Desktop/Docked-Preview-S24-v8-Fantasy-Cards.apk`, exact expected size/hash. Browser and Windows automation runtimes fail before initialization (trusted Node process exits; sandbox helper setup errors). No browser email sent. Supabase CLI can see Docked Preview in the intended Docked organization; the MCP connection sees only Oura. Production resource/cost investigation continues through the supported CLI.

## Implementation checkpoint

- Prepared additive production migration, current verified-session/consent enrollment, permanent Starter receipts, UTC daily rewards, immutable reward policies, controlled Starter allocation rollover, fixed-scoring free-round creation and private bounded projections. Production commands reject credit grants, paid packs, listings, sales and trades. The existing Preview interfaces and three-member cap remain intact.
- Shared website/mobile components now support production free-play branding, packs, reward history, administration and explicitly closed marketplace. Existing Edge routes, account flows and community moderation remain in place.
- Astra High's bounded follow-up identified nullable bootstrap metadata, lack of future rounds and finite Starter allocation. Added explicit NULL validation/DB constraint, MFA free-round creation, and bounded catalog rollover preserving old unopened packs, lifetime claims and edition caps. No Ultra, nested reviewers or reviewer writes.
- Full platform suite: 375 passed. Full database suite: 197 passed, followed by 13/13 focused production tests including an additional optional-card rollback scenario. Release-tool regression: 3 passed. Local build, typecheck, lint and client-boundary check passed. Four static Chromium layout checks passed at 390/1440 px; these are not live browser/API or native-device tests.
- Patched Sharp 0.35.4 to 0.35.5 for GHSA-wq5f-xc86-pv6w; final npm audit reports zero vulnerabilities. Fixed broad Open Graph filesystem tracing; 98 final server trace manifests reference no private-data, .env.local, attachments or .git files. Client/source secret scan passed with 601 files and zero findings.
- Created the separate empty Vercel project `docked-production`, ID `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, on existing Hobby team `team_tf6xweKKyVCj9bTppUKttJ4l`. Configured guarded Next.js builds, private sources, Node 22 and no automatic custom-domain assignment. No Git link, deployment, database attachment, new paid service or domain mutation.
- Docked Supabase organization `ernfnkcbalhyqpsrzdwa` is verified Free. Project-cost/free-capacity check is unavailable. Production Supabase ref remains null; no new database was created and no migration was applied remotely. Local Docker Linux engine remains unavailable after a normal start attempt, so real PostgreSQL concurrency is unverified.
- Missing production-scoped database credentials, verified Auth mail delivery/callbacks, actual operator/approved policy facts and community policy prevent safe public promotion. Holding page and Preview remain deployed unchanged. Ready-to-send Barry `.eml` and `.txt` are on Desktop; no email delivery confirmation exists.

See `FANTASY-PRODUCTION-HANDOFF.md` for the exact remaining gates and owner actions. The manifest stays unapproved until those gates pass.

Hosting eligibility is an additional live gate: Vercel's verified Hobby plan is restricted to personal/non-commercial use. Do not assume a business launch qualifies or upgrade billing without owner approval.

## Final unblock checkpoint

Continued from `ddea9888` / `04c3377a` without resetting or rebuilding. Reused the existing Vercel destination. Supabase explicitly refused free production provisioning because the owner already has two active Free projects; both original projects remain healthy and untouched. Vercel Hobby is ineligible for the business launch; Netlify Free is a commercial-eligible alternative requiring an explicit hosting choice and compatibility verification. No plan or domain change occurred.

Recovered the existing operator/contact records and verified Ginty United Investments Pty Ltd, ABN 78 606 187 106, against official ABN Lookup. Its VIC 3909 main business location differs from the historical VIC 3081 correspondence address; current address/support/policy details remain unapproved. Saved sourced facts in ignored operator configuration without enabling registration.

Resolved the local database test blocker with isolated PostgreSQL 17.10. Fixed test-only Unicode/JSON encoding, added a reusable optional local runner and expanded coverage: eight actual concurrency/permissions/integrity scenarios pass; focused PGlite production regressions 13/13. No production SQL or feature implementation changed. Production Auth/email/RLS/browser smoke tests still await infrastructure. No additional reviewers or Ultra audit.

Reverified HTTPS holding page, www redirect, Preview availability/access denial, Desktop/original APK and private-download hash. Gmail remains unavailable (`mail_service_not_enabled`); email not sent. Prepared message retained; link expires 11 October 2026, 10:36:46 am Sydney.

See `FANTASY-PRODUCTION-FINAL-UNBLOCK.md` for exact paid/free hosting choices, database capacity decision, mail/contact/policy prerequisites and evidence. Promotion remains closed; continue the existing deployment sequence after those external gates are satisfied.

## Netlify selection and capacity follow-up

Owner selected Netlify Free, subject to eligibility/compatibility. Prepared provider-specific guarded builds, immutable non-secret build metadata, exact staging origin checks and local environment/source-export support. The production manifest remains unapproved with null Netlify/database identities. Vercel Preview and existing Vercel production project are preserved. Netlify account/browser access is unavailable; no site, billing or domain mutation occurred.

Reverified both active Free slots: Docked Preview (`bckkllmndoxzpzdqrevb`, Docked organization) and Oura CRM UAT (`dwdjeecjdkkiidoutnme`, separate organization). Automatic approval review rejected aggregate Oura database inspection; narrow permission was requested, no bypass attempted. Do not infer Oura is disposable from metadata or empty Edge Functions. Preserve both.

If both are required, Netlify Free plus a new dedicated one-project Supabase Pro organization starts at approximately US$25/month; using the existing Docked organization with Preview plus production as two Micro instances is approximately US$35/month. Both exclude taxes/overages/mail and require paid approval; a new organization also needs a reviewed target change. Full details, tests and owner actions: `FANTASY-NETLIFY-PREPARATION.md`.
