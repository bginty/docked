# Zero-cost post-game scoring investigation

Reviewed 11 October 2026, Australia/Sydney. Supersedes any assumption that Docked requires a paid or real-time API. The owner accepts post-game scoring for the isolated free friends beta. No commercial subscriptions, invitations, production data changes or rule changes are authorised by this investigation.

## Recommendation and boundaries

**NFL: pursue nflverse's downloadable weekly player statistics first, at $0 data-download cost, with no API account/key.** A current-season bulk file was actually downloaded and parsed by the new adapter. It contains 4,517 unique game/player rows across 65 games, including 1,458 offensive-position rows. 1,457 of those rows can be normalized to the current Docked rules; one has ambiguous touchdown categories and stays pending. This is observed snapshot coverage, not a guarantee for every future player/round. A stats file is not an active-roster catalogue and missing players are not automatically DNP.

**EPL: no evaluated zero-cost source currently establishes both complete Docked player-stat coverage and permission for this hosted use.** This is an investigation result, not a claim that all football facts require a paid licence. OpenFootball is genuinely open and current-season fixtures exist, but the download has no player statistics. Assess a permitted administrator match-stat CSV as a temporary option; it cannot make missing underlying evidence or prohibited copying acceptable.

The free NFL candidate is not yet enabled for hosted member results. Exact completion evidence, ambiguous TD event attribution, source-scope review and the hosted scoring read path still need completion. No public scoring result or deadline has been created.

## Source comparison: actual evidence versus uncertainty

| Candidate | Access/reuse evidence | Coverage and mapping test | Corrections, storage, attribution | Decision |
|---|---|---|---|---|
| nflverse `stats_player` release | [Data repo](https://github.com/nflverse/nflverse-data) publishes [CC BY 4.0](https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md), with automated downloads explicitly supported by [nflreadr](https://nflreadr.nflverse.com/reference/load_player_stats). No paid key. | Actual 2026 file tested; GSIS player ID + game ID + season/week/team/opponent, not name matching. Twelve required statistics map directly. Three TD subcategories are determinable only when the relevant explicit aggregate is zero. | [Update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html): nightly after game days; Thursday data incorporates usual midweek corrections. Retain attribution, licence link and modification notice. Licence permits adaptation/storage within rights granted; no required raw deletion period found in CC BY. Docked chooses bounded raw retention. No SLA or finality guarantee. | Preferred free NFL candidate; partial adapter works. Repository licence is affirmative evidence, not a guarantee of every upstream right. |
| nflverse play-by-play | Same repository data licence; bulk release, not per-player scraping. | Companion investigation below. Must reconcile event-derived categories against weekly totals; cannot simply add all return/recovery touchdowns. | Separate payload hash/revision and field semantics required. | Resolve exceptional TDs/completion before complete-round activation. |
| OpenFootball | [Explicit public-domain statement](https://openfootball.github.io/); downloadable text/JSON. No credential or payment. | [2026/27 EPL JSON](https://openfootball.github.io/england/2026-27_1-premierleague.json) actually inspected: 380 fixture rows; only 10 have full-time scores in this snapshot. Team names/date/round, no player IDs, lineups or player statistics. First match Arsenal–Coventry: 3–0 (HT 2–0). This checks fixture structure only. | Changes via repository history; no result-finality/SLA assurance. Team alias registry and independently verified fixture identities needed; never identify a fixture solely by mutable kickoff time. No attribution requirement asserted beyond the public-domain statement; keep provenance voluntarily. | Useful free fixture context, **not scoring**; current results coverage is incomplete. |
| football-data.org free API | [Official pricing](https://www.football-data.org/pricing): EUR0, delayed scores/fixtures/tables, 10 calls/minute. [Actual registration terms](https://www.football-data.org/client/register) reviewed. No blanket commercial-use prohibition identified there. Account/key required; none created. | Free plan does not establish all required individual actions, saves, exact regulation time, assist definition and ordered on-pitch evidence. Official plan matrix lists lineups/squads/cards/scorers at higher tiers. No authenticated current-season payload acceptance claimed. | Attribution required. Terms clause 9.1 restrict continued reference to data after subscription cancellation; effect on retained derived game history needs clarification. Separate graphics rights. | Free fixtures/results candidate, not complete player scoring. Paid plan is not presumed necessary. |
| StatsBomb/Hudl Open Data | [Actual PDF agreement](https://github.com/hudl/open-data/blob/master/LICENSE.pdf), last updated 8 September 2023, read in full. Research purpose; explicit restrictions on commercial exploitation and external raw-data redistribution. GitHub delivery is intended. | Actual competitions index lists EPL 2003/04 and 2015/16, not current EPL. Rich historical event/lineup data cannot become current beta stats. No current-match player reconciliation claimed. | Analysis attribution includes StatsBomb branding; no unrestricted commercial derived-use permission inferred from README. | Historical research only within agreement; free hosted-beta use needs clarification and current data is absent regardless. |
| football-data.co.uk downloads | [Operator's current notice](https://football-data.co.uk/contact.php) limits private-individual use and explicitly rejects automated/commercial scraping and data-training use. | Team-level results CSVs do not supply the full individual Docked scoring ledger. No data collection attempted under a conflicting permission assumption. | No permission to maintain a hosted player-scoring database inferred from “free”. | Not selected for Docked automation. |
| Premier League match reports / public FPL endpoints | [Premier League terms](https://www.premierleague.com/en/terms-and-conditions) permit limited personal/private use; wider redistribution/database/commercial reuse requires permission. Public endpoint access is not a licence. | No authorised full player payload tested. Standard aggregate box scores alone do not establish regulation-only seconds, ordered concessions or Docked's assist definition. FPL fantasy totals are not Docked inputs. | Attribution does not override restricted reuse; storage and corrections need permitted source agreement. | Permission required for intended systematic collection; no scraper implemented. |
| NFL.com box scores/gamebooks | [NFL terms](https://www.nfl.com/legal/terms/) restrict systematic database extraction without written permission. | No gamebook collection or complete field acceptance performed. | No storage approval inferred. | Not automated. |
| FBref / Pro-Football-Reference | [Data-use policy](https://www.sports-reference.com/data_use.html) search-visible official text requires permission for products built on scraped data. Direct policy request returned 403; no bypass attempted. [Bot guidance](https://www.sports-reference.com/bot-traffic.html) limits frequency; those limits do not grant reuse rights. [Manual CSV export](https://faq.sports-reference.com/portal/en/kb/articles/how-to-download-data) exists. | No authorised full box-score acceptance performed. Field completeness cannot be claimed. | Export functionality does not confer new storage/redistribution rights. | Manual or automated Docked use needs clarification; not a CSV workaround for restrictions. |
| ESPN match box scores / public JSON | [Disney Australia/NZ terms](https://disneytermsofuse.com/australia-newzealand/) explicitly restrict business-related use (including not-for-profit) and automated extraction without written permission. | No undocumented endpoint used as an authorised feed; complete Docked field equivalence not verified. | No ongoing storage/derived-use permission inferred. | Not selected for automation. |

### nflverse rights: precise uncertainty

CC BY 4.0 allows reuse/adaptation, including commercial use, for rights the licensor can grant. It does not license trademarks/personality rights or warrant upstream title. The [nflverse package site](https://nflverse.nflverse.com/) also refers to data owners' terms. A [public licensing question](https://github.com/nflverse/nflverse-data/issues/101) about these weekly files was closed without a substantive clarification visible in the inspected page. That issue is **not** an authoritative prohibition or permission.

Record the repo licence as positive reuse evidence. Keep the unresolved question narrowly scoped: whether these specific basic weekly/PBP statistical datasets carry additional source-specific restrictions for an Australian ten-person free hosted fantasy beta. Do not assert a blanket requirement to buy NFL rights. Logos, photos, video, FTN charting and paid collectible-card rights are excluded from this investigation/adapter.

Draft enquiry — **not sent**:

> Docked is preparing a free invite-only fantasy beta for one owner and up to ten Australian adults, with no payments or prizes. We propose two cached downloads daily at most from your stats_player/PBP releases, storing bounded raw revisions and derived Docked points, with nflverse attribution, CC BY 4.0 links and modification notices. Does the published data licence cover these particular numerical datasets and this use, or are any fields/source-specific terms excluded? We do not need photos, logos, video or FTN data. Please also identify the supported completion marker, return-TD categories, offensive fumble-recovery attribution and correction/finality guidance.

## Exact NFL mapping and gaps

An additional free-API check: [API-Football pricing](https://www.api-football.com/pricing/) lists $0 / 100 requests per day with season limitations; do not assume 2026/27 access without an account coverage response. Its [actual terms](https://www.api-football.com/terms) explicitly describe building fantasy applications, while also disclaiming publication licences and noting that some uses may require third-party permissions. That is a specific unresolved scope issue, not proof that every use requires a paid league licence. The public documentation page did not expose a readable schema in this tool, and no account/key was created: required-field equivalence and current-season acceptance are unverified. No raw-storage duration or correction guarantee established. Retain this as a free candidate for clarification rather than assuming a paid plan fixes the rights or field gaps.

| Docked field | nflverse source |
|---|---|
| Passing yards / TD / interceptions | `passing_yards`, `passing_tds`, `passing_interceptions` |
| Rushing yards / TD | `rushing_yards`, `rushing_tds` |
| Receptions / receiving yards / TD | `receptions`, `receiving_yards`, `receiving_tds` |
| Fumbles lost, all phases once | `fumbles_lost_total`; do not sum overlapping component counts |
| Passing / rushing / receiving two-point conversions | `passing_2pt_conversions`, `rushing_2pt_conversions`, `receiving_2pt_conversions` |
| Kickoff and punt return TD | `special_teams_tds=0` establishes both zero. Nonzero does not identify return type or other special-teams TD; pending. |
| Offensive fumble-recovery TD | `fumble_recovery_tds=0` establishes zero. Nonzero includes other recoveries; offensive attribution needed. |

Source implementation inspected: [nflfastR calculate_stats](https://github.com/nflverse/nflfastR/blob/master/R/calculate_stats.R). Combined TD categories are intentional there. No estimated split, no aggregate re-labelled as a different statistic, and no provider fantasy totals used. All missing/NA/malformed required numbers remain pending. Absence is not proof of no participation. Team observed in an old match is not a player's current team.

Current rules remain unchanged. If event evidence cannot resolve exceptional TDs, a possible **new** ruleset could omit offensive fumble-recovery TDs and explicitly define supported return-TD categories. That requires owner approval before a new competition; existing locked rules cannot change. Recommendation: resolve play attribution first, not weaken rules to fit a feed.

## EPL scoring completeness

Required unchanged rules: regulation-only and actual played seconds; goals/assists; total and penalty saves; missed penalties; yellows and straight-red/second-yellow state; own goals; goals conceded while on the pitch with reliable substitution/dismissal/goal ordering. GK/DEF/MID/FWD scoring differs. An aggregate “minutes=60” cannot resolve Docked's exact 60-regulation-minute threshold if added time is included. A team score cannot replace goals conceded during a player's actual intervals. Assist provider definitions may disagree on rebounds/deflections.

No evaluated current free source proves every field. A precise fallback rule proposal, **not implemented**, would use a specified provider's published minutes and assist convention plus a documented on-pitch concession policy for new rounds. Approval would require naming that permitted source and reviewing examples around 59/60 minutes, stoppage-time substitutions, second yellows and rebounds. Do not ask the owner to approve an undefined “simpler scoring” policy.

## Importer, timing and corrections

- `src/core/postgame-nflverse.ts`: bounded strict CSV, stable ID/team/position validation, no blank-to-zero conversion, complete/pending records for the shared scoring engine.
- `src/server/postgame-download.ts`: fixed GitHub release URL and narrowly allowed release CDN redirect; no arbitrary website fetch, credentials or cookies. 12 MB cap, 20-second timeout, content/schema/season validation, ETag/Last-Modified support.
- PostgreSQL reserves a **12-hour per-season cooldown before network**, including failures and parallel attempts. One season file serves all matches. No per-player requests. Conditional 304 reuses retained evidence; no unchanged correction revision. Current-season file was approximately 2 MB; transfer size can grow. An oversized future file fails closed pending explicit format/limit review.
- First collection at least six hours after verified completed-state observation. Prepared rechecks: +6h/+24h/+48h/+96h/+168h, coalesced by the shared cooldown. After a failure, retry at the next allowed run. Once activated, include Thursday after the documented midweek update for NFL; this is an operator scheduling requirement, not an enabled cron.
- Weekly file has no exact match-end timestamp. The current engine requires separately verified completion evidence; do not invent kickoff+three-hours as an end. No “final” merely because a CSV exists. Match completed and Docked score final are distinct states.
- Display **Awaiting results** when coverage is missing, **Provisional** when complete input is imported, **Final** only after all required results, mappings, correction period and review pass. Reconciliation never calls `finalise` automatically. A late correction uses existing reviewer/reason controls and reopens standings.
- Raw revisions are hashed, retained per approved permit and then payload-purged without changing the audit hash/history. Provider mapping is frozen and append-only. Corrections append; locked teams and previous results remain inspectable. Cached transport timestamps are not invented source-publication times.
- SQL additions are local acceptance files only; no member grants, browser mutation API or cloud scheduler was introduced. Rights permit defaults absent/disabled. A free/open licence can satisfy the intended-free-beta permission schema; purchase is not required.

## Completed-match verification

Actual downloaded match: `2026_01_ATL_PIT`, Atlanta–Pittsburgh, 13 September 2026, source final score 13–20. nflreadr's documented [schedule source](https://github.com/nflverse/nfldata) corroborates game ID/teams/date/result. This is not an independent official gamebook audit.

| Player | Manual Docked half-PPR arithmetic | Points |
|---|---|---:|
| Aaron Rodgers | 221 × .04 + 1 × 4 − 3 × .1 | 12.54 |
| Pat Freiermuth | 5 × .5 + 46 × .1 + 1 × 6 | 13.10 |
| Jaylen Warren | 46 × .1 + 5 × .5 + 27 × .1 − 1 × 2 | 7.80 |
| Bijan Robinson | 83 × .1 + 8 × .5 + 90 × .1 + 1 × 6 | 27.30 |

The remaining required source fields are explicit zero for these examples. Automated totals equal the independently written arithmetic. These are verification calculations, not Docked member results or retroactive competitions. The reduced fixture has attribution and modification notice. [Download receipt](qa/free-beta-data/postgame-real-download.json) records hash, current-season coverage and pending rows. Unit tests use a plainly synthetic completion timestamp where testing that contract; it is not an observed match-end fact.

### Companion match-play result

An actual [2026 PBP bulk download](https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv.gz) was also inspected: 4,448,255 compressed bytes, 22,746,956 expanded bytes, 11,327 plays / 65 games. Gzip SHA-256: `e7c162e793cb0f828b97c9c92bf6efd7d60ff35eb6ef9b407b8d16001fd2a39a`. Current release updated 10 October 2026 15:17:30 UTC.

For the previously ambiguous `2026_03_MIN_TB` row, game play 362 identifies GSIS `00-0040506` (Myles Price), punt return, touchdown, no fumble. All 179 structured match plays were checked; the ordinary return normalizer reconciles the one punt TD with the weekly aggregate. **Manual Docked total: 1 × 6 = 6.00**, with all other weekly scoring quantities explicitly zero. Tests reject duplicate plays, a different game, omitted scoring play and complex fumble attribution. This demonstrates a free structured route for that exception without a rule change.

Boundary: this companion normalizer is tested locally; the durable downloader/reconciler currently imports weekly files only. A separately hashed, retained and rights-reviewed PBP ingestion link must be wired before using companion facts for hosted scores. Complex lateral/fumble-return cases still require exact attribution. The final `END GAME` row has no `time_of_day`; the preceding play's time is **not** the final whistle. Exact completion evidence, or an explicitly documented conservative completion/correction-anchor policy, remains unresolved. No fabricated timestamp was substituted.

## Audited administrator CSV fallback

**Feasible, not yet an enabled admin upload feature.** Only useful after identifying permitted statistics and enough evidence for every rule. Manual entry is not permission to copy restricted data. For ten testers a whole-match CSV is preferable to one request per player, but EPL event ordering/assist reconciliation is material operator work.

Proposed process: existing owner AAL2 → select frozen beta fixture/ruleset → upload one permitted match export → validate headers, IDs, integer/range semantics and complete player coverage → preview each player's statistic/quantity/points → show missing fields and source evidence → confirm payload hash → append the source revision through the existing serialized journal. No client-supplied point totals or member self-settlement.

Required manifest: source/permission reference and review expiry; competition/game ID; source and observation timestamps; verified completion evidence; mapping version; raw SHA-256; operator/reason; correction reference. Required rows: stable player ID, position, explicit availability, and all sport-specific raw fields. EPL also needs ordered on-pitch intervals/goals or separately verified equivalent evidence. Unknown is blank/pending, never default zero. Confirmed DNP must have source evidence. Reject formulas, duplicated players, unknown fields, unmapped fixtures and quantities outside schemas.

Store permitted original bytes with bounded retention and immutable hash/audit. Repeated payload is idempotent; changed payload appends and shows differences. Final scores require independent finalisation review; after-final amendments need a reason. Exports must retain existing spreadsheet-formula escaping. This preparation does not claim a hosted CSV workflow or resolve underlying field gaps.

## Activation and remaining beta work

No payment approval is needed for the selected public download. No source was declared globally prohibited: decisions above concern the exact proposed use and available evidence.

1. Resolve the narrow NFL dataset scope question and TD/completion evidence; attach the approved permit, attribution and retention duration to the dedicated server worker. No secret needed for nflverse. No permission request has been sent.
2. Verify complete current EPL/NFL rosters separately before beta starter grants; a weekly scoring file omits inactive/no-stat players. Preserve the already-approved all-current-player policy and auditable isolated replacement process.
3. Deploy the private ingestion schema, operator wrapper/scheduler and hosted scoring read path only after acceptance; test actual future full rounds and corrections. There are no active Docked scoring deadlines. Never open an already-started round.
4. Privacy owner/operator/retention decisions are already approved. Still needed: Docked work-admin Exchange/Purview evidence of mailbox location, actual retention/holds, export/purge capability and backup schedules. `scripts/microsoft-privacy-evidence.ps1` remains ready; no tenant settings changed. This investigation does not reopen those decisions or reset accepted owner login.
5. Preserve the working owner Preview/APK and public holding page until remaining external-beta checks pass. Payments/prizes/withdrawals remain off; no invitation sent. Android rebuild is unnecessary for this server-only investigation; physical S24 and visual approval remain pending.

## Executed acceptance

Implementation commit: `4d9eade4` on `pivot/fantasy-cards-preview-v1`. Source-only rollback is a normal revert of that commit; no hosted migration, account or inventory rollback is needed because none was changed. Keep the accompanying investigation/rights record when reverting code so future work does not reinstate a paid-API assumption.

| Check | Result / boundary |
|---|---|
| Actual source access | NFL weekly and PBP bulk files downloaded; current season, IDs and sample stats inspected. OpenFootball EPL JSON downloaded: 380 fixtures/10 scored, no player fields. |
| Manual totals | Five player totals reconciled from source fields, including a real punt return. Not independently audited against an official gamebook; not an observed future/live fixture. |
| Platform tests | 238 passed. First sandbox run had eight existing temp-folder/Git permission failures; rerun with required filesystem access passed all tests, without relaxing assertions. |
| Database/RLS regression | 147 passed. Disposable/local test engines, no hosted provider acceptance. |
| Durable PostgreSQL feed tests | Existing and new suites passed; 20-way quota/lease/download/reconciliation, immutable evidence, cache/304, corrections, failed-source cooldown and ordinary-role denial. [Receipt](qa/free-beta-data/postgame-postgres.json). |
| Typecheck / lint / production build | Passed. No page or Android UI changes. |
| Browser bundle boundary | Existing checker reported canary-marker absence in 44 browser assets. This run did not inject new canary credentials; do not represent it as a full credential-export test. No provider credential is required or embedded by this download adapter. |
| Runner failure reporting | Fixed the embedded PostgreSQL runner's exit-hook masking; deliberately failed child now yields a nonzero command result. |
| Hosted / physical / visual | Not newly executed; no hosted feed deployed, no new APK. Owner login acceptance preserved. Physical S24 and owner visual approval remain pending. |

Local reproduction: `npm test`, `npm run db:test`, `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/fantasy-production-local-postgres.mjs --sports-feed`. `npx tsx scripts/postgame-inspect.ts --download` is an explicit public research download only, not an activation command; avoid repeating it more often than every 12 hours. The operator worker enforces its rate limit durably; the research CLI is not a scheduler. The `--verify-failure-exit` runner command intentionally fails to verify CI error propagation.
