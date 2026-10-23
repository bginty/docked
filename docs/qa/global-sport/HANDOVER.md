# Unified navigation, global Social and 2026 match history

23 October 2026. Production private beta release; existing account, MFA, sport admission and commercial gates retained.

## Deployed release

[docked.com.au](https://docked.com.au) now serves **ef4bd150eede212bc3555b6ed10da6b497634160**, promoted at 2026-10-23T04:42:07.483Z (23 October 2026). The main implementation checkpoint is `3c69e7f0`, presentation/access-check polish is `e2fa2872`, and final history authentication recovery is `ef4bd150`. Statistics service: `037ae79eea582b7f1ee1ce5fbf0493120e777dc4` (local implementation and imports; no new hosted ingestion schedule activated).

The shared navigation, global Social, compact disclosures and real match-history publications are **implemented, locally tested and deployed**. Existing private-beta permissions govern access. Player-level historical statistics and fantasy scoring are **blocked**, not activated.

## Implemented functionality

- One shared compact NFL / NBA / AFL / NRL selector in Play, Cards and Market. The existing session preference, cookie, local storage and draft-change guard are reused. Section links retain the chosen sport; switching updates client navigation without a document reload. Server/API sport authorization is unchanged.
- Social has no workspace sport selector. Latest and Following ignore legacy `sport` query parameters on both page and API. Following, profile privacy, blocks, moderation and community visibility remain server enforced. Existing 20-post cursor pages and 100-post retained limit are preserved.
- Communities uses the existing directory/membership/posting system, with Join/Leave and retry without a full reload. No empty production communities were seeded. Card attachments retain server-verified ownership and durable snapshots; each shared card shows its sport. Cross-sport sharing no longer inherits the Play sport.
- Composer inventory loads only when attaching cards. Community directory requests explicitly omit inventory. This removes an eager full-inventory read from ordinary feed loads; no private feed content is stored in persistent caches.
- Play and Market's detailed beta notices collapse into compact disclosures, while test inventory / credits / no cash value remain visible. Existing global disclosure remains.
- AFL/NRL real 2026 match history opens from Play and expanded player history, with team/round filters, local-time dates, 20-match pages, source links and coverage notices. It is separate from fantasy competitions.

## Historical coverage and limitations

| Sport | Matches imported and published | Regular / postseason | Teams | Player-game records | Missing kickoff |
|---|---:|---:|---:|---:|---:|
| AFL | 218 | 207 / 11 | 18 | **0** | 0 |
| NRL | 213 | 204 / 9 | 17 | **0** | 1 |

These are reviewed fixture/result publications from the separate ingestion service's existing SQLite Store/Worker, versioned with the application. They are not 431 new fantasy competitions or player-statistics records in Supabase. No entry, prize, historical score or lineup was recalculated.

AFL source: [Squiggle](https://api.squiggle.com.au/), explicit commercial API permission, identified cached server requests, no player statistics. NRL: Wikipedia contributors' revision-pinned [results](https://en.wikipedia.org/wiki/2026_NRL_season_results) and [finals](https://en.wikipedia.org/wiki/2026_NRL_finals_series), adapted under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), attribution/share-alike retained with the dataset and in the UI. No logos copied or restricted scraping performed.

Counts reconcile to published season summaries; NRL aggregate match points reconcile to 10,167. Both grand finals were spot-checked against official league reports. This is not an independent audit of every match. NRL Penrith–Newcastle semifinal sources disagree on kickoff by five minutes; time is withheld rather than guessed. Shared Magic Round venue cells were repaired before publication.

**Player statistics, player comparisons and historical fantasy scores remain blocked.** Neither imported source provides player participation or complete scoring fields. All 218 AFL and 213 NRL matches lack a verified player-statistics snapshot in this publication. Missing does not become zero/DNP. No player identity reconciliation is claimed for nonexistent records.

AFL needs complete player IDs/participation and kicks, handballs, marks, tackles, goals, behinds, hitouts and both free-kick fields. NRL needs complete tries/assists/goals/metres/breaks/tackles/offload outcomes/errors/kicks/disciplinary inputs from its existing adapter contract. Licensed Champion Data / other commercial player feeds require rights and credentials. FootyLedger CC BY-NC is unsuitable; paid alternatives require owner purchase approval and intended-use permission. Existing AFL/NRL scoring remains provisional; NFL and NBA formulas/multipliers are untouched.

See [dataset provenance](../../../config/history/README.md) and the statistics repo's `docs/2026-historical-results.md` for sources, exact commands, limitations and licence requirements. Statistics-service checkpoint: **037ae79**.

## Verification

- 607 platform tests passed.
- 212 database tests passed: all migrations in isolated PGlite; authorization, ownership, cards, wallets, scoring, corrections and NFL regressions. PGlite concurrency is serialized, not hosted multi-connection load testing.
- 112 statistics-service tests passed, including replay/correction/parser cases and NFL isolation. Local runtime Python 3.11 with Windows tzdata; declared hosted Python >=3.12 was not exercised.
- TypeScript, ESLint, clean production build and client secret-canary scan passed.
- Isolated real-component browser checks at 412×915 (4× CPU slowdown) and 1440×915: shared selector, persistent sport, no document reload, global posts, Following, deferred attachment inventory, community join/leave, composer navigation, history filters/pagination, no overflow or JS errors.
- Screenshots: [navigation mobile](navigation-412.png), [Social mobile](social-412.png), [AFL history](afl-history-412.png), [NRL history desktop](nrl-history-1440.png). These are explicitly isolated fixture screenshots, not signed-in Production.

History pages became usable in 889–1,131 ms on the throttled local mobile fixture and 230–246 ms desktop. These exclude mobile network and hosted authorization latency. API responses contain at most 20 matches, never full seasons. There is no comparable pre-change history page, so no invented before/after speed-up is claimed. The feed improvement is the measured removal of the initial inventory request. See `validation.json` for payload sizes and `browser.json` for request evidence.

## Release safety and remaining acceptance

No database migration, new index, financial write, schedule activation or expanded feature flag is required. A read-only application recovery snapshot was saved privately and read back; it is not a full Auth/Storage backup and disaster restoration was not tested. Before/after record fingerprints cover wallets, cards, ownership events, packs, competitions, entries/results, sales, sport inventory and NFL control.

The release recipe captures the exact prior deployment for rollback and stages a production candidate without moving the domain. Rollback promotes that captured application; versioned match publications roll back with it. Source corrections require reviewed re-import/release; automatic postgame/player jobs remain disabled for these sources.

No signed-in browser session was available in the browser inventory, and opening a live browser tab failed to attach. Production checks therefore cover release identity, closed registration, signed-out API denial and browser access recovery only. Owner/Barry/Luke/Brenton signed-in feed/gameplay acceptance remains explicitly unverified. No account, email confirmation or MFA control was bypassed.

The initial protected candidate and live domain passed all **26 HTTP checks**: release identity, closed registration, private API denials and structured signed-out Social responses with no posts, profiles or viewer exposed. Browser verification then caught a history-page recovery defect: `requireIdentity()` rejected signed-out access correctly but its exception reached the generic page error instead of the sign-in/MFA recovery screen. The route now uses the same bounded authentication and `FantasyLoadError` handling as Cards and Market. Candidate HTTP checks now assert rendered sign-in recovery on both history routes. The initial failure and release receipts are preserved under `release/initial-e2fa2872/`.

The read-only before/after fingerprints are **identical across all 10 monitored tables**, including wallet state, cards, ownership events, entries, results, packs, sales, sport inventory and NFL control. No database migration or data write was performed by this release. See [preservation evidence](release/preservation-after.json), [deployment receipt](release/deployment-promoted.json) and [rollback target](release/rollback.json).

Owned-collection regression also passed all 11 browser check groups across four sports, including pagination, filters, flips, pack navigation and ownership cache invalidation. These are isolated fixture checks.

## Remaining external decisions and acceptance

- Supply an authorised AFL and NRL player-statistics feed with the required event fields, stable player IDs, participation evidence and written rights for commercial display, retention and derived fantasy scores. No new subscription was purchased.
- Approve final AFL/NRL scoring contracts before publishing official historical fantasy scores. Existing provisional testing rules were preserved.
- Resolve the one NRL semifinal kickoff conflict from an authoritative source before assigning a precise timestamp.
- Complete a real invited-member browser acceptance session for sport switching, global Following/communities and historical results. Existing account confirmation and MFA requirements must remain in force.

Final release verification: **26 live HTTP checks and 12 signed-out browser route/viewport checks passed** against the final commit. Mobile 412×915 and desktop 1440×915 both render access recovery without private content, horizontal overflow or page JavaScript errors. The history correction also passed eight targeted regressions, typecheck, targeted lint and the Vercel production build. [Hosted browser evidence](release/hosted-browser.json). This does not establish signed-in acceptance.
