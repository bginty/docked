# Docked Preview acceptance record

3 October 2026, branch `codex/docked-value-platform`, continuing clean Phase 3 checkpoint `cd4a6d5`. **Provisioning and hosted public/database checks are complete. Full authenticated hosted acceptance is NOT COMPLETE.**

## Verified target and cost

The owner selected a new Docked organisation and explicitly confirmed the $0/month Free project. Created organisation **Docked** (`ernfnkcbalhyqpsrzdwa`) and [Docked Preview](https://supabase.com/dashboard/project/bckkllmndoxzpzdqrevb), reference `bckkllmndoxzpzdqrevb`, Sydney `ap-southeast-2`, standard PostgreSQL 17.11.0.002, ACTIVE_HEALTHY. No paid upgrade, extra purchased service, production deployment, DNS change or Oura mutation occurred.

The application remains on `http://localhost:3000`; its database/Auth backend is hosted. This is **not a publicly hosted application deployment**. Project credentials are stored only in ignored local files. Database connections use the verified project session pooler on port 5432, server-enforced SSL, certificate-chain verification and hostname verification with Supabase's published CA.

## Completed evidence

| Check                        | Actual result                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration installation       | All five original migrations applied in order after empty-project inspection/dry run, followed by the additive session-helper grant correction. Six recorded versions; no seed import.                       |
| Hosted catalog/RLS           | 75 private + 4 public member tables all have RLS. No private browser table grants. Authenticated SELECT only on four public member tables. Only authenticated EXECUTE on the narrow active-session helper.   |
| Hosted transport             | TLS 1.3, certificate chain and hostname verified through the application's actual shared connection helper.                                                                                                  |
| Local validation             | Typecheck, lint, 115 platform tests, 62 PostgreSQL/PGlite tests, all 27 existing browser tests and optimized build passed.                                                                                   |
| Actual-hosted public browser | Three cases passed; 16 route/width checks at 390px and 1366px, zero axe violations, console/page errors or horizontal overflow. Eighteen screenshots include 16 route captures and two homepage viewport captures. |
| Actual-hosted API            | Database available; providers NOT_CONFIGURED; feed, strategy and publication false; anonymous member export 401 and admin API 403.                                                                           |
| Private asset audit          | 503 completed-build/public/prerender/copied files inspected; zero actual secret-key/password matches. No standalone .env copy.                                                                               |
| Dependency audit             | Full `npm audit` and production-only `npm audit --omit=dev`: zero reported vulnerabilities.                                                                                                                  |
| Sporting records             | Zero events, odds snapshots, official publications, community Edges, settlements and research runs. Zero recorded sends and enabled feature flags.                                                           |

Evidence: [catalog](preflight-results.json), [shared TLS proof](shared-tls-helper-proof.json), [migration history](migration-history-current.json), [local browser results](local-baseline/browser-results.json), [public smoke](PUBLIC_SMOKE.md), [asset scan](private-asset-audit.json). PGlite Auth fixtures remain local only; none were inserted into managed hosted Auth tables.

## Defects found and changes

1. `private.active_member_session()` retained the built-in PUBLIC EXECUTE default. Anonymous schema access was already denied, but the latent grant was too broad. Migration `20261003021118_session_helper_execute_hardening.sql` explicitly revokes PUBLIC/anon and retains authenticated execution; a regression enumerates the exact private function grants. Hosted reinspection confirms resolution.
2. Postgres.js `ssl: 'require'` encrypted without verifying the server certificate. All app/worker connections now use the shared verified TLS policy. Five actual-driver tests cover URL/environment downgrade attempts, wrong hostname/IP, certificate validation and loopback handling; a real hosted query passed.
3. Preview Auth previously supported only loopback Auth. Added an exact-project, exact-recipient, expiring capture proof gate with function-fingerprint checking; production rejects this known preview project. Missing or expired proof stays closed. This prepares hosted lifecycle testing without enabling external email.
4. Capture integration review corrected PostgreSQL regex bounds, PKCE-prefixed hashes and the GoTrue hook's provider `site_url` field. The hook must validate `https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1`; application URLs/callbacks remain localhost. The first real canary was safely rejected by the overly strict old field check. The corrected hook passes isolated tests but still needs a fresh successful hosted canary before acceptance opens.
5. Extracted existing outbox lease/unsubscribe preparation into shared helpers. Hosted QA can prepare a real leased QA notification's token without dispatch. Production sending remains behind its existing gate; no invented unsubscribe token is used as acceptance evidence.

## Auth acceptance still pending

Hosted Auth has mandatory confirmation, no anonymous/SMS signup, 12-character minimum passwords, 15-minute access tokens and TOTP support. The SQL Send Email hook replaces SMTP and permits only eight exact reserved `example.invalid` addresses, two exact loopback redirects and signup/recovery actions. It has no network-send function. Captured credentials are private, short-lived and never included in evidence or screenshots. A no-delivery admin-generated canary link inspected the real token shape/provider base; that is **not** proof of the signup/verification journey. No member profile has yet been created.

The project retains Supabase's **2 email-hook events/hour** quota. Failed canary attempts consumed that quota. The owner's decision is pending on a temporary, bounded 30 captured events/hour for this allowlist, restoring 2 afterward; application login/MFA limits would stay unchanged. No quota increase has been applied. Keeping 2/hour is possible with substantially slower staged runs and fresh canary proofs; do not bypass the quota or weaken the 30-minute proof gate.

While that decision is pending, hosted signup and database capture are **disabled**, the capture proof is cleared, and captured-message count is zero. Application registration and every feature flag remain off. The SQL email hook stays installed and enabled so a recovery request cannot fall back to SMTP; its inactive configuration denies capture. Read-only Management API and SQL checks confirm the [closed state](closed-state.json). The saved [hosted configuration](supabase/config.toml) represents this state, not an open acceptance window.

The guarded 16-case account suite is prepared but **unrun**: genuine signup/PKCE verification, onboarding, preferences, export, pause, recovery, unsubscribe, social interactions, isolation, private image quarantine/review, four real MFA staff roles, policy revocation and deletion/session revocation. The real-JWT REST matrix is also prepared but unrun. See [runner instructions](../../../tests/hosted/README.md), [capture review](AUTH_CAPTURE_REVIEW.md), [gate](AUTH_GATE.md), [management controls](AUTH_MANAGEMENT.md), and [acceptance matrix](ACCEPTANCE_PLAN.md). Do not report those cases as passed from fixture tests or catalog evidence.

## Advisor findings and remaining release gates

[Security advisor](security-advisor-current.json): no ERROR; one WARN for leaked-password protection, unavailable on this Free plan. [Supabase documents that feature as Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No upgrade was purchased. Seventy-five [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) reflect the intentional default-deny private schema; do not add permissive policies to clear them.

[Performance advisor](performance-advisor-current.json): 48 [foreign keys without covering indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), including one capture-only relation, and 26 [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). These are INFO findings on a nearly empty preview, not measured production regressions. Review representative workloads before launch; do not delete protective indexes based on an empty database's usage counters.

Free-plan automated backup/PITR and leaked-password protection are not claimed. Recovery uses versioned migrations for an empty target and a separately tested logical export/restore plan before real data is accepted. No hosted restore/load certification is claimed. [Current Free-plan limits](https://supabase.com/pricing) apply; no production SLA or public launch approval exists.

Odds/results providers and licensed historical data remain NOT_CONFIGURED. No live-price, publication, settlement, CLV/ROI or strategy-performance acceptance can be claimed without genuine authorised data and strategy/jurisdiction approvals. Strategy remains UNVALIDATED and forward paper NOT STARTED. Publication, sending, odds polling and commercial switches remain off.

## Controlled continuation

Do not recreate the organisation/project or rerun already applied migrations. Verify the exact target and Auth settings with `& ./scripts/hosted-preview/auth-management.ps1 -Mode '--inspect'`. Only after the pending quota decision may the operator run `--capture-quota30`; otherwise respect the current rate window.

Run `node scripts/hosted-preview/acceptance-control.mjs renew-capture` to reopen the exact, expiring roster and capture configuration, enable hosted email signup only behind the reviewed SQL hook, run `node scripts/hosted-preview/acceptance-control.mjs prove-capture`, and require genuine capture evidence before `enable-app`. Restart the localhost server with `.env.local`; execute the staged browser/REST suite. Assign staff roles only to the genuine verified UUIDs, use the temporary social-only QA policy, prepare unsubscribe through the shared helper, then exercise policy revocation/deletion. Finish by closing signup/capture, suppressing QA jobs, revoking/erasing the disposable accounts, purging captured credentials and restoring quota 2 if it was temporarily changed. Preserve sanitized evidence and explicitly list any remaining blocked positive sporting-data cases.
