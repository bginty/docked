# Docked email acceptance continuation — 9 October 2026

> Later checkpoint: [Live-beta acceptance](DOCKED-LIVE-BETA-ACCEPTANCE.md). The owner has authorized controlled beta deployment/testing, resolving the earlier test-window approval question. Other mandatory gates remain. This document preserves the earlier checkpoint.

**Public launch remains blocked. Email implementation and disabled deployment progressed; full hosted authentication acceptance has not passed.** Continued from `ec299fe7` on the existing `pivot/fantasy-cards-preview-v1` branch without resetting prior work. The live-beta/NFL instruction is incorporated as sequential work: finish hosted email acceptance, then complete controlled beta and NFL integration before promotion.

## Completed changes

- Added a gated invitation confirmation route. GET and HEAD never consume a token. A same-origin POST verifies the invite, establishes the Auth session and redirects to password setup. Callback and application origins must match the configured production staging origin. Referrer policy sends only the origin, never the token-bearing path/query. Provider uncertainty is distinguished from an invalid/expired link.
- Added invited profile completion after password setup/login. Fresh Auth verification, an active exact session, explicit age/Terms/Privacy choices and current approved policy versions are required. Profile/consent writes are transactional and serialized per account; replays do not overwrite existing records. No cards, administrator roles or consent are granted by email confirmation alone. Existing restricted Auth views are reused.
- Added a disabled scheduler and bounded queue admission. Four independently leased jobs drain concurrently; at most 32 unexpired jobs can await processing. Overload rejects before hook acknowledgement; existing idempotency receipts remain replayable. Ambiguous dispatch stays held rather than automatically resent.
- Added recipient restrictions at both enqueue and actual dispatch. Unset/unknown mode denies all production email. `support-test` permits only support@docked.com.au. A later approved-beta mode requires an explicit exact list, at most 20 mailboxes, without wildcard fallback. No list or activation flag was configured.
- Prepared expiry cleanup, scheduler health reporting and an explicit activation/rollback runbook. The scheduler uses the existing signing key only after separately reviewed Vault/scheduling setup; this work did not copy that key into Vault or schedule sends.

The original four-second timeout's exact position relative to Graph acceptance remains historically uncertain. The existing durable queue moves Graph outside the synchronous hook response. The prior hosted diagnostic received Graph 202 with one dispatch; the owner confirmed Inbox receipt. No additional diagnostic email was sent in this continuation. This is conservative duplicate-submission prevention, not a promise of exactly-once email delivery.

## Actual production changes and readback

Only dedicated Supabase project `pojoymtniryarxxunyvz`, organization `otldyeunbqabbcjydjpe`, was accessed.

- Applied reviewed migration `20261008133413_docked_auth_mail_scheduler.sql` once. Both email migration receipts are present. All three mail tables have RLS; anonymous, authenticated, service-role and application-runtime roles cannot execute scheduler/private-core functions or access scheduler configuration. Only service-role can call the public queue wrapper.
- Deployed `docked-auth-email`, ID `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, **version 5**, with sending disabled. Downloaded source matches all four local files. Existing secret value digests are unchanged; Supabase refreshed built-in secret metadata timestamps during deployment.
- Mail, worker-ready and diagnostic flags are false. Invitation/recipient activation variables are unset. Scheduler enabled is false and no worker request has been scheduled. Public signup remains disabled and email verification required. Auth Send Email hook activation was not performed.
- `pgcrypto` and Vault are installed. `pg_cron` and `pg_net` are available but not installed. No extensions, cron jobs, new secrets, Microsoft grants or paid services were added.
- Production still has zero Auth users, sessions and Fantasy cards. The prior Inbox-confirmed diagnostic retains exactly one attempt/dispatch and an erased encrypted payload.

Evidence: [disabled deployment](qa/fantasy-production/invitation-function-deployed.json), [production database/Auth readback](qa/fantasy-production/hosted-mail-scheduler-security.json), [hosted route denials](qa/fantasy-production/invitation-hosted-guards.json).

## Verification

| Check | Result | What it proves |
| --- | --- | --- |
| Complete platform suite | PASS — 419 tests | Local application, email, identity and release regressions |
| Complete database suite | PASS — 206 tests | Local PGlite; includes restricted-role invited profile/session/consent rollback |
| Scheduler/concurrency | PASS — 7 scenarios | Actual disposable PostgreSQL 17.10; real pgcrypto signatures, 24 concurrent ticks, 40 concurrent admissions accept exactly 32, role denial and crash cleanup |
| Focused browser suite | PASS — 11 tests | Local Chromium at mobile/desktop widths; invitation click/replay, real password-page redirect, explicit setup consent, account error handling and production presentation |
| Actual hosted hook guards | PASS — 5 checks | Version 5 method/signature/path denial; no mail sent |
| Actual production readback | PASS | Applied migration, RLS/ACL, disabled scheduler, closed signup, prior one-send receipt |
| TypeScript / changed-file ESLint / diff check | PASS | Current source |
| Optimized Next build | PASS | Source-only local export, no cloud credentials; not a Netlify deployment |
| Build secret scan | PASS | 54 client assets, 100 server traces; zero secret matches or private-file references |
| Changed-source secret/address scan | PASS | Actual production secret/private-address values checked privately; no values printed |
| Actual email receipt | PASS — prior checkpoint | Owner confirmed support Inbox; no new diagnostic was necessary |
| Full hosted invitation/confirmation/recovery/failure reconciliation | BLOCKED / NOT RUN | Requires protected staging, controlled activation and actual issued links/session checks |
| Other-real-mailbox negative permission test | NOT RUN | No second authorized mailbox exists; not claimed as passed |
| Native Android/iPhone | NOT RUN | Chromium viewport emulation is not device testing |

Local scheduler tests stub Vault and outbound HTTP; they do not prove hosted pg_net/cron operation. Browser invitation verification is an authored Auth fixture and is not real hosted token verification. Existing dependency audit reported zero vulnerabilities; dependencies were not changed in this continuation.

The first browser run found a real `no-referrer`/`Origin: null` interaction. Changed to `strict-origin`, preserving the strict Origin check and keeping token paths out of referrers. The next run exposed a fixture expectation for an intercepted redirect; corrected it to assert the actual password page and canonical destination. The final 11-test run passed. The deployment verification initially compared provider timestamp metadata; a separate readback confirmed unchanged value digests and source hashes without redeploying.

One existing Astra High reviewer was reused for bounded read-only review, with no edits, shared-data changes or nested delegation. The main agent fixed its throughput and callback-origin findings and ran regression tests. No Ultra audit or main-agent model switch is claimed.

## Beta, NFL and infrastructure

- [docked.com.au](https://docked.com.au): HTTPS 200, existing holding page. [www](https://www.docked.com.au) returns 301 to apex. No DNS or holding-page changes.
- [Netlify staging](https://docked-production.netlify.app): HTTP 404; no application deployment exists. Reuse Free site `2292ba6e-7073-4804-b69a-26b41c9a9fb1`. Local invitation/profile changes are not deployed there.
- Netlify deployment preparation still requires approved policy versions and verified staging access/readiness. Those facts were not invented to bypass its guard.
- NFL audit: existing offensive scoring and configurable lineup helpers are inactive, with six passing unit scenarios included in the platform suite. No NFL inventory, live provider, server settlement or playable screens were enabled. Exact earlier NFL/live-beta specification remains unavailable; [NFL preparation](FANTASY-NFL-PREPARATION.md) records the gaps. No rules or data rights were silently assumed.
- Owner-confirmed Supabase baseline remains US$25/month before tax, Spend Cap ON/no add-ons; Netlify Free. No paid plan/add-on was activated; invoices and current usage charges were not independently audited.
- Oura, Preview and unrelated Vercel were not accessed or modified. Preview's preservation is not a fresh availability test. Payments and marketplace remain disabled.
- Existing Android Preview APK and ready-to-send Barry material remain preserved. No Android rebuild or Barry email was performed; current Microsoft recipient authorization remains support-only.

## Exact remaining actions and work order

1. **Owner approval:** authorize the support@docked.com.au-only hosted Auth test window, with rollback to disabled state afterward and public signup remaining closed. The pending request follows the owner's explicit instruction not to activate production email without approval; no broader Microsoft permission is needed.
2. **Owner/policy/operations:** approve actual Terms, Privacy, reward/community versions and initial territory; confirm privacy/retention/moderation responsibilities and administrator MFA. Company, ABN, support email and private address are already supplied and do not need resubmission. Do not publish the street address.
3. **After those prerequisites, implementation:** deploy protected staging on the existing site; configure reviewed existing-secret Vault storage and free database scheduling only after scope/ACL checks; prove the actual scheduled request and cleanup. Connect the signed Auth hook for the approved recipient only. Perform invitation, confirmation, recovery, genuine expiry/replay and injected-failure reconciliation. Preserve receipts and never blindly retry ambiguous Graph sends. See [activation runbook](DOCKED-EMAIL-ACTIVATION-RUNBOOK.md).
4. **NFL requirements:** supply the earlier detailed requirements or their file/chat location. Resolve sport/lineup/scoring/correction rules and authorized data source before integrating the existing foundations. Do not enable a paid provider, invent starter-pack composition or silently change existing Fantasy rules.
5. **Controlled beta:** after email acceptance, finish approved NFL integration and real PostgreSQL/hosted gameplay, policy, isolation and device checks; then promote only after all essential gates pass. Record Netlify deploy/commit, domain rollback and post-promotion smoke evidence. Holding page stays until then.

The pending owner answers were not treated as approval. Safe changes are preserved and ready for continuation; this report does not claim email acceptance, NFL completion or a public launch.
