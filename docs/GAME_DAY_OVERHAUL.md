# Game-day implementation and acceptance — 20 October 2026

## Confirmed incident

Read-only production investigation found Week 6 source files already retained:
6,417 weekly records and 14,031 play-by-play records, both reaching Week 6.
However, completion evidence stopped at Week 5 and the Week 6 competition
journals contained no source snapshots. The collector log explicitly reported
`CPU Time exceeded` at `2026-10-19T12:10:06.229Z`. Several runs never recorded
completion. The Edge process could terminate after persisting raw data but before
observing END_GAME evidence. Source cooldowns and the additional six-hour
reconciliation delay compounded this failure.

Separately, the member read path exposed only complete team totals even though
the scoring journal already retained authoritative known partial totals.
Neither missing source records nor missing totals have been replaced with zeros.

## Changes

- A separate authenticated game-day read model exposes saved full/partial totals,
  completed-player counts, source freshness and fixture statuses. Provisional
  ranks derive server-side from persisted totals, with tied points sharing rank.
  Final ranks and journals are untouched.
- Play and Rankings use compact score/completion/rank summaries. Player scores
  appear beside canonical cards. Team details reuse the existing field/card
  layout, with scoring breakdowns in a disclosure.
- Scores refresh every 30 seconds while visible and on focus/resume. Overlapping
  refreshes are suppressed; a network failure retains the last result and offers
  retry. Refreshing never submits a lineup or recalculates points in the browser.
- The strict CSV parser avoids character-by-character string construction and
  materializing unused columns. Local synthetic parsing of an identical 36.8 MB
  source improved from 2,232 ms to 1,198 ms; this is not hosted CPU evidence.
- Reconciliation can recover completion observations from retained raw data
  after an interrupted collector. The artificial six-hour wait is removed;
  correction/finalization protections remain. Round checks are eligible every
  15 minutes.
- A disabled-by-default Node collector endpoint provides a migration path away
  from the Edge CPU limit, reusing the restricted worker and existing import
  validation. It cannot run in Preview.
- Owner operations show source checks, completion observations, interrupted jobs,
  round fixture evidence and reconciliation issues. This is diagnostic access,
  protected by the existing owner, active-session and MFA checks.

## Integrity and visibility

Current competitions use rolling player locks. New entries close at first
kickoff, but player replacements can remain editable afterward. The requested
first-kickoff full-lineup reveal therefore needs a rule decision. Owner approval
has been requested for new, unentered future rounds; no response was available
when this implementation was prepared.

No lock model or publication approval was changed. Opponent lineups remain
subject to the existing publication approval, admission, privacy and complete
slot-lock checks. Production currently has zero lineup-publication policy
records. Consequently, this Preview does **not** enable opponent viewing in
production simply by passing the first kickoff. Isolated tests cover visibility
with an approved policy after every selection locks and privacy beforehand.
Future drafts are not exposed.

Week 6's frozen scoring differs from Week 7's newer scoring configuration.
This task preserves both, along with multipliers, salaries, historical entries
and finalized results. No historical scoring migration was performed.

The additive read-model migration is
`20261020040346_game_day_read_models.sql`; the hosted migration receipt is
`20261020042019`, name `game_day_read_models`. It creates separate RPCs and
does not replace the live `play_standings()` function. Grants were checked:
only the existing restricted application role can execute them, and the
functions independently enforce session/member or owner/MFA authorization.
Security advisor findings were unchanged.

## Feed limitations and DNP

The configured nflverse import is postgame, not a licensed play-by-play live
fantasy service. The UI says Postgame scoring. Existing source request limits
(including the 12-hour cooldown) are preserved; this work does not promise
immediate provider-publication ingestion.

An explicit confirmed-DNP record produces zero points and counts as completed
once its game source is complete. A verified statistical zero also remains zero.
An absent player record does not prove DNP: it remains unresolved and does not
count as completed. Automatic DNP derivation from absence is deliberately absent.

## Collector activation runbook — not yet executed

The protected Preview does not activate the collector or mutate live scoring.
The live Edge scheduler is still the previous deployment. Do not claim the
production incident is resolved until the replacement completes real imports.

For a separately approved production deployment:

1. Deploy this reviewed application revision to production using existing
   release controls. Preview requests to the collector remain rejected.
2. Configure production-only `DOCKED_NFL_NODE_WORKER_ENABLED=true`,
   `DOCKED_NFL_WORKER_TOKEN` (a newly generated strong random secret), and
   `DOCKED_NFL_WORKER_DATABASE_URL` using the existing least-privileged
   `docked_nfl_worker` role and approved production Supabase pooler. Do not use a
   service-role key, owner database role or browser-exposed environment variable.
3. Repoint the existing authenticated scheduler from the Edge collector to
   `POST https://docked.com.au/api/scoring/collect?task=weekly`, `pbp`, `rosters`
   or `reconcile` respectively. Send the secret in `x-docked-worker`. Keep it
   in the existing private scheduler secret store. Retain permitted source
   fetch cadence; use reconciliation every 15 minutes. One invocation leases
   one due round, so multiple rounds can take successive invocations.
4. Pause the old Edge schedule when enabling the replacement to avoid competing
   jobs. Do not remove retained raw revisions, journals or audit history.
5. Verify successful finished runs, Week 6 END_GAME observations, mappings,
   imported snapshots and the resulting saved totals. Retry uses the existing
   revision/idempotency controls. Finalized corrections still require the
   existing reviewer process.
6. Verify two admitted test devices observe the same saved totals and provisional
   rank after a refresh. Do not use real member purchases or notifications.

This route is implemented, built and boundary-checked. Hosted Node ingestion,
scheduler handoff and end-to-end production score recovery remain unverified.

## Verification

- Platform suite: 511 passed.
- Isolated PostgreSQL/database suite: 189 passed.
- New read-model tests cover full scores, explicit DNP zero, unresolved players,
  completed counts, owner diagnostic denial and existing lock/privacy controls.
- Existing scoring tests cover repeat imports, corrections, late changes and
  finalized-result protection.
- Typecheck, lint and production build passed.
- A build with fake credential canaries passed the client-boundary scan across
  69 browser assets, including the new worker-secret marker.
- Browser fixtures cover 360, 412, 1024 and 1440 pixel widths, field/team views,
  score refresh, retained scores after a failed refresh, keyboard controls,
  Android-style Back dismissal and automated accessibility checks.
- Browser tests use isolated records and simulated server responses. They do
  not prove hosted source ingestion, real-device performance or live account
  acceptance. Samsung-sized emulation is not a physical Samsung device test.

Evidence is in `docs/qa/game-day/`. `before-*` images are actual renders from the
prior isolated UI fixture, not screenshots of another member's private account.
`game-day-play-*`, `weekly-*`, and `community-team-*` show the revised UI.
`browser.json` and `parser-performance.json` record automated results.

## Remaining acceptance gates

Owner lock/publication decision; production collector activation and measured
successful source-to-score recovery; authenticated protected Preview acceptance;
physical Android/device testing. No live promotion is included in this task.
