# NFL postgame testing integration

## Scope and activation

Implemented for isolated local testing. Nothing in this change activates production ingestion, changes existing competitions, awards historical member points, or changes accounts, cards, ownership, balances or recorded teams. The external ingestion service remains separate. Docked consumes raw statistics and calculates points through its existing scoring engine and journal.

`/admin/nfl-testing` uses the existing server-side owner role and AAL2/MFA check. It displays player history, weekly totals, observed season totals, trends, freshness, incomplete games, mapping coverage and pending reconciliation. The route has an explicit production prohibition and requires a dedicated local testing database. It is not a public/member statistics endpoint.

## Verified service behaviour

At verification, `127.0.0.1:8080` was not serving the API. Rather than treating the handover as proof, the local acceptance harness made a read-only SQLite backup of the separate service's saved database and started that service's actual API implementation on an ephemeral loopback port, without its download worker. Random temporary reader/admin credentials stayed in server processes. The original database hash was unchanged.

The authenticated API returned 272 scheduled games, including **80 imported final games: 74 available and 6 incomplete**, and **5,569 current player-game records**. The other 192 games were not started. Unauthenticated reads and reader-key access to the admin endpoint both returned 401. These are observed API results, not evidence that a persistent hosted connection exists.

The six incomplete games remain a source-data problem. Their anonymous rows were not guessed, assigned to known players, or filled with zero. Complete known player records can support explicitly labelled player-performance history, but incomplete game coverage blocks settlement of affected competition results.

Evidence: `docs/qa/nfl-testing/real-api-verification.json`, `real-game-journal.json`, `resync.json`, `scoring-configuration.json`, and the browser screenshots/report in that directory.

## Separate scoring version

Version: **`docked-nfl-postgame-full-ppr-test-v1`**. Points use the engine's integer centipoint arithmetic and two-decimal presentation.

| Statistic                      |                          Points |
| ------------------------------ | ------------------------------: |
| Passing yards                  |                   0.04 per yard |
| Passing touchdown              |                               4 |
| Interception thrown            |                              -2 |
| Passing two-point conversion   |                               2 |
| Rushing yards                  |                    0.1 per yard |
| Rushing touchdown              |                               6 |
| Rushing two-point conversion   |                               2 |
| Receiving yards                |                    0.1 per yard |
| Reception                      |                               1 |
| Receiving touchdown            |                               6 |
| Receiving two-point conversion |                               2 |
| Fumbles lost                   | -2, once per responsible player |

`src/core/scoring-v1.ts` already explicitly documents the -2 fumble penalty, including all phases once. No owner decision is outstanding for that penalty.

Differences from the existing NFL v1: receptions rise from 0.5 to 1 **only in the new test version**. Existing kickoff-return, punt-return and offensive fumble-recovery touchdowns are enabled +6 rules, not just schema fields. They are outside the requested new testing configuration. Their absence does not block this test version; existing versions still require their fields. No existing ruleset ID, catalogue default, formation, multiplier, entry, finalisation policy or historical result was edited.

## Identity and fixture mapping

Canonical IDs are opaque and scoped to the service dataset UUID. The review helper joins verified provider IDs to an explicitly supplied Docked catalogue. It rejects duplicate provider identities, ambiguous matches and position conflicts; names are never a join key. Reviewed mappings include evidence, reviewer and timestamp. Conflicting assignments are quarantined rather than overwritten.

The final real-API proof used a **read-only export of 498 existing Docked NFL player identities** from `sports_feed.nfl_players` joined to `beta_fantasy.players`. These permanent UUIDs are also preserved by the existing economy catalogue migration. **433 matched** verified feed identities exactly; **56 had no verified feed identity and 9 had a position conflict**, so all 65 remained quarantined. No name matching or assignment changes were performed. The reviewed mappings were written **only to the disposable local database**, not to production. `docs/qa/nfl-testing/mapping-review.json` records the exact outcomes and dated roster evidence. Earlier fixture-only checks used 497 disposable identities; those are not the final catalogue acceptance evidence.

Fixture mappings explicitly record dataset, canonical game, frozen test stream/fixture, season, REG/POST and NFL week. The reconciler checks all of them. It only accepts `beta-real:qa:feed:*` streams with the new test rules, without member inventory or rolling-lineup configuration. An absent mapping remains visible as unresolved work. No current ownership lookup is used to construct an historical entry.

## Import, corrections and failure recovery

- Server-only bearer authentication; origin allowlist; HTTPS outside loopback; redirects prohibited; bounded requests/retries and Retry-After handling; no secrets in browser/APK code or logs.
- Raw change pages, revisions, tombstones, outbox work and cursor checkpoints commit together. A failed page rolls back. A database lease prevents concurrent import/reconciliation workers.
- Repeated revisions are ignored; contradictory content at the same revision is rejected. Older revisions cannot resurrect deleted records. Metadata changes also queue reconciliation.
- An interrupted initial import resumes its saved pending generation. Normal incremental imports resume the committed cursor. HTTP 410/dataset epoch changes require explicit `--resync` and reviewed dataset-scoped mappings.
- Explicit resync builds a new generation, retaining the old published generation until raw pages and metadata succeed. Old generations remain available for audit; no automatic destructive cleanup occurs. An interrupted explicit resync can be restarted as another fresh generation.
- Whole frozen fixtures are recalculated through `SportsFeedStore.change` and `importStatistics`. Semantic comparison prevents unchanged polling from generating scoring revisions. Raw provenance and the original completion-observation timestamp are preserved.
- Late/finalised corrections retain the existing reviewer/reason gate. A correction cannot silently rewrite a settled result. Pending review remains durable in the outbox. Player-performance history can reflect current raw statistics independently of that approval.
- Missing required fields, non-current fields, stale game metadata and identity/season/week mismatches remain incomplete. Known zero is distinct from unavailable. An absent appearance is not fabricated as DNP. Removed observations leave current history and totals.
- A metadata failure prevents further competition reconciliation. The owner report retains last-known points explicitly but excludes them from current totals. Report queries use a consistent read-only database snapshot; an active import is labelled as in progress.
- Season subtotals include only available observations, separately by season and season type. They are labelled observed coverage, not proof that every possible appearance exists.

## Local commands

All commands run from the Docked repository. Do not use a production environment file.

Self-contained proof against the installed separate service and its existing SQLite data:

```powershell
node --import tsx scripts/nfl-testing-local.ts --python=C:/Users/61412/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe
node --import tsx scripts/nfl-testing-browser.ts
```

The first command creates a new disposable PGlite consumer under `tmp/nfl-testing-*`, a source snapshot, a recorded seven-card test lineup and proof artifacts. It never downloads new source data, purchases packs, creates real entries or calls a hosted Docked database. The second renders the actual owner panel with the imported report; empty/stale variants are clearly isolated fixtures. It is not authenticated hosted-browser or physical-Samsung acceptance.

For the final verification, the first command also received `--catalogue=tmp/nfl-testing-catalogue-review.json`, an independently obtained read-only identity export. Without that option it uses clearly isolated fixture identities. The export is local evidence, not a credential, and is not committed. The production connection was used solely for read-only schema/identity queries; no hosted SQL writes or migrations occurred.

For an operator-managed standalone local PostgreSQL consumer, securely set server environment values (never `NEXT_PUBLIC_*`):

| Variable                       | Requirement                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| `DOCKED_NFL_TEST_COLLECTOR`    | `standalone-postgame`                                            |
| `DOCKED_NFL_TEST_DATABASE_URL` | Dedicated loopback PostgreSQL database named `docked_nfl_test_*` |
| `NFL_BASE_URL`                 | Actual separate API origin                                       |
| `NFL_ALLOWED_ORIGINS`          | Exact comma-separated approved origins                           |
| `NFL_API_KEY`                  | Reader credential, at least 24 characters; server secret only    |

```powershell
node --import tsx scripts/nfl-testing-sync.ts --initialize --mappings=path/to/reviewed-mappings.json
```

`--initialize` installs only the private test schema and the existing isolated scoring-journal schema if absent. Existing member streams or queued/leased old collector jobs cause cutover refusal. The mappings file contains `dataset`, `reviewer`, and `players` with `canonical`, existing `docked`, `position`, and evidence containing `identitySource`, `verifiedIdentity`, `verifiedAt`. The script does not invent frozen periods or fixture mappings; use reviewed isolated QA periods and fixture associations. The reproducible real-game proof demonstrates this setup without creating real entries.

The existing `config/nfl-postgame-permit.json` is still checked for scope and expiry. It is testing permission, not a new claim of commercial licensing. No scheduler was activated. A local operator may rerun the idempotent command after a missed run; a future scheduler must use the same single consumer and dedicated database.

## Schema and rollback

Prepared migration: `supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql`. Applied only to disposable local PGlite databases in this verification. It creates the private `nfl_test_feed` schema, enables RLS on every table, revokes public access and grants no member/runtime bypass. It does not touch public/member assets, wallet tables or existing competition records.

To stop testing, disable the local collector configuration and stop its local process. Preserve the test database and generations for evidence. Production's collector and rules were never switched. Do not run a broad reset, migration push or schema drop against a hosted project. Any future hosted rollout needs a separately reviewed scoped-role/grant migration and rollback plan.

## Hosting blockers and next activation requirements

Hosted Docked cannot reach this Windows machine by using `localhost:8080`; localhost would refer to the hosted runtime itself. No public tunnel, inbound exposure or hosting purchase was created.

Before Preview can import: provide an owner-approved reachable HTTPS service deployment, server-side reader secret and network allowlist; bind Docked to an isolated test database; review permanent Docked/player and frozen fixture mappings; validate source rights/retention; and rerun API, epoch-recovery, authorisation and scoring checks there. The current database connection guard deliberately rejects non-loopback/production activation. Changing that guard requires an explicit reviewed isolated-host binding, not replacing a URL with the production database.

The six anonymous source rows still require source-owner identity resolution. The 65 unmatched/conflicting Docked catalogue identities remain unassigned until reliable evidence resolves them. No owner scoring decision is currently needed. Production ingestion and production deployment remain disabled.

## Verification record

Real API: Carson Wentz week 2 = **6.32** (143 passing yards × .04 + 6 rushing yards × .1); week 1 = **19.22**; observed season subtotal = **25.54**. All 12 raw scoring fields reconciled across game, weekly and season API responses.

The final isolated recorded seven-card lineup, using verified existing Docked identities from an actual imported game, scored **33.64** through the existing journal. Duplicate import created no journal revision. A labelled synthetic local correction of one additional reception changed it to **34.64** and that player's season subtotal by **1.00**, without changing the frozen entry. Explicit resync restored both the observed season totals and the journal's **33.64** result. The earlier fixture-identity lineup scored 60.06; its different player selection explains that earlier value.

Automated test and screenshot results, including corrected failures and remaining limitations, are recorded alongside `docs/qa/nfl-testing`. No production, hosted authenticated browser, Android APK or physical-device testing is claimed by these local artifacts.
