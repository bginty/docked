# Validation record

Checked 3 October 2026 on `codex/docked-value-platform`. This distinguishes local regression, actual HTTPS deployment and native device evidence.

| Check | Observed outcome |
| --- | --- |
| `npm run typecheck` | Passed after the operator helpers and hosted suites were added. |
| `npm run lint` | Passed, zero warnings. |
| `npm test` | **184/184 passed**, zero skipped/cancelled, 40.805 seconds in the final complete run after the hosted deadlock fix. |
| `npm run db:test` | **82/82 passed**, zero skipped/cancelled, 59.402 seconds; actual PostgreSQL/PGlite including RLS, tester isolation, wall-clock session expiry and one-connection rate-limit behavior. |
| Existing browser suite | **30/30 passed**, with this milestone's separate evidence root. No prior milestone screenshots were overwritten. |
| `npm run build` | Local optimized web build passed. The isolated hosted build also reached READY with the Preview-only build guard. |
| `npm audit --json` | Zero reported vulnerabilities across all severity levels; [raw nonsecret report](dependency-audit.json). |
| Exact web upload secret audit | 281 files / 4,312,684 bytes, zero findings/errors; [receipt](deployment-source-audit.json). |
| Local built browser secret audit | 47 files / 1,445,473 bytes, zero findings/errors; [receipt](local-browser-secret-audit.json). |
| Delayed/disabled JavaScript security regression | Both browser cases passed with intercepted fictional credentials and no real authentication requests; [receipt](hydration-regression.json). All five existing journey cases also passed after the form repair. |
| Locale/timezone hydration regression | **2/2 passed** in 4.9 seconds: actual React UTC server markup hydrated in Sydney and New York, preserved the instant, and displayed device-local time without recoverable, console or page errors; [receipt](timestamp-regression.json). Typecheck and scoped lint passed after this final source repair. |
| Actual-credential repository audit | Before erasure: **1,573 files / 345,723,103 bytes**, zero matches against server/database credentials, both QA passwords, owner tester password and authorized CLI session; [receipt](repository-pre-erasure-secret-audit.json). After erasure: **1,589 files / 345,877,586 bytes**, zero matches against all six remaining comparison values; [receipt](repository-actual-secret-audit.json). Source, screenshots and public evidence are included. An intermediate run mistakenly treated the literal `[ERASED]` marker as a credential; its false-positive receipt is retained and explained in the final report. |
| Unchanged generic source heuristic | **Four findings remain**, all literal invalid credential-shaped URLs in test fixtures: `tests/database/preview-auth-gate.test.ts`, `tests/platform/database-tls.test.ts`, `tests/platform/hosted-runtime.test.ts`, `tests/platform/preview-auth.test.ts`. Reviewed fixture/configuration tests, with no match to actual credentials. They are excluded from the deployment export. The scanner was not weakened or allowlisted to produce a green result; [raw FAIL receipt](source-heuristic-audit.json). Artifact/actual-secret audits separately passed. |
| Hosted database/security | Nine migrations, 84 RLS-protected application tables and zero unprotected tables. Advisor notices are informational; [migration record](migration-report.md). |
| Actual HTTPS public routes | **30/30 cases passed** across desktop/mobile, with real network responses, empty/restricted provider states, zero recorded axe violations, console/page errors and overflow. |
| Actual HTTPS account lifecycle | All functional checkpoints completed: login/persistence, own profiles, direct API restrictions, explicit notification consent, genuine social post and followed-post fanout without a worker, private export, logout/relogin, completed disposable account erasure and subsequent 401. The run failed its final console assertion, exposing the timestamp defect; the original failed receipt is retained. |
| Final actual HTTPS repair acceptance | **2/2 focused cases passed**, covering seven authenticated mobile views including 320px Home, and populated post/comment/notification rendering in Sydney time. Zero React/console errors, axe violations or overflow. The post/comment were created and deleted through real application operations; the single notice was an explicitly labelled QA system notice to disposable A. [Run](hosted/run-1791013054251.json), [timestamps](hosted/timezone-evidence.json), [member views](hosted/member-views.json). Deleted member B was not recreated to manufacture a second full-lifecycle result. |
| Final hosted browser artifact audit | **1,314 files / 40,403,190 bytes**, zero findings/errors across captured HTML/RSC/JavaScript/CSS; [receipt](hosted/final-browser-secret-audit.json). |
| Public evidence and Android receipt audit | **297 files / 75,369,291 bytes**, zero generic or configured-secret findings and zero scan errors; [receipt](public-evidence-secret-audit.json). |
| No local server dependency | Task-owned standalone server stopped and absence verified; the public HTTPS API still reached the real preview database with all publication/provider gates closed. [Receipt](no-local-server.json). This is separate from physical-device acceptance. |

Actual HTTPS runs and their individual outcomes are in `hosted/run-*.json`. The first network-sandbox attempt failed with denied connectivity before account operations; it was stopped and rerun with network permission, without changing security controls. Any subsequent harness failures and focused reruns are retained rather than represented as an uninterrupted first-pass success.

Android archive, compiled manifest, signature and extracted-entry scans are recorded separately beside this file. Native emulator results do not certify a physical Samsung S24. [Physical-device acceptance](S24_ACCEPTANCE.md) remains explicitly pending until the delivered artifact is tested on that device.

No performance result, sporting opportunity or strategy validation was created by these checks. Fictional accounting tests stay in isolated test databases/transactions; the hosted preview contains no sporting records. No external email or push was sent.

Final disposable-account cleanup passed: only the untouched owner tester remains, with zero sessions and staff roles, zero sporting records and zero external delivery. Disposable profiles, refresh tokens, grants, personal content and notifications are absent. Minimal existing pseudonymous consent/audit tombstones are retained under the established policy. [Cleanup receipt](qa-cleanup.json).
