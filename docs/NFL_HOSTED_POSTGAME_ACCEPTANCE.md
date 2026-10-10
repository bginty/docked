# NFL post-game hosted continuation — 11 October 2026

This supersedes the unconnected-NFL findings in ZERO_COST_POSTGAME_DATA and FREE_BETA_DATA_HANDOVER. No broad provider investigation was repeated. Branch: `pivot/fantasy-cards-preview-v1`. The verified remote is `https://github.com/bginty/docked.git`; the existing five local commits through `c9630a7f`, including `4d9eade4` and `0a27f9be`, were pushed normally after fetching and confirming no remote-only work.

## Working on the isolated hosted backend

Exact Docked Supabase project `pojoymtniryarxxunyvz`, Sydney; migration `nfl_postgame_isolated_feed`. All additions are private `sports_feed` records. No production/beta card holdings, editions, supply caps, ownership history, authentication settings or admission flags changed. Before/after fingerprints passed.

Actual downloads, not API samples: 4,517 weekly player/game rows, 11,327 play-by-play rows and 3,033 roster rows. Each dataset has its own original download SHA256, projected-payload hash, revision, conditional cache and source modification timestamp. Only needed structured columns are stored: no play descriptions, odds, photos or logos. Raw payload retention is 30 days; expiry preserves hashes/provenance. The permit expires 10 November 2026 UTC and is restricted to isolated free beta. The repository licence supplies affirmative reuse evidence; it is not a paid-card/imagery licence or warranty of upstream rights.

`/fantasy/results` and `/api/fantasy/results` read the persisted journal through a narrow database function. Current owner-only admission and owner AAL2 remain enforced. Ordinary members will not acquire an MFA requirement from this read function when authorised admission is opened. Member streams require explicit membership and return only that member's lineup; internal member IDs and raw payloads are not returned. Historical QA streams are owner/AAL2 only. Runtime direct-table reads/writes, another identity and owner AAL1 were rejected on the real hosted backend.

The historical `2026_01_ATL_PIT` acceptance lineup is explicitly created **after** the game with current audit timestamps. It creates no retrospective member competition, owned cards, awards or earnings. Total: **71.24 points**, provisional. Rodgers 12.54; Warren 7.80; Bijan Robinson 27.30; Metcalf 6.00; London 4.50; Freiermuth 13.10; Pitts 0.00 (explicit complete source statistics, not a missing-data fallback). Stored player breakdowns reconcile to the total. A repeated import makes no duplicate scoring revision.

Hosted synthetic correction verification adds one passing yard inside a transaction that **always rolls back**: the calculated total increases by 0.04; the member read function returns the new breakdown/revision; the prior source and locked lineup remain unchanged; rollback restores the exact original journal. This is hosted correction-path verification, **not an observed nflverse correction**. Real future corrections append through the same path. Local PostgreSQL additionally tests concurrency and failure rollback.

## Completion, collection and finalisation

PBP must have a non-deleted last play explicitly marked `play_type_nfl=END_GAME`, matching game/teams, quarter and scores. A score, elapsed kickoff time, `END_QUARTER`, or disappearance does not establish completion. Docked records the first time it observes this marker, immutably; actual `endedAt` remains null. ATL/PIT first observation: `2026-10-10T23:28:43.346Z` / 11 October 10:28:43 Sydney.

Genuine member scoring collection is blocked until first observation + **six hours**, not a guessed final whistle. Already-completed historical QA has a visibly separate replay exception; it must use the `beta-real:qa:` namespace. Bulk files may be downloaded to discover completion before individual games become scoring-eligible. A game lacking a valid marker remains pending.

Completion does not finalise points. Existing NFL 96-hour correction window now accepts the first observed completion as its conservative anchor if no actual end instant exists. Finalisation still requires complete data and reviewer action. Late corrections require reviewer/reason and reopen finalisation. First-observation time cannot be changed by a subsequent scoring revision.

Recommended operational schedule: at most one fetch per dataset per 12 hours (failed fetches also consume the slot), evaluate registered games at observation +6h, then +24h/+48h/+96h/+168h using refreshed evidence; later source changes still require reconciliation. Cached source verification older than 24h is rejected. Conditional requests reduce traffic. Missed exact check times run on the next available worker tick; no promise of real-time updates. Scheduled invocation has **not** been activated. The implemented hosted ingestion is operator-run via `node --import tsx scripts/nfl-postgame-hosted.mjs --ingest-and-verify`; repeated acceptance runs respect the cache. Do not use its historical lineup helper to create genuine competitions.

## Touchdowns and rosters

Ordinary kickoff/punt TDs must reconcile to `special_teams_tds`. Recovery TDs reconcile separately to `fumble_recovery_tds`; a directly attributed offensive recovery earns six once. Defensive recovery events do not receive offensive recovery points. Overlapping passing/rushing classification, multiple recoveries, lateral/complex special-teams evidence or aggregate disagreement stay pending. Lost fumbles use `fumbles_lost_total` once.

The separately downloaded season roster spans all **32 teams**, with 946 mapped QB/RB/WR/TE rows across source statuses (this is **not** a count of active eligible players). All four positions occur for every team. One supported-position row, **Al-Jay Henderson, NYJ, RB, DEV**, lacks a GSIS ID; do not infer or invent one. CUT/RET/TRD records are not proof of a current roster assignment. Current admission/allocation must use reviewed source status and freshness, not historical weekly teams. Missing weekly statistics never establish inactive/DNP. Full roster data and position coverage are available, but roster-to-beta-edition replacement grants have **not** been executed. Existing fictional holdings are untouched.

## Licence and attribution

[nflverse data LICENSE.md](https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md) publishes **Creative Commons Attribution 4.0 International**. The official [nflreadr PBP](https://nflreadr.nflverse.com/reference/load_pbp.html) and [roster](https://nflreadr.nflverse.com/reference/load_rosters.html) loaders document automated bulk access. Attribution on the results screen: nflverse contributors, source link, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and notice that Docked selects/normalises statistics and calculates its own scores. No endorsement is implied. CC BY allows sharing/adaptation within the rights licensed; it does not guarantee all upstream rights or grant personality/trademark/photo rights. No FTN-only fields are used.

Narrow unsent enquiry, if clarification is desired before external use:

> We use the nflverse-data CC BY 4.0 weekly player statistics, standard PBP and season rosters (GSIS IDs, names, team/position, required basic statistics; no photos/logos, FTN data or provider fantasy totals). This is an invite-only, free Australian fantasy beta with at most ten adults, no purchases, prizes or wagering. We retain selected raw fields for 30 days and minimally identifying scoring/provenance records under our beta retention policy, with nflverse/CC BY attribution and a modification notice. Are any fields in these three specific releases subject to an additional source-specific restriction not reflected in the repository licence? Please identify the affected fields/source and required notice or condition.

This question does not erase the published licence or assert blanket permission for unrelated commercial products. Nothing has been sent.

## EPL: smallest remaining practical step

**Create an API-Football direct free account**, no card required: [pricing/account link](https://www.api-football.com/pricing). Current official price **$0/month, 100 requests/day**; all endpoints are listed, but **free seasons are restricted**. No account or subscription was created. This is a low-cost field/coverage test, not a claim that all Docked rules are supported.

In that account, check EPL league 39 / season 2026 coverage. Keep the API key in an operator/server secret named `API_FOOTBALL_KEY`, or an ignored local operator environment file; never `NEXT_PUBLIC_*`, APK, Git or chat. It does not belong in the member-facing browser. First calls: `GET /status`; `GET /leagues?id=39&season=2026`; one completed permitted fixture's `/fixtures/players`, `/fixtures/events` and `/fixtures/lineups`, all on `https://v3.football.api-sports.io` with `x-apisports-key`. Reserve five requests; no repeated polling. Do not fetch if account terms do not cover the intended test/storage.

The precise field question remains: current Docked EPL rules need regulation-only seconds, actual on-pitch intervals and event ordering for conceded-goal attribution, dismissal semantics, and matching assist/penalty-save definitions. Rounded player minutes plus event minute/extra fields do not establish exact boundary ordering by themselves. If the free payload lacks those, present a **new** minute-based ruleset proposal for owner approval; no current or locked rule is changed. No paid plan is recommended as a guaranteed fix, and no manual CSV import is proposed without a suitable underlying source.

Unsent API-Football enquiry:

> For EPL 2026/27 on the free account, can we use/store basic player identities and completed-match statistics for an invite-only free ten-person fantasy beta, without imagery or paid card sales? Which fields provide regulation-only time and deterministic ordering when substitutions, dismissals and goals share a minute? Please confirm assist and penalty-save semantics, correction availability, retention/attribution requirements and whether this season is available free. If not, specify the smallest plan and billing currency; no subscription is authorised.

## Microsoft evidence and shared external gates

Support/moderation operator/process, all-current beta eligibility and conditional retention commitments are **already approved**. They are not questions to repeat.

This run found no installed/connected ExchangeOnlineManagement session. The in-app browser had no existing tabs; `admin.microsoft.com` reached a Microsoft authentication redirect, and no usable administrator view was obtained. No tenant settings, consents or permissions changed. Exact remaining evidence:

1. Docked work administrator → **Microsoft 365 admin centre → Settings → Org settings → Organization profile → Data location → Commitments**: Exchange Online at-rest region/date. This alone does not establish all processing locations.
2. In a connected Exchange Online administrator session for tenant `b34880d6-d28e-40c2-b389-232506c69650`, run `scripts/microsoft-privacy-evidence.ps1`. It reads `support@docked.com.au` retention policy/tags, deleted-item retention, recovery, mailbox and organisation holds. Return its non-secret output.
3. **Microsoft Purview → Solutions → Data Lifecycle Management → Microsoft 365 → Retention policies**, plus **Records Management** labels and **eDiscovery** case holds: applied mailbox scope, retain/delete durations/actions, policy mode/status and hold IDs. Record existing export roles/formats and supported deletion/recoverable-item behaviour using an existing synthetic case. No real-message purge requested.
4. Verify Supabase/Vercel log/backup expiry against the approved schedule before publishing absolute deletion promises.

NFL can be staged independently of EPL, but external NFL testing is **not ready solely because this ingestion passed**. Remaining implementation/activation work: reviewed current-roster catalogue and isolated replacement grants; mapping genuine future full-round fixtures and locked member entries into scoring streams; a deployed scheduled worker and expiry maintenance; one real round/DNP/correction operational observation; shared privacy/admission/two-member checks and external domain/APK release. These are distinct from a missing NFL paid API. NFL-only release requires the owner's explicit choice and has not been activated. Both-sport work remains the default.

## Verification and recovery

Executed: typecheck and lint pass; 250/250 platform tests; 147/147 database/RLS tests; 16/16 targeted post-game/scoring tests; disposable PostgreSQL concurrency/access/retention/correction checks; production web build; dependency audit reports zero production advisories; known-secret scan 427 deployable files, zero findings. Initial sandbox-only filesystem failures were rerun successfully with normal permissions. One pre-existing test still expected the now-approved Premium mapping/selection method to be unset; its assertions now preserve the owner's approved RARE/random-pool decision and still assert live charges off.

Hourly `docked-beta-nfl-raw-expiry` is installed in the existing pg_cron extension, scoped only to expired `nflverse` raw bodies. Payloads expire after 30 days and are removed by the next hourly run; hashes and scoring history remain. This cleanup job is independent of ingestion. Unattended source fetching/competition operation is not activated.

Evidence: `docs/qa/postgame/hosted-ingestion.json`, `hosted-correction-rollback.json`, `visual.json`; mobile/desktop screenshots in the same folder. Local component rendering uses the actual hosted read model but is **not authenticated hosted-browser acceptance**. No physical S24 or owner visual approval claimed.

Supabase advisor returned informational RLS-with-no-policy notices for the intentionally closed private tables; access is through checked functions, not permissive table policies. The existing leaked-password-protection warning remains; no authentication policy or paid plan changed. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Rollback: point the protected Preview back to its preceding deployment; stop operator invocation. Leave additive append-only evidence and grants in place, or revoke the single read-function execute grant if necessary. Do not drop records, restore a whole database over newer holdings, or run a destructive down migration. The production holding page is untouched. Payments, prizes, withdrawals, retired odds workflows and external admission remain disabled.
