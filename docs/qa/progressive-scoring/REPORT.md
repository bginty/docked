# NFL progressive scoring release — 25 October 2026

## Cause and Production data

Week 7 was not blank merely because the week was unfinished. Both seven-player competitions had empty scoring sources at journal revision 2. The scheduled importer rejected the completed New England–Chicago game because its 70-row weekly source contained one row with no player identifier, name or position. Historical card statistics were a separate read model and did not prove an imported Week 7 contribution.

The retained weekly source and explicit completed-game play-by-play evidence were inspected read-only. After validation, 21 mapped players had complete scoring inputs; nine mapped players remained unresolved. The unattributed row is quarantined with an operational diagnostic, not assigned to a player. Named malformed identities, duplicate identities and mismatched game/season rows still fail validation.

Production reconciliation now has revision 3 for both Week 7 competitions. The scored All-Star entry has 30.97 points, rank 1 and 1/7 completed. Its Caleb Williams contribution is 22.12 base × the locked Legendary multiplier 1.4, rounded by the existing centipoint rule to 30.97. The scored Traditional entry has 2.86 points (2.60 × locked Rare 1.1), rank 1 and 1/7 completed. The other entry in each competition has no available contribution and remains unranked/awaiting statistics. These are real retained Production source records, not test scores.

## Implementation

- Preserve the approved NFL base formula, exact integer arithmetic and frozen card rarity. Valid available contributions sum progressively; absent statistics do not become zero.
- Allow validated provisional NFL contributions in the engine without marking their players completed. The collector still publishes postgame data, not in-game play-by-play.
- Remove missing-row-to-assumed-zero conversion for open imports. Confirmed DNP and verified bye semantics remain explicit. Existing finalised journal values remain frozen.
- Rank available NFL totals progressively using the existing shared-rank policy. Missing-only teams stay unranked. Corrections replace the latest source revision under the existing transaction lock and correction-authorisation window.
- Tighten the shared Game Day SQL completion projection: completed game, valid player score and complete/confirmed-DNP/bye evidence are required. No entry, ownership, wallet or historical-result migration.
- Play, Rankings and permitted other-team views continue to consume the same authoritative journal projection. Existing 30-second foreground polling, focus/resume refresh, no-store requests and in-flight cancellation are preserved and browser-tested.

Application code: `6e1ebc92aa096c0ab725901a0aef2bf55b74b87f`, deployed to https://docked.com.au at 04:30 UTC. Vercel deployment: `dpl_9LfuLZyfQyL6A5QPWQ9pDA6JHcog`; immutable URL: https://docked-production-662vb1f4k-briant-s-projects.vercel.app. NFL Edge collector: version 19, JWT verification retained. Migration: `20261025040808_progressive_nfl_completion.sql`. Separate statistics service inspected at `037ae79`; no code changes there were needed because the live NFL collector runs in this application's Supabase Edge Function.

## Executed verification

| Check | Actual result |
|---|---|
| Platform suite, including NFL/NBA scoring | 629 passed, 0 failed on final run |
| Database suite | Initial run 221/222 passed; new test fixture revision collision fixed; affected test passed on rerun |
| Native PostgreSQL, all migrations and seven-player SQL/security contract | Passed on disposable local PostgreSQL |
| Native PostgreSQL concurrent imports/corrections | Passed: 20 retries, one import, idempotent replay, downward correction, atomic rollback, two users/tied ranks, 7/7 completion |
| Separate statistics-service unit suite | 112 passed |
| TypeScript, ESLint, production build | Passed |
| Browser acceptance with isolated fixtures | 1440, 1024, 412 and 360 px; no page errors or axe violations; Play/Rankings/View Team refresh and failure retention passed |
| Client bundle boundary | Passed for 90 browser assets |
| Actual known-secret scan | 903 files scanned; no matches or scan errors |
| Hosted worker access | Missing JWT denied 401; missing worker token denied 403 |
| Hosted real reconciliation | Both Week 7 streams successfully imported retained completed-game data |
| Production preservation | 31 protected tables unchanged; original journal rows and frozen slot snapshots unchanged |
| Hosted routes and access restrictions | 57 protected candidate checks and 58 live-domain checks passed; live commit verified; public registration remains closed |
| Persistent scheduled execution | Actual 04:30 UTC cron-triggered reconciliation completed on worker version 19; pending source/correction issues remained visible |
| Supabase security advisors | Unchanged from before release; no new findings |

The generic regex secret checker still flags eight existing fixture/template patterns; it is not reported as passing. The older generic sports-feed native harness fails on outdated round configuration; the current-contract native concurrency and seven-player harnesses passed. Initial platform failure for an EPL explicit blank week was fixed and the entire 629-case suite rerun successfully.

The existing Supabase warning for disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; this release did not change authentication policy. Its 216 informational RLS-without-policy findings are unchanged (private tables deny direct access and use guarded server functions).

## Timing and outstanding evidence

The existing schedule is unchanged: source download jobs run twice daily with provider cooldowns, reconciliation is scheduled every 15 minutes and claims one due round per invocation. With multiple due rounds this is not a guarantee of a 15-minute per-round refresh. Once published, foreground clients poll every 30 seconds. Source availability/cadence can therefore still delay new results; the UI must not advertise live in-game scoring.

Nine mapped players in the completed Week 7 game lack sufficient participation/statistics evidence. They remain pending; the remaining 13 Week 7 games had no verified completion evidence at the audit. Older Week 6 correction attempts can require reviewer authorisation after their saved correction window; no approval was bypassed and no historical journal was overwritten.

Signed-in hosted browser acceptance was not completed. Computer Use stopped because it could not confidently determine the current browser URL on Windows. Isolated browser checks, authenticated server-to-server worker execution and read-only Production verification are distinct evidence, not a substitute claim of member-session acceptance.

## Recovery

A verified private 30.7 MB recovery archive contains protected records, scoring journals, frozen locks and the previous function definition. Worker version 18 source and the previous Vercel deployment are also retained. This is a read-back-verified backup, not a full disaster-recovery drill. See `release/rollback.json` for precise scope. Do not restore whole customer tables or erase newly imported scores to roll back application code. Use the authorised correction process for any disputed score.
