# Docked hosted preview acceptance plan

Prepared 3 October 2026. This is a plan and read-only compatibility review, not a hosted acceptance result. The parent task owns project creation, identity verification, credentials and every hosted mutation. No other Supabase project is in scope.

## Preflight and migration compatibility

The five original migrations and additive session-helper permission fix target standard PostgreSQL 17, UTF-8, existing managed `auth.users`/`auth.sessions`, Supabase roles and `auth.uid()`/`auth.jwt()`. They require no new extension. The recent PostgreSQL 17.11 changes concern ltree, legacy pgcrypto ciphers, GiST floating-point indexes and custom estimators; Docked migrations use none of those features. Keep the standard storage engine. [Supabase changelog](https://supabase.com/changelog)

1. Record the verified Docked project ref/name, intended organisation, region and empty-project state before touching it. A database named `postgres` is not identity evidence. Do not reuse a linked project or unrelated credential.
2. Confirm standard PG17/UTF-8, TLS and direct/session connection capability. `DATABASE_URL` cannot be a transaction pooler because provider polling retains a session advisory lock. Check database-user permission to read managed Auth session/user records and revoke sessions; the application does not write fabricated Auth identities.
3. Run `docs/qa/hosted-preview/preflight.sql` against the verified target. It is read-only catalog inspection and contains no secrets, Auth fixture inserts or role/claim changes. Before applying, absent Docked tables are expected; afterward, require four public member tables, all private tables with RLS, no private browser grants, only authenticated SELECT on the four public tables, and only the narrow authenticated session-check helper executable. There should be one private SECURITY DEFINER with a fixed empty search path.
4. Apply all application migrations in filename order using the approved hosted migration mechanism, including `20261003021118_session_helper_execute_hardening.sql`. Never apply `db/schema.sql` alone, edit applied migration history or run test harness setup SQL remotely. Confirm recorded versions match local names; inspect failures before retrying. Use rollback/recovery instructions in PREVIEW_SUPABASE.md, not blanket drops.
5. Verify Data API exposed schemas exclude `private`, public grants match the catalog checks, Auth anonymous login is off, email confirmation is on, staff TOTP is enabled, callback origins are exact and JWT expiry is short. `supabase/config.toml` configures local services; it does not automatically configure hosted Auth/API settings. Run actual hosted database/security advisors and preserve sanitized results.
6. Keep public publication, paper, odds/results polling, email sending, paid plans, competitions, prizes, deals and affiliates off. Capture empty canonical ledger counts before and after acceptance. No synthetic sporting outcome or historical performance belongs in hosted results.

## Auth setup and no-email boundary

The original preview gate refused `signup` and `recover` when Auth was not loopback. The new hosted-preview gate additionally requires the fixed Docked project, loopback site, approved test address, current verified capture-function fingerprint and a fresh real canary proof. A hosted project/key alone cannot complete those application journeys. `REGISTRATION_ENABLED=false` and database flags do not prevent someone calling GoTrue signup directly; keep hosted signup disabled until the email capture path is ready for its controlled canary.

Use genuine Auth APIs for test identities and sessions, never direct inserts into `auth.users`, `auth.sessions` or fabricated JWTs. Admin `createUser` with explicit confirmation is suitable for role-test provisioning, but is not proof of signup or email verification. Admin `generateLink(type: signup)` followed by consuming the real confirmation token can separately prove GoTrue confirmation without sending email. This still does not prove the application's PKCE/signup/callback or email transport. [Admin link API](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)

A reviewed hosted capture mechanism must replace built-in email delivery before testing the app's full signup/recovery flows. Supabase's Send Email Hook replaces the built-in sender; capture-only success must be demonstrated before relaxing Docked's loopback gate. Do not switch to production mode to bypass that gate. Generated confirmation links, access/refresh tokens, TOTP secrets and mail-capture bodies are credentials and must never enter committed evidence, screenshots or chat output. [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)

Provision isolated named QA accounts through Auth for member A/B, analyst, editor, administrator, auditor and restricted-region member. Give only the matching role in `private.roles`, using the real generated Auth UUID. Create normal application profiles/consents through the approved lifecycle or clearly record a bootstrap step as setup rather than acceptance. Public metadata such as `user_metadata.role='admin'` must never grant a private role. Obtain real AAL1 sessions and real TOTP-verified AAL2 staff sessions; hand-setting SQL claims is not MFA acceptance. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

## Acceptance matrix

| Probe | Expected result / evidence |
| --- | --- |
| Anonymous publishable-key REST reads | No profile, preferences, saved or personal data; no private-schema access |
| Member A public REST reads, filtered and unfiltered | Only A's rows; explicit B ID filter returns none |
| Member A public REST insert/update/delete | Denied even against A's own rows; writes use the audited application API |
| Private roles/provider payload/ledger/social table and RPC requests | Denied/not exposed with member or staff browser JWT; staff role does not grant direct private REST writes |
| Member metadata claims elevated role | App admin/moderation/strategy APIs still deny; no role assignment changes |
| Each staff account at AAL1 | Privileged actions deny even with its real private role |
| Analyst/editor/admin/auditor at real AAL2 | Match each route's actual permission matrix; auditor reads only, analyst cannot moderate, editor cannot approve strategy/live activation |
| Member A APIs with B's post/comment/saved/private-setting ID | Deny cross-user mutation/export; B's rows unchanged |
| Restricted member and expired/revoked feature policy | Feature-protected community/Edge APIs deny access; account export, deletion and privacy controls retain normal ownership checks and remain available; UI hiding alone is not evidence |
| Private profile, bilateral block, mute | Social visibility and notifications follow controls; canonical ledger denominator is unchanged |
| Upload, quarantine, approved media and staff review | Anonymous request rejected before body parsing; member cannot read quarantine; approved ownership enforced; active AAL2 staff can review without public-region activation |
| Opt-ins and inbox | Marketing off by default; following alone does not opt into notifications; individual and global preferences, pause, quiet hours, dedupe, caps and recipient feature restrictions enforced |
| Logout/revocation | Reuse the previously issued JWT: app denies and public RLS returns no rows; refresh cannot restore the removed session |
| Account export/deletion | Export contains only own permitted data; session revoked; social personal data purged/pseudonymized; another member remains intact; any genuine ledger references survive |
| Official/Edge spoofing and protected writes | Submitted verified/official/author/odds/result flags rejected; private ledger direct writes denied |
| Current-price confirmation/settlement/positive publication | Blocked unless genuine authorized provider data and required approvals exist; do not manufacture records to turn this green |

Direct Supabase REST probes must use the publishable key plus each real user token, never a secret/service-role key. Application browser acceptance uses genuine SSR session cookies established through GoTrue PKCE and the app callback. Database-owner `SET ROLE`/`set_config` probes may supplement SQL policy checks, but cannot substitute for real JWT validation, service sessions, cookies, refresh or MFA. Session ID checks are necessary because access tokens may otherwise remain valid after signout. [Supabase session behavior](https://supabase.com/docs/guides/auth/sessions)

Use stable before/after counts or hashes for targeted row ownership tests, sanitized HTTP statuses and visible UI outcomes. A zero-row owner UPDATE does not fire row triggers and cannot prove immutable-ledger execution. Catalog trigger presence is installation evidence; local isolated regression tests cover the synthetic positive/negative ledger fixtures until authentic hosted records exist. Do not disable triggers or safety gates to seed a passing case.

## Evidence classification and blockers

Record each case as PASS, FAIL or BLOCKED with the actual environment and setup method. Keep `local PGlite`, `hosted catalog`, `real GoTrue`, `hosted REST`, `application API` and `browser` evidence distinct. Local tests use a minimal invented Auth schema by design and must never be pointed at hosted PostgreSQL.

The complete account journey requires a verified real capture canary and the guarded hosted-preview signup/recovery gate. Genuine positive odds/publication/settlement acceptance remains blocked by provider credentials/rights/data and strategy/legal approvals. This plan does not establish a hosted advisor pass, mail delivery, real browser account lifecycle or approved regional/legal operation; record those outcomes in separate evidence when actually observed.
