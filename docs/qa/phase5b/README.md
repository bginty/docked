# Phase 5B revised — forward-only Docked record

4 October 2026. Continued the clean `codex/docked-value-platform` checkout at `23a4b715544dd8dfd6a637b909cfcf360f3551c5`. This evidence concerns the isolated Docked Preview only. The product has no genuine official publications, no official record start date and no operational independent football estimator.

## Delivery and boundaries

Implementation commit: `e1c8086d541401d128f9b0e7620ef93cbf7ce6e9` (`Build independent football model pipeline and forward-only Docked record`). Methodology/provider documentation: `194b3a9c61812dd806b18120b9bcff1cda1951ad`. The acceptance commit containing this report is identifiable in this branch's Git log. These subsequent documentation/test-tool commits do not change the accepted deployed application source.

The [stable Preview](https://docked-preview-s24-briant-ginty.vercel.app/results) serves implementation `e1c8086` from Preview deployment `dpl_5tSJbtj3Ed4cECnoUGmJdejJNSYf`. [Deployment receipt](operator/deployment.json) records the exact project, team, source and previous deployment. Its health confirms a connected database, unavailable feed/strategy and publication off. The production holding page, production application, DNS and Oura were not changed. No sports-data plan, odds credits, sending service, billing or prize feature was purchased or activated. No external email, provider request or invented sporting record was needed for this phase.

The new [Android v6 APK](../../../artifacts/android/Docked-Preview-S24-v6-Forward-Record.apk) opens the same stable HTTPS Preview at `/app`. It is an HTTPS launcher, not a bundled copy of the Next.js application. Its initial packaging receipt truthfully identifies the earlier Phase 5A host; the deployment receipt above identifies the subsequently updated web application.

## Requested handoff

| Item | Delivered state |
|---|---|
| 1. Branch | `codex/docked-value-platform`, continued without rebuilding the project. |
| 2. Commits | Implementation `e1c8086`; methodology/provider documentation `194b3a9`; final acceptance commit recorded in Git and the handoff message. |
| 3. Historical performance | Public results, methodology, research explanations and educational copy now distinguish sporting input history from betting performance. Supersession notices retain useful replay/testing history without retaining a historical-ROI launch gate. |
| 4. Official record architecture | New immutable first-publication boundary and official-publication mapping; one unit per genuine forward LIVE Edge, complete corrections and version/date filters. Research, paper, DEMO, community and unverified legacy records are excluded. |
| 5. Official start | **Unset; zero official publications.** Only the first genuine, pre-event approved live publication sets it atomically. |
| 6. Model architecture | Strict sporting-only contracts, provenance/input/config/code hashes, as-of clocks, immutable version lifecycle, and independently committed prediction/abstention before market comparison. |
| 7. V1 method | Proposed explainable independent Poisson goals baseline using attack/defence strength, competition and home advantage. No fitted parameters, decay window or promoted-team prior has been invented. |
| 8. Sporting data needed | Licensed dated regulation results, canonical team/competition/event mappings, sufficient prior match history and source revisions/retention authority. Injuries, lineups and xG remain optional. |
| 9. Providers researched | football-data.org, API-Football/API-Sports, Sportmonks and Hudl StatsBomb Open Data, using first-party documentation/terms. |
| 10. Recommendation | Investigate football-data.org Free first; API-Football Free is another technical candidate. No operational source is approved: **INSUFFICIENT_AUTHORISED_DATA** until coverage and commercial/derived/retention rights are established. |
| 11. Cost | football-data.org Free €0/month; ML history plan advertised €29/month. API-Football Free $0; Pro advertised $19/month, billing currency to confirm. Conditional Sportmonks fallback €29/month or €24/month equivalent billed annually, with possible history/xG extras. [Exact limits and source links](../../FOOTBALL_DATA_PROVIDER_RESEARCH.md). No paid option selected. |
| 12. Owner approval | No current spend required. Paid data requires explicit approval of exact plan/currency/billing/coverage. Any sporting ingestion additionally needs documented commercial modelling, derived publication and durable evidence rights. |
| 13. Model implementation | Contracts, guards and unavailable adapter implemented. **Fitted estimator, sporting adapter and authorised dataset not implemented/configured.** No probability or model advantage claimed. |
| 14. Prediction ledger | Every eligible canonical event/model/window attempt can be retained before kickoff, including abstention and events without market prices. Cohort reruns cannot replace bad predictions. Outcomes append separately. Real ledger remains empty. |
| 15. Calibration | Version/window cohorts, complete population, Brier, log loss and class probability buckets implemented. Missing/abstained states are retained; execution exceptions remain in scanner/job audit, with their dashboard projection still future work. No real scores, uncertainty band or drift indicator fabricated. |
| 16. Market Reference | Preserved independent price/reference controls. Previous Free-plan sample is retained; no new calls. Unknown source classification and empty reference cohorts mean **NOT_CONFIGURED**. Existing legacy odds status is **PENDING_RIGHTS**. |
| 17. Scanner | Canonical football event pass commits model attempts first, then separately evaluates cached eligible market evidence. Decimal EV and upward-tick minimum price, frozen threshold/order and maximum one official Edge per event. Schedules remain off. |
| 18. Candidate workflow | Current owner/admin MFA, approve/reject only; fresh model/code/input/price/EV/event/region/provider revalidation and independent database guards. No client probabilities, force-qualification control or automatic publication. |
| 19. Results | **NOT_CONFIGURED**. Existing canonical results boundary retained. Odds API scores have not established the exact regulation/lifecycle/correction contract; pending outcomes are not guessed. |
| 20. Trending | Up to three eligible community Edges with visible likes and existing recency/anti-gaming rules; community interest, not predictive merit or Top Docked ranking. No new fake users or selections. |
| 21. Edge of the Week | Community-only recognition for genuinely eligible settled records; DEMO excluded. Empty state remains “No qualifying Edge this week yet.” |
| 22. Play closed testing | Independent of model profitability. v6 Preview APK available; closed-test upload signing, Play account/track/declarations, operator/privacy/support readiness, actual email delivery and physical-device acceptance remain. |
| 23. Transactional email | Prepared, external sending off. Resend Free is the low-cost candidate; exact account allowance, dedicated credential, verified sending domain, DNS authority and an authorised real-delivery test are still needed. [Setup](../../TRANSACTIONAL_EMAIL_READINESS.md). |
| 24. Tests | See validation and hosted receipts below. Local tests use labelled synthetic data only in isolated test databases/render fixtures; they are not real model observations. |
| 25. Android | v6 / `1.5-preview`, package `au.com.docked.app.preview`; same actual v5 certificate. [Build/audit report](android/README.md). Physical S24 v6 verification remains unperformed. |
| 26. Blockers | Sporting rights/history/key, estimator fitting/registration, authorised regulation results, market source classification/cohorts, prospective model evidence and owner/legal release gates. The final Preview has no persistent staff assignment; normal owner review needs a separately verified owner role and MFA. Independent-model closing-price CLV and justified drift measurement remain future work and unavailable. |
| 27. Exact next action | Obtain written football-data.org clarification for commercial independent modelling, derived probability display, permanent audit/input/result retention including after cancellation, and available EPL/La Liga historical seasons. Supply the approved licence/coverage and server-only key or licensed dataset. Then implement/import a bounded sporting adapter and fit/version the proposed baseline. No purchase or provider contact was made for you. |

## Validation

| Check | Evidence |
|---|---|
| TypeScript | [Passing implementation typecheck](typecheck.txt) and [final operator-tool typecheck](typecheck-acceptance-tools.txt). |
| Lint | [Passing final implementation lint](lint-accepted.txt) and [operator/test-tool lint](lint-acceptance-tools.txt). |
| Platform | [317/317 full-suite pass](platform-tests-accepted.txt), plus [two passing operator-scope regressions](operator-scope-tests.txt) added afterward. |
| PostgreSQL/RLS | [151/151 full-suite pass](database-tests-accepted.txt), with ordered migrations in isolated PGlite and database-enforced lineage, immutability, role, freshness and publication checks. |
| Production web build | [PASS](web-build-accepted.txt), local build ID `UoeIerr0YZmdU1OmJylsP`; the deployed Preview independently reached READY. |
| Dependencies | [Zero vulnerabilities](dependency-audit-verified.json). |
| Official record fixtures | [Two passing focused browser cases](official-record/README.md), clearly labelled local render-only empty/restricted/populated states. No fixture entered Preview. |
| Full browser regression | **84 distinct cases passed across recorded runs.** [Original full run](browser-initial-full.json): 78/84, six failures from obsolete Results text. [First focused rerun](browser-corrected-contracts.json): five sports widths passed, the public journey reached its duplicate obsolete metric assertion. [Final public journey](browser-experience-final.json): 1/1 passed after that same wording correction. No product source, timeout or safety assertion changed. |
| Hosted staff | [66 passing assertions with actual password + MFA/API and six rendered views](hosted/acceptance.json), at 412/1366 pixels with axe, overflow, image and console checks. |
| Hosted member/cleanup | [12 passing genuine member-denial checks](hosted/member-denial.json). [Exact disposable-account cleanup](operator/cleanup.json): zero residue; four original accounts unchanged. [Independent final state](operator/post-cleanup-state.json) also confirms unchanged supplier-trial counts and zero new calls. |
| Android | Gradle build passed; 988 archive entries and actual signature/package/network policy audited; [all native evidence](android/README.md). |

The full local browser run uses a closed local environment with no configured database or supplier credentials. Hosted MFA/member checks use the real isolated Supabase and deployed application. Neither replaces physical S24 acceptance, authorised sporting samples, genuine future calibration or a hosted successful live publication.

The [experience acceptance report](EXPERIENCE.md) and [browser case summary](browser-acceptance.json) map the 84 distinct passing cases. Six additional anonymous Results/Research/Methodology views at 390/1366 pixels passed WCAG, console, image, overflow and no-external-request checks; [public review receipt](public-review/receipt.json). A broader default axe scan retained six occurrences of the `region` best-practice rule, covering the same two existing global-chrome targets per view (12 target occurrences): `.topline` and `.preview-banner` are outside landmarks. These moderate advisory findings are disclosed rather than counted as zero findings; they are separate from the passing tagged WCAG checks.

The [machine-readable validation summary](validation-summary.json), [implementation/documentation file inventory](implementation-files.txt) and [complete changed-file inventory including QA evidence](changed-files.txt) accompany this report. Source changes after the accepted application commit are limited to documentation, acceptance helpers and test wording; they do not require another application build.

### Preserved failures and repairs

- Initial platform concurrency produced a child-process test timeout while the database/native suites also ran. The complete bounded-concurrency rerun passed 317 tests; the failed [initial final attempt](platform-tests-final.txt) remains.
- An existing database provider-permit fixture used a 30ms expiry and expired during shared CPU load. Its regression now uses a valid permit and waits for the actual database expiry before testing rejection; no production expiry safeguard changed. The [initial run](database-tests.txt) and full 151-test pass are both retained.
- An official-record fixture initially used End for a horizontal-scroll check; ArrowRight now exercises the intended keyboard behavior. The first render also exposed narrow metric columns; the responsive grid was corrected before the accepted build. [Fixture history](official-record/README.md).
- The broad browser run found an obsolete accessible-name locator after the official ledger was renamed, plus five widths using the old “Settled publications / N/A” text. The first focused rerun passed the five widths and exposed a duplicate of that metric assertion at the end of the public journey, after its page/accessibility/consent checks had passed. The final exact journey passed 1/1. Only the locators/expected new wording were corrected; unavailable values, focus, horizontal-scroll and accessibility assertions remain. The original and intermediate failures are retained rather than calling either run fully green.
- The first dependency audit could not reach the registry inside the sandbox. A separately authorised read-only retry returned zero vulnerabilities; the original [failed request](dependency-audit.json) remains.
- Initial hosted snapshot setup rejected an unrecognised CA environment variable. The documented `DATABASE_SSL_CA_FILE` was supplied and strict TLS verification succeeded; certificate checking was never disabled.
- Android's initial receipt guard rejected the real inactive `PENDING_RIGHTS` provider state. Its narrow fix additionally requires explicitly false polling/publication flags; active/unknown states still fail. [Guard/build evidence](android/README.md).
- The first final source-artifact secret audit was incomplete at its inventory stage, with no confirmed cause or credential finding. Its sanitized incomplete receipt remains private. The complete instrumented rerun passed; incompleteness was not treated as a successful scan.

## Database and security

Only Docked Preview `bckkllmndoxzpzdqrevb` in organisation `ernfnkcbalhyqpsrzdwa` was used. The [preimage receipt](migration-preimage.json), [dry-run plan](migration-plan.json) and [post-apply verification](hosted-migration.json) establish 16 ordered migrations. New migration `20261004003850_phase5b_independent_football_model_ledger.sql` has SHA-256 `779c6fafdac2343cd6f7dc1f7f5c063bc69d0dec4abbed845b3e30f4b3dafac3`. The original preimage is protected outside Git. Recover through reviewed forward repair or restoration into another isolated project, never deletion of ledger evidence.

All ten new private tables have RLS and no anonymous/member read or write grants. Tests enforce top-level committed predictions, captured kickoff/mapping, immutable inputs/model/config/probabilities, append-only outcomes, current worker/actor authority, no same-transaction shortcut and no backdated/legacy official insertion. The hosted API independently rejects ordinary members, AAL1 staff, cross-origin mutations, arbitrary probabilities and missing-model/policy promotion attempts.

[Local secret audit](local-secret-audit.json) scanned 79 changed/new source artifacts plus 111 compiled/rendered client artifacts with zero findings/errors. Its recorded Git HEAD was the pre-commit base; per-file hashes identify the tested working source. [Hosted rendered audit](hosted/client-secret-audit.json) additionally compares the disposable browser session's actual tokens/cookies in memory. APK auditing covers every extracted file. The sensitive Vercel Odds API key was not retrieved, so an exact-value comparison of that unavailable secret is not claimed; server/client boundaries, patterns and canaries were checked.

[Final source/public-evidence audit](final-source-secret-audit.json) passed 525 source/docs/helper artifacts (127,406,059 bytes) and 539 public-QA/client artifacts (78,150,888 bytes), with zero findings/errors. It included preserved failed-run evidence and actual temporary operator credentials before erasure. Counts describe that exact manifest, not a claim that subsequent count-only handoff edits or newly written final browser receipts were already present. The hosted scan separately included its current browser token/cookie values.

The [closing incremental audit](closing-artifact-audit.json) then passed three changed source/doc/test files and 115 new/changed public QA artifacts, including final browser captures, rerun failures, cleanup and advisories; zero findings/errors. It links the preserved earlier audit and confirms unchanged hashes for 523 source and 400 public artifacts. Erased temporary credentials were not recovered. Subsequent handoff count/link edits contain no credentials; the local QA server and browser processes were stopped after acceptance.

[Security advisor](security-advisor.json): 18 informational RLS-without-policy notices reflect intentional private default-deny tables; one existing warning concerns disabled leaked-password protection. No automatic setting/plan change was made. Review [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) with the account's available plan before public release. [Performance advisor](performance-advisor.json): 90 informational unindexed-foreign-key and 11 unused-index notices; retain a measured query/index review before scale. These are unresolved advisories, not a claim of an error-free advisor report.

## Visual and device evidence

- [Hosted public record, mobile](hosted/public-results-412.png) and [desktop](hosted/public-results-1366.png).
- [Hosted Model Performance, mobile](hosted/model-performance-412.png) and [desktop](hosted/model-performance-1366.png).
- [Hosted Docked Today, mobile](hosted/daily-412.png) and [desktop](hosted/daily-1366.png).
- [Additional public Results, Research and Methodology review](EXPERIENCE.md), including actual anonymous database-unavailable states at 390/1366 pixels.
- [Packaged Android offline shell, 412px browser rendering](android/apk-offline-412.png); this is not a native-device screenshot.

The public record shows a truthful unstarted date with zero counts and unavailable rates. Staff pages keep the compact navy app shell and five tabs, while clearly showing no registered model/cohort. Physical Samsung S24 v6 installation, keyboard/back behavior and lifecycle still require the [device checklist](../../ANDROID_ACCEPTANCE.md).
