# Phase 4 QA — 3 October 2026

Branch `codex/docked-value-platform`, continued from clean `a19a94d`. The only remote target was **Docked Preview**, `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, Sydney, Free ($0/month). The frontend remained localhost:3000. Production, DNS and Oura were untouched. No external email, purchase, production push or genuine sporting result was created.

## Evidence boundaries

Hosted Auth receipts use genuine GoTrue signup, PKCE confirmation, password sessions and enrolled/verified TOTP. Local PostgreSQL tests use a minimal Auth fixture and cannot establish hosted Auth behavior. Public browser screenshots contain no authenticated account data; authenticated traces/videos/screenshots are disabled. Secrets, raw diagnostic errors, MFA seeds, mailbox capabilities and account fixtures remain ignored local files.

Reference-price sporting examples are explicitly fictional. The hosted SQL test waited for the actual event-start clock, verified the locked 2.50 benchmark despite a personal promotional 99.00 note, then rolled back its entire transaction. Before and after counts for events, snapshots, references, community Edges, settlements and official publications are zero. See [rollback receipt](market-reference-hosted-rollback.json). This proves software constraints, not a genuine edge, historical result or forward-paper performance.

## Automated validation

| Scope                            | Evidence and outcome                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production web build             | PASS, build `yJojDyngkNjNiQ7akKDf4`; [receipt](build-results.json)                                                                                                            |
| Complete browser regression      | **30/30 PASS**, no skipped/flaky cases; [receipt](browser-results.json)                                                                                                       |
| Actual hosted public smoke       | Three cases passed, local frontend against hosted backend; [public evidence](hosted-public/)                                                                                  |
| TypeScript and lint              | PASS; [final consolidated receipt](final-local-validation.json)                                                                                                               |
| Platform/unit/integration        | **158/158 PASS**; [receipt](platform-results.json). Includes 17 reference-research regressions and actual fixture-only CLI validation/replay/stress/report/tamper checks.     |
| PostgreSQL/RLS                   | **72/72 PASS**, all seven migrations; [receipt](database-results.json)                                                                                                        |
| Dependency audit                 | Zero reported vulnerabilities at execution; [receipt](dependency-audit.json)                                                                                                  |
| Actual credential scan           | [Repository/browser receipt](repository-secret-audit.json), [public/prerender/standalone receipt](private-asset-audit.json)                                                   |
| Generic source secret heuristics | Three pre-existing deliberately invalid fixtures, reviewed explicitly; [raw findings](source-secret-scan.json), [review](source-secret-review.json). Scanner was not relaxed. |
| Android                          | Debug APK built and audited; real native checks and unexecuted cases are separate in [Android QA](../android/README.md)                                                       |

The browser suite includes mobile/desktop navigation, no data/provider outage, protected routes, explicitly labelled DEMO success/expired/settled/correction states, new reference-price UI, changed-price reconfirmation, sharing/deep-link aliases, accessibility and console probes. Tested public routes report zero axe violations, horizontal overflow and browser/page errors. This is automated coverage, not a full accessibility certification or load test. Fresh images are under [web regression](web-regression/), [reference UI](reference-ui/) and [hosted public](hosted-public/); preserved Phase 3 images were not overwritten.

## Genuine hosted execution

| Scope                                                                         | Receipt                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Seven signups, captured verification, onboarding                              | [signup](signup-results.json)                                             |
| Password login, export, preferences, recovery, unsubscribe                    | [lifecycle](lifecycle-results.json)                                       |
| Social authorization, image quarantine, restricted-region denial              | [community continuation](community-results.json)                          |
| Complete social lifecycle with member B/editor at ordinary password assurance | [complete flow](community-complete-results.json)                          |
| Analyst and editor with real MFA                                              | [role checks](analyst-editor-results.json)                                |
| Administrator and read-only auditor with real MFA                             | [role checks](admin-auditor-results.json)                                 |
| Signup closed, existing login usable, unsupported email change rejected       | [closed Auth](closed-auth-results.json)                                   |
| Account deletion immediately revokes a second active session                  | [deletion](deletion-results.json)                                         |
| Initial Data API/role spoofing/cross-user/session checks                      | [53 checks before migration 7](rest-before-migration-results.json)        |
| Current Data API checks                                                       | **69/69 PASS**, [latest REST receipt](rest-results.json)                  |
| New immutable reference and Top Docked benchmark                              | [real-session rollback acceptance](market-reference-hosted-rollback.json) |
| Revoked QA region policy immediately denies community                         | [revocation](revocation-results.json)                                     |
| Exact-roster account erasure                                                  | All eight erased and checked; [receipt](account-erasure-results.json)     |

The earlier social attempt hit the existing profile-edit limit after passing interaction/privacy checks. The recorded continuation covers later controls without changing that limit. The separate complete-flow receipt now proves the entire social journey with the alternate existing pair. A failed or interrupted attempt is not relabelled PASS. Final readback verifies zero Auth users/sessions, member profiles, identifiable social profiles, approved region policies, enabled feature flags, captured messages, sent outbox records, delivery attempts and sporting records. See [final state](final-hosted-state.json).

Auth quota was recorded at **2/hour**, temporarily **30/hour**, restored to **2/hour** and independently verified. See [before](auth-quota-before.json), [temporary](auth-quota-temporary.json), [restoration](auth-quota-restored.json), [independent check](auth-quota-independent-verification.json). Capture/proof were disabled and ten signup captures plus one recovery capture purged: [closure](capture-closure.json). This is a message count, not a count of new people. The closed hook prevents SMTP fallback. [Final login-compatible closed configuration](auth-final-closed.json).

## Review and release limitations

Material fixes and operational findings are explained in [hosted acceptance](../../HOSTED_ACCEPTANCE.md), [database review](market-reference-database-review.md) and [advisor review](advisor-review.md). Seven migrations and 83 RLS-enabled application tables are verified. The [private preimage hash](migration-preimage.json) and [apply receipt](migration-apply.txt) document the additive migration; this application preimage is not a complete Auth/storage backup or a certified restore rehearsal.

The initial advisor returned a Free-plan leaked-password-protection warning; no upgrade or related configuration change was made. The final advisor returned only 79 default-deny private-table RLS notices, with no SQL warning/error. Performance notices are 53 unindexed foreign keys and 12 unused indexes. [Final security receipt](security-advisors-final.json), [final performance receipt](performance-advisors-final.json). The missing final Auth warning is not evidence that the earlier limitation was remediated. Real load, least-privilege production DB credentials, complete backup recovery and legal/retention review remain release gates.

OddsPapi and The Odds API are trial-ready but **NOT_CONFIGURED**. Results and genuine historical data are absent. Reference strategies remain **UNVALIDATED**; no held-out study, actual forward paper, public publication, Pro, competition, prize or affiliate feature is enabled. Native verification/recovery, production App Links, signing/Play approval and FCM are separate pending prerequisites. See [provider trial/comparison](../../PROVIDER_COMPARISON.md), [reference methodology](../../MARKET_REFERENCE.md), [research validation](../../VALIDATION.md) and [Play readiness](../../GOOGLE_PLAY_READINESS.md).
