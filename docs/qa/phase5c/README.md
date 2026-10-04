# Phase 5C acceptance and handoff

4 October 2026. Branch `codex/docked-value-platform`, continued from clean `ef91d41307c87872c4c5da27bd9c8aacc18c8c20`. The foundation preserves the five-tab application, community, forward-only official record, independent model boundary and separate Market Reference.

## Delivered and deliberately unavailable

Implemented: versioned source/feature/policy governance; purpose-specific rights; 17 structured fact types; provenance, deduplication, conflict resolution and append-only corrections; immutable prematch snapshots; retained correction ancestry; team/player descriptive trend functions; a fixed, bounded dataset adapter; durable disabled research jobs; staff administration and reviewed member content.

Not operational: a fitted Football V1 estimator, accepted canonical training/input dataset, authoritative regulation ResultsProvider, automatic research-to-prediction executor, active model features, public Edge publication or autonomous live research. Research notification preferences persist, but transport/fanout and persistent team follows remain future work. Only pinned OpenFootball ingestion is implemented; injury/lineup/news/weather adapters require their own reviewed sources and implementation. The production `docked_app` role has no new research authority; a future production release needs a reviewed least-privilege extension.

No historical Docked tips, probabilities, ROI or reconstructed Edge ledger were created. No production deployment, DNS, Oura, paid subscription, external email or additional Odds API request occurred.

## Source findings

[Source evaluation](../../RESEARCH_SOURCE_EVALUATION.md) compares 13 source families using first-party evidence. Two OpenFootball EPL resources are narrowly approved for automated research in the code catalogue under CC0. The hosted registry, schedules and datasets remain empty. No source is approved manual-only. football-data.org, API-Football, Sportmonks, Arsenal and Football-Data.co.uk need permission/scope clarification for intended use. StatsBomb Open Data, unlicensed Premier League/FPL extraction and the Open-Meteo Free endpoint are prohibited for Docked's current commercial scope. Met Office, NOAA and Wikidata need a specific reviewed integration/account scope; they are not operating feeds.

OpenFootball costs $0/no key. Local pinned quality inspections found 380 rows/20 teams per season: 380 reported scores in 2025/26 and 50 in 2026/27. Original score-known times, timezone, canonical mapping and authoritative finality/corrections are missing. Those limitations remain explicit in the parser/quality reports. No result is promoted to settlement or a model input. Optional player/news/weather data is not a V1 prerequisite.

## Database and security

The exact Docked Preview identity `bckkllmndoxzpzdqrevb` / organisation `ernfnkcbalhyqpsrzdwa` was reverified. A protected application preimage and matching CLI dry run preceded the single additive migration. [Migration verification](hosted-migration.json) confirms 17 ordered migrations and 14 new private tables with RLS and no anonymous/member grants. Migration byte hash: `8eac0a97fce84dfb34c1b00f7ba5f6270857433a8f536155cbfbd870eca75f5b`. The preimage excludes Auth-managed/storage records; it is not a full disaster-recovery certification. Recovery is transactional rollback on migration failure or a reviewed forward repair; never delete prior ledgers to reverse research work.

Focused and full PostgreSQL tests cover real local operations, not SQL-text assertions alone: role/session/MFA checks, rights changes, expiry, immutable corrections, source/dataset hashes, positive dataset persistence, snapshot/content review, conflicts, retention, quota reservations, duplicate jobs, lease ownership and event changes. Test fixtures are isolated synthetic data, not hosted research or sporting results.

The advisor check retains **32 INFO RLS-without-policy findings** (including 14 deliberate new private default-deny tables), **one existing WARN for leaked-password protection disabled**, **104 INFO unindexed foreign keys** and **13 INFO unused indexes**. This is not a zero-notice certification. Do not add permissive policies or remove required indexes to silence notices. Review [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS interpretation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) before broader release/load. Actual reports: [security](advisor-security.json), [performance](advisor-performance.json).

## Validation evidence

| Check | Actual result / receipt |
|---|---|
| Final platform/unit tests | 360/360 PASS, [TAP](platform-final.tap) |
| Full PostgreSQL/RLS integration tests | 167/167 PASS, [TAP](database-tests.tap) |
| Browser suite | 89 distinct passing cases across retained runs: original 88/89 plus repaired notification; not one final-source full-suite pass. [Scope](local-browser-acceptance.json) |
| Final compiled-CSS acceptance | 6/6 PASS; final service-status copy 1/1 PASS with six states at 412px. [Six checks](compiled-css-accepted.json), [copy check](connection-copy.json), [screens and review](EXPERIENCE.md) |
| Typecheck / whole lint | PASS, [typecheck](typecheck.txt), [lint](lint.txt) |
| Optimized production web build | PASS on final production CSS; external services disabled and server-only canary values supplied, [receipt](web-build-final.json), [output](web-build-final.txt) |
| Client boundary | 52 browser assets, no canary leak, [final receipt](client-boundary-final.txt) |
| Dependency audit | 0 vulnerabilities, [receipt](dependency-audit.json) |
| Initial focused core/adapter tests | 29/29 PASS, [receipt](research-core-tests.tap) |
| Focused DB/backend checks | 16 DB + 9 scheduler/projection PASS, [receipt](research-backend-results.json) |
| Android v7 | Build/signature/manifest/network/988-entry credential checks PASS, [details](android/apk-details.json) |
| Physical S24 | NOT TESTED; previous v5 acceptance does not certify v7 |

Final Preview application source is **`281b3ac7e0229c6314b940a5a17d4680b21721a5`**, deployment `dpl_Cp1dHyFPYr5pJNY3u6YE4S85pLq2` at the [existing isolated alias](https://docked-preview-s24-briant-ginty.vercel.app). [Deployment receipt](operator/deployment.json). The later documentation commit does not change that verified application revision.

Actual hosted acceptance passed **104 staff/public assertions** and **22 ordinary-member denial assertions**, using real password/TOTP sessions. Ten rendered views (research dashboard, real-fixture research detail, model performance, daily operations and public results at 412/1366) plus expanded source forms passed tagged WCAG 2 A/AA, 2.1 AA and 2.2 AA checks, overflow and console checks. This does not claim every optional axe best-practice rule was scanned on hosted pages. The existing default-axe landmark advisory is not represented as a new product pass/failure. [Staff/public receipt](hosted-final/acceptance.json), [member denial](hosted-final/member-denial.json), [final screenshots](hosted-final/research-412.png), [expanded form](hosted-final/research-form-1366.png).

Local secret checks covered 80 changed source/document files, 116 artifact files and 34 rendered HTML/RSC responses with 25 chunks, with no findings/errors. Hosted rendered checks covered 29 files / 1,526,605 bytes, comparing actual browser access/refresh cookies in memory; no values are in evidence. [Local scan](local-secret-audit.json), [hosted scan](hosted-final/client-secret-audit.json), [public evidence scan](evidence-secret-audit.json). The sensitive Vercel Odds API key was not retrieved, so no exact-value absence claim is made for that unknown key.

The temporary operator was erased through the existing account-deletion flow. [Cleanup](operator/cleanup.json) verifies zero users/sessions/profiles/roles/grants remaining for it, **four original accounts preserved**, all feature gates off and all model/research/publication ledgers empty. [Preservation](preserved-provider-model-state.json) confirms all 26 existing provider/model/event/official-record tables are unchanged. No provider request or external email was sent. [Changed-file inventory](changed-files.txt) and [machine-readable summary](final-summary.json) accompany this report.

## Review fixes and preserved failures

- Source public-display permission is separate from retention/modelling permission; freshness uses the real observation clock.
- Conflicting evidence is resolved before filtering to editorially approved IDs. Unpublished facts cannot leak through a member projection.
- Snapshot identities include captured match/kickoff, sources, complete evidence and correction ancestry. Later rescheduling does not rewrite an old snapshot.
- Expired withdrawal payloads cannot resurrect old facts: permitted immutable ancestry remains without the expired value.
- Only qualifying active-feature changes or conflicts can be eligible for recalculation. Other requests are retained as display-only, withheld or unconfigured without model execution; corroborating rumours and display-only changes cannot alter probability.
- Feature definition hashes avoid a model/feature circular hash dependency. Raw source hashes cover actual bytes; 304 responses do not refresh evidence age, and Retry-After is respected.
- The full mobile shell exposed a contrast defect in white research form surfaces. Research-local tokens now retain navy text on white fields/cards. Checkbox controls were enlarged to 24 pixels, with 44-pixel research labels. Keyboard focus must clear the sticky header and bottom navigation.
- The original broad browser run passed 88/89 cases; the notification checkbox target-size failure was retained and repaired. A compiled-style rerun caught a timing issue in the new focus assertion: smooth scrolling was still moving the viewport. The bounded assertion now waits for visible focus and settled scrolling without disabling axe rules or changing application scrolling.
- Research fixtures now reproduce the actual desktop workspace column, complete 17-type fact taxonomy and compiled stylesheet order from the rendered application document. Earlier narrow/standalone and failing receipts remain distinct from final acceptance.
- The initial isolated UI harness blocked its own local font; exact bundled font bytes repaired the fixture without weakening console assertions. Initial failure receipt is retained.
- The first hosted command omitted its required explicit run/project arguments and stopped at scope validation with zero checks/browser sessions. Its failure receipt is retained. Earlier versions passed 88 and 102 assertions; final-source acceptance is recorded separately.
- A later hosted Data API probe rejected the older setup-session token. The helper now uses and verifies the freshly MFA-authenticated browser session for both private-schema probes and credential comparison; authentication/denial requirements remain unchanged.
- The service transport status was misleadingly titled research readiness. It now says **Research service / Connected** while preserving the explicit empty source registry and **MODEL BLOCKED — DATA REQUIRED**. Connected-empty and genuinely unconfigured states are tested separately.
- The first combined Git staging/commit hit a filesystem permission error. Explicit authorized staging and commit succeeded; no filesystem ACL or security control was weakened.
- The agent-browser Chrome/CDP launch was unavailable on this Windows host. Working Playwright browser checks provide the recorded evidence; that tooling limitation is not a passed agent-browser session.

## Required next milestone

Assess the free pinned EPL dataset for canonical team/event mapping, chronology, regulation-score semantics, completeness/anomalies and a justified training manifest before buying data. Then fit/version the simple independent goals baseline and review its prospective prediction/revision policy. Resolve a reliable current fixture/result source with lasting permitted audit/derived use (football-data.org Free is a candidate after clarification). Do not manufacture absent clocks or promote the research-only dataset automatically.

No spending is required for the delivered foundation or the next offline quality study. New provider accounts/keys, paid plans, runtime source activation, model approval and production release are separate decisions. Closed beta can continue independently of official model readiness, subject to existing operator/legal/Play, transactional-email, moderation/support, signing and physical-device gates.

## Requested 31-item handoff

| # | Item | Status |
|---|---|---|
| 1 | Branch | `codex/docked-value-platform` |
| 2 | Commits | Implementation `71f59dde`; mobile contrast `a76404ea`; accessibility `7d22e02c`; truthful service status `281b3ac7`. This report and receipts belong to the subsequent documentation/evidence commit in branch history |
| 3 | Research Engine | Governed foundation implemented; runtime automation disabled |
| 4 | Sources researched | OpenFootball, football-data.org, API-Football, Sportmonks, StatsBomb, Premier League/FPL, Arsenal, Football-Data.co.uk, Met Office, Open-Meteo, NOAA/NWS, Wikidata, existing Odds API scope |
| 5 | Approved automation | Two pinned OpenFootball EPL research resources in reviewed catalogue; zero enabled hosted sources |
| 6 | Manual-only | No real source currently approved; governed manual-entry capability exists |
| 7 | Permission required | football-data.org, API-Football, Sportmonks, Arsenal, Football-Data.co.uk for intended retention/derived/commercial scope |
| 8 | Prohibited | Current StatsBomb open licence, unlicensed Premier League/FPL automated extraction, Open-Meteo Free for commercial Docked use |
| 9 | Free coverage | EPL source-reported goals/fixtures at $0; optional weather candidate; no cleared operational current lineup/injury/xG service |
| 10 | Match Research File | Structured as-of snapshots, completeness, provenance, conflicts, retained ancestry and reviewed member projection implemented |
| 11 | Team trends | Configured descriptive windows/context/sample safeguards; no genuine values populated |
| 12 | Player trends | Same reusable rate/minutes/baseline framework; no authorised current player dataset |
| 13 | Lineups | Expected/confirmed schemas and evidence states; no live adapter or active model weight |
| 14 | Injuries | Typed availability/return/suspension facts; no operational source or invented player-impact values |
| 15 | News | Conservative structured manual evidence and linked attribution; no random scraper, article copying or LLM probability path |
| 16 | Results | `RESULTS_PROVIDER_STATUS=NOT_CONFIGURED`; dataset scores do not settle records |
| 17 | Scheduler | Existing durable queue, configurable prematch windows, idempotency, leases, source/quota/circuit guards; all off, no external cron |
| 18 | Source health | Actual request reservations/counts and nullable success/failure/status; unavailable billable credits/monthly monetary projections remain unknown |
| 19 | V1 data readiness | Free research candidate inspected, but canonical model dataset not accepted; reliable current results also missing |
| 20 | V1 model status | Proposed explainable EPL pre-match regulation 1X2 Poisson baseline; unfitted/unvalidated, no runnable estimator |
| 21 | Active features | None installed; exact model/config-bound eligibility gate implemented |
| 22 | Display-only features | Descriptive form/trends/H2H, lineup/availability/news/weather context cannot change probability without future reviewed feature/model versions |
| 23 | Market Reference | Existing independent comparison boundary preserved; reference classification/cohorts unconfigured, prior prices stale and polling off |
| 24 | Scanner integration | Governed upstream research interface prepared; prediction must commit before market comparison; automatic estimator/revision executor still future work |
| 25 | Content/feed | Reviewed research/match/lineup content type, detail routes, Feed/watchlist links and separate opt-ins implemented; notification delivery/team-follow fanout not implemented |
| 26 | Tests | 360 platform, 167 PostgreSQL/RLS; 89 distinct browser cases across runs; 104 hosted staff/public + 22 member checks; typecheck/lint/build/audits passed. Exact limitations and retained failures above |
| 27 | Android | v7 / 1.6-preview built; all 988 entries scanned; v3–v6 preserved; physical S24 unverified |
| 28 | Play closed beta | Official model profitability is not a beta requirement. Operator/legal/Play declarations, transactional email, support/moderation, signed AAB/upload key and physical acceptance still required |
| 29 | External inputs | Current authoritative EPL fixture/regulation-results rights and access, retained audit/derived-use clarification; optional player/news/weather permissions later |
| 30 | Spending | None required or incurred for source plans. No paid plan/trial/extra credits purchased; paid fallback needs explicit approval |
| 31 | Next action | Complete the $0 OpenFootball canonical data-quality/training-manifest study, then fit/review a versioned independent goals baseline. Resolve current results scope in parallel; keep polling/publication off until approved |
