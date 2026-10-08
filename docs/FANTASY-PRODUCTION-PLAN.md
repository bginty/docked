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
