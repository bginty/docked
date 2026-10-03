# Phase 5 acceptance and handoff — 4 October 2026

Branch: `codex/docked-value-platform`. Checkpoint: `docked-before-phase5-2026-10-04` at `7663490c0b9adee05d2a2cef5ea7ef1e587f1a27`. Phases 1–4.5 are preserved. No production deployment, DNS change, Oura access, external email, paid purchase or genuine sporting-data import occurred.

## Implemented

- Current-data adapters for The Odds API and OddsPapi, exact preview identity/rights gates, canonical fixture/market observations, private raw retention, durable quota reservations and immediate authoritative quota reconciliation.
- Separate pricing/availability/publication/community references; the same existing reference engine supplies an explicitly UNVALIDATED market-baseline `ModelProvider`. Historical baseline/replay uses frozen strategy/manifest provenance and as-of data only.
- Durable configurable scanner schedules, authenticated worker endpoint, resumable market checkpoints, immutable candidate/review history, safe manual candidates, fresh approval checks and private operational alerts. The baseline cannot enter live use. Automatic publication is forbidden.
- Trending and completed-week community recognition with versioned rules, DEMO/promotion/integrity/ban exclusions, unique-member/age/burst checks and immutable weekly snapshots. No winner or popularity was invented.
- Compact Edges discovery, factual Watchlist projections, recent/all-history links and staff scanner/candidate/daily screens. Deterministic editorial drafts remain evidence-bound and go through existing CMS review.

## Executed validation

| Check                      | Result                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Initial clean baseline     | Typecheck, lint, 209 platform and 97 database tests passed                         |
| Final platform suite       | 233/233 passed, no skipped tests                                                   |
| Final PostgreSQL/RLS suite | 109/109 passed, no skipped tests                                                   |
| Typecheck / lint           | Passed                                                                             |
| Production build           | Passed; server-secret canaries supplied during build                               |
| Client canaries            | Absent from all 50 browser assets inspected                                        |
| Dependency audit           | All dependencies and production-only: zero vulnerabilities                         |
| Complete browser suite     | Final 76/76 passed; zero failed, skipped or flaky cases; 847.714 seconds |
| Real hosted sessions/MFA   | Passed 198 assertions across anonymous plus five real QA roles; four genuine staff MFA enrollments |
| Android v5 APK audit       | Passed, 988 entries, zero credential/forbidden-file findings                       |
| Physical Android           | Owner confirms existing v5 works; no attached device for new Phase 5 native checks |

Private command logs are under `private-data/phase5`. Public receipts and screenshots are in this folder. Local fixture screenshots are explicitly DEMO and never entered Supabase. Hosted screenshots use disposable private QA identities and contain no provider data.

See [browser evidence](EXPERIENCE.md) and [Android acceptance](../../ANDROID_ACCEPTANCE.md). The 73 browser cases cover responsive behaviour and labelled fixtures; native back/share/picker/deep-link/offline behaviour has not been rerun on a physical S24 during Phase 5.

Scanner runtime/database flags remain **OFF**, there are **no enabled schedules or hosted recurring trigger**, and the next scan is unavailable until reviewed configuration is supplied. The configurable starting research cadence is 15 minutes; actual provider polling and near-event refreshes need a separate credit budget. See [scanner operations](../../EDGE_SCANNER.md), [candidate approval](../../EDGE_APPROVAL_WORKFLOW.md), [Trending rules](../../TRENDING_EDGES.md) and [weekly recognition](../../EDGE_OF_THE_WEEK.md).

## Hosted database

Exact project `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, Sydney Free. Private preimage captured before applying `20261003143903_phase5_edge_scanner_market_data.sql`. The CLI dry run and actual application succeeded; migration order is now 12 migrations. Original four account fingerprints remained unchanged. No application table lacks RLS. Publication, deliveries, real fixtures/snapshots and ordinary region approvals remain zero/off.

Advisors: **zero ERROR**, one WARN for disabled leaked-password protection, 95 INFO for intentional RLS-without-browser-policy tables, 74 INFO for unindexed foreign keys and 14 INFO for unused indexes. Leaked-password protection requires Pro or above according to [Supabase's password-security documentation](https://supabase.com/docs/guides/auth/password-security), checked 4 October 2026. No paid upgrade was made. Index recommendations need representative workloads before production; this empty preview is not a performance benchmark.

The first QA setup was stopped by the existing protected-identity guard because the test name contained “admin”. Its two partial Auth identities were erased through the existing deletion service and the original four accounts were verified unchanged. Neutral QA names then provisioned successfully. Neither the guard nor production naming rules were weakened. Retained evidence: `operator/cleanup-attempt1.json` and `operator/secret-audit-attempt1.json`.

## Material issues found and repaired during this phase

1. JavaScript/SQL canonical ordering and exponent-number serialization disagreed for new audit records. Phase 5 now has an explicitly versioned shared canonicalizer with SQL parity tests; old strategy/reference hashes are untouched.
2. A newly reported exhausted provider quota could previously be ignored until the end of a batch. Each response now reconciles quota before any subsequent request; failed calls keep reservations.
3. Mismatched provider identifiers, stale counts after non-freshness rejections and unmeasured metrics represented as zero were corrected.
4. Scanner batches could starve markets after the first 50; per-market checkpoints and bounded continuation now preserve coverage. Candidate pagination follows time and ID.
5. A strategy state alone must not relabel the unvalidated baseline as a live model; server and database gates now reject that path.
6. Queued manual scans recheck actor role, ban, active profile, originating session and worker lease. Staff mutations separately repeat MFA/session/ban checks.
7. Current-data rights/configuration revocation, raw expiry and canonical rescheduling are rechecked instead of trusting an earlier snapshot's eligibility.
8. Recognition excludes banned authors/engagers and incomplete/DEMO sample histories. Links labelled as full history no longer point only to settled outcomes.
9. Genuine hosted acceptance stopped after 123 successful assertions because the Data Health status token overflowed at 412px. The real presenter now wraps long status/configuration text, keeps wide diagnostics in a labelled keyboard-accessible scroller, and links to the existing `/admin/edge-scanner` route. Regression tests reproduce the original failure and cover both unconfigured and long-diagnostic states at 360/412/1366px. No authorization or data-fetching logic changed. The failed receipt and scoped account cleanup remain preserved; final acceptance is recorded separately.

## Secret checks

The final actual-value scan compared all five disposable QA passwords plus actual database/service, CLI and retained tester credentials: **3,598 source files and 500 built/exported/hosted-rendered files; zero findings/errors**. It ran before erasing the QA credentials. The heuristic scan intentionally remains a recorded FAIL requiring review: all five findings are fictional database passwords or a deliberately invalid PEM string in TLS/Auth test fixtures (`market-data`, `preview-auth-gate`, `database-tls`, `hosted-runtime`, `preview-auth` tests). They are not configured credentials. No broad allowlist was added to hide them. See `source-secret-patterns.json` and `actual-secret-audit.json`.

## External gates and exact next action

Both odds providers remain **NOT_CONFIGURED / INSUFFICIENT_EVIDENCE**. No trial latency, coverage, mapping rate, price quality or performance has been measured. The next action is for the owner to obtain a dedicated **The Odds API free Starter key** ($0/month, 500 credits, no history) from [the official provider](https://the-odds-api.com/#pricing), store it server-side as `THE_ODDS_API_KEY`, and approve the bounded pilot scope and data rights. Do not use a lookalike provider or put a key in chat, source, Android configuration or a `NEXT_PUBLIC_` variable. OddsPapi's optional free account needs its allowance and Docked retention/derived-display rights confirmed; its paid quote is UNKNOWN.

Before activation also approve versioned competition/bookmaker/ownership/standard-price mappings, an ordinary jurisdiction policy for market data and a local credit cap. Supply a separately licensed results source/export and settlement/correction rules. Configure a supervised backend worker/ingestion trigger and its dedicated server-only worker token only after those reviews. Existing Preview Tester capabilities do not grant market-data or official publication authority.

The conditional history plan remains 2022–2023 development / 2024 validation / 2025 held-out / 2026 YTD fixed-rule retrospective; actual provider/outcome coverage is unqualified. The Odds API advertises odds since 2020; OddsPapi's documented archive starts in 2026. No historic results were manufactured. Estimated acquisition cost requires an exact manifest/request budget and separate owner spending approval.

Strategy V1 is UNVALIDATED; forward paper has NOT STARTED; official publication is PAUSED. Current-data readiness is not evidence that the strategy has an edge. Android closed testing is the recommended following milestone only after the real-data pilot is stable, invited access/community work, moderation/support ownership and Play declarations/signing are ready. Do not publish to Google Play during this phase.

Conditional paid infrastructure subtotals are **US$85 lean beta / $85 normal beta / $114 early production / $174 higher-frequency**, before unknown results, storage/transfer, worker, email, monitoring, backups and taxes. These are planning scenarios, not authorised subscriptions or complete bills. The actual totals remain UNKNOWN. See [COST_MODEL](../../COST_MODEL.md), [PROVIDER_TRIAL_RESULTS](../../PROVIDER_TRIAL_RESULTS.md), [REAL_DATA_QUALITY](../../REAL_DATA_QUALITY.md) and [HISTORICAL_DATA_PLAN](../../HISTORICAL_DATA_PLAN.md).

## Deployment and final cleanup

Final reviewed web source **`38f90a13b5cd8834460b1ecdd6e2ff61ec949dd0`** is READY on [Docked Preview](https://docked-preview-s24-briant-ginty.vercel.app/edges), deployment `dpl_5Up2hMH7mksYzkC5EfnDnknm7EBj`. The exact-project audit confirms zero Production deployments/environment variables in this isolated project, 27 Preview variables, and the correct Android preview alias. Vercel's Git commit metadata matches the reviewed export/source commit ([provenance receipt](deployment-provenance.json)). Existing production and DNS were untouched. See [hosting audit](hosting-audit.json).

[Real hosted acceptance](hosted/acceptance.json) passed **198 assertions**: anonymous restrictions; member/admin/analyst/editor/auditor authentication; staff MFA; private cookies/cache; editorial/scanner/recognition role boundaries; cross-origin and forbidden mutations; five mobile tabs/refreshes; mobile/desktop admin screens; and logout with post-logout access denial. All 15 captured screen/viewport combinations passed automated accessibility and overflow checks. All six anonymous/role contexts recorded zero console/page errors. This run did not replay a previously issued token after logout; cleanup separately verified zero remaining QA sessions. Sporting-data success states remain local DEMO fixtures because no provider was configured. This is not a new signup/email-verification test; those prior lifecycle results remain separately recorded in Phase 4.5.

After the final credential comparison, all five QA accounts, sessions, roles and grants were erased through the existing deletion service. The original **four** Auth accounts were verified unchanged. Final database checks: 12 ordered migrations; zero tables without required RLS; zero enabled flags, real events/snapshots, official records, ordinary jurisdiction approvals, delivery attempts or external sends. [Cleanup receipt](operator/cleanup.json). Prior failed setup/overflow receipts remain preserved rather than concealed.

No new APK is required for these web-only changes. Existing APK: `artifacts/android/Docked-Preview-S24-v5-App-Entry.apk`, version 5 / `1.4-preview`, SHA-256 `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b`. The owner confirmed existing v5 entry works; new physical S24 cases remain unexecuted.

Selected actual hosted captures: [Edges](hosted/edges-412.png), [Feed](hosted/feed-412.png), [Following](hosted/following-412.png), [Points](hosted/points-412.png), [My Edge](hosted/my-edge-412.png), [Scanner](hosted/edge-scanner-412.png), [Candidates](hosted/candidate-edges-412.png), [Daily operations](hosted/daily-operations-412.png), [Data Health](hosted/data-health-412.png). No hosted screenshot contains genuine sporting data or fabricated performance.

## Requested 28-item handoff

| # | Item | Result |
| --- | --- | --- |
| 1 | Branch | `codex/docked-value-platform` |
| 2 | Implementation commits | `eb96e66` backend/research; `7dcab16` discovery/admin UI; `8b1a9b4` provider/operations and acceptance tooling; `38f90a1` hosted layout/link repair. Final evidence is committed separately. |
| 3 | Provider credentials | No odds/results key detected in process, local environment or verified Preview environment. |
| 4 | OddsPapi | NOT_CONFIGURED; no authorised real trial. |
| 5 | The Odds API | NOT_CONFIGURED; no authorised real trial. |
| 6 | Trial results | NOT RUN / INSUFFICIENT_EVIDENCE; zero requests and credits used, quality metrics UNKNOWN. |
| 7 | Recommended provider | The Odds API is the proposed first bounded trial, based on documented history/terms; no measured winner. |
| 8 | Estimated costs | Complete totals UNKNOWN. Conditional monthly USD floors: $85/$85/$114/$174 for lean/normal/early/higher-frequency scenarios; no subscriptions purchased. |
| 9 | Real fixtures | Canonical ingestion implemented and tested with isolated fixtures; no real sporting records imported. |
| 10 | Market Reference | Shared engine integrated with exact mappings, independence, freshness and rights checks; unavailable without approved observations. |
| 11 | Weekend Watchlist | Factual projection/editorial draft prepared; honest unconfigured state, no invented events or Edge claims. |
| 12 | Edge Scanner | Durable jobs/checkpoints, candidate evidence, quota-aware cached reads and admin health implemented; OFF. |
| 13 | Scanner schedule | Configurable 15-minute research starting cadence; no enabled schedule/hosted recurring trigger or next scan. |
| 14 | Candidate review | MFA roles, immutable review evidence, fresh revalidation, expiry/invalidation and idempotent guarded handoff implemented. |
| 15 | Official gate | Closed; baseline cannot qualify for live use; automatic publication forbidden; no official records created. |
| 16 | Manual candidates | Canonical-ID selection + reason through same engine; no arbitrary prices/probabilities and no bypass of deterministic selection order. |
| 17 | Trending | Versioned community-interest projection with unique-member/age/burst/integrity filters, DEMO excluded; no real qualifying records. |
| 18 | Edge of the Week | Completed-week eligibility and immutable audited recognition implemented; no winner invented or snapshot activated. |
| 19 | Historical availability | None supplied. The Odds API advertises 2020+, OddsPapi 2026+; actual odds/outcome coverage unqualified. |
| 20 | Historical cost | UNKNOWN total. Illustrative odds-only request envelopes map to $30/$119/$249 monthly tiers; separate results quote and owner approval required. |
| 21 | Strategy V1 | UNVALIDATED; original parameters/held-out boundaries preserved. |
| 22 | Forward paper | NOT STARTED; no performance generated. |
| 23 | Android | Existing v5 preserved/audited; no native changes or new APK; browser evidence is not new physical-device acceptance. |
| 24 | Tests | Backend 233/233; database 109/109; final browser 76/76; hosted 198 assertions; type/lint/build/client-canary/dependency checks passed. |
| 25 | Security findings | No actual-secret leak or advisor ERROR; Free-plan leaked-password-protection WARN and five reviewed fictional-fixture heuristic flags remain explicit. |
| 26 | Owner actions | Dedicated key, rights/configuration/mappings, bounded quota and ordinary jurisdiction approval; separate results/history rights; reviewed supervised worker configuration. |
| 27 | Spending approval | No purchases or paid-plan changes. Paid API/history/results/hosting upgrades require separate exact approval; existing account invoices were not audited. |
| 28 | Next action | Obtain a dedicated The Odds API $0 Starter key, store server-side as `THE_ODDS_API_KEY`, approve the documented bounded pilot scope/rights, then run and compare the real trial. |
