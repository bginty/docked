# NFL seven-player test competitions — 13 October 2026

## Authoritative scope

Two new isolated modes, Salary Cap and Open, use **QB1 / RB1 / RB2 / WR1 / WR2 / TE1 / FLEX1 (RB, WR or TE)**. This is the owner's mandatory formation. K and DST remain available only in older compatible competitions. Existing entries, free competitions, commercial scarcity, holdings, grants and pack terms are preserved.

`config/nfl-seven-v1.json` is the reviewed lineup configuration. Registration persists the exact immutable version in `beta_fantasy.lineup_configurations`; member selection, SQL validation and displayed salaries use that stored version. Canonical rarity multipliers remain in the existing rarity configuration. Salary Cap is 4,400,000 fantasy units, not wallet credit or AUD. Core 500,000; Rare 600,000; Elite 650,000 (development provisional); Ultra Rare 700,000; Legendary/Icon 800,000. Open has no salary validation. Every edition remains isolated/nonwithdrawable; payments, prizes and withdrawals stay disabled.

## Member journey

1. Open Play and choose Salary Cap or Open. Both have their own saved draft and entry.
2. Tap each slot; select an eligible owned card. Core and opened purchased test cards resolve to the same permanent NFL player identity. One underlying player per team.
3. Save Draft may save fewer than seven cards. It never changes an existing entry. Enter Competition requires seven valid cards and backend confirmation. Update Entered Team explicitly changes the submitted lineup.
4. Unsaved selections survive mode changes and refresh in the same browser session. A new device shows the confirmed entry first; Reload saved draft is separate. Stale versions are rejected, with local selections retained for review.
5. View player points and weekly standings through the existing post-game pipeline. Missing statistics stay pending, never final zero.

Week 6 links:
- [Salary Cap](https://docked.com.au/fantasy/play?competition=70de1f8e-b789-4331-99aa-6afb0c31a8a2)
- [Open](https://docked.com.au/fantasy/play?competition=315280d3-7413-4c2d-8a63-fef6d7e37003)

New entries close **Friday 16 October 2026, 11:15am Australia/Sydney** (SEA at DEN). Fourteen verified fixtures; complete per-game Sydney locks are retained in `qa/seven-round/preparation.json`. Later locks: Monday 19 October 00:30, 04:00, 07:05, 07:25 and 11:20; Tuesday 20 October 11:15 (use the fixture receipt for exact game mapping). Verify schedule changes before relying on this static summary.

## Locks, transfers and scoring

New entries and withdrawals close at the first included kickoff. Already-entered members may edit only unstarted slots, preserving a valid complete team. Every mutation checks database time; the final write rechecks requests crossing kickoff. Synchronous lock creation prevents scheduler delay from extending edits. Once locked, a card cannot move between dedicated/FLEX slots or be removed.

A card in any submitted **unlocked** slot is reserved against sale/swap. Replace it in each affected mode, or withdraw before entry closure, before transferring. Draft references do not reserve assets but become invalid if ownership changes. After lock, transfer preserves the prior owner's immutable round entitlement; the buyer cannot add the already-started player to that round. The same owner may use one card in both modes.

Scoring uses saved card identity, rarity, multiplier, fixture and ruleset. Base NFL points × locked multiplier, including negative scores, are rounded to two decimals half away from zero per card, then summed. Statistical corrections append revisions using those saved rules. Standings share rank for ties. Other members never receive an unlocked lineup or private card IDs; participant lineup inspection is not enabled.

## Administration and schedule incidents

Owner/admin MFA controls on Play can pause entries/edits and hide standings with a required audited reason and revision check. Existing operations/scoring tools retain data-issue review and reviewed finalisation. Future caps/salaries/roster versions and weekly round creation use the reviewed configuration plus `scripts/seven-round-prepare.ts`; in-app arbitrary rule editing is deliberately not exposed. A new configuration version and matching validated scoring version require a reviewed release, not alteration of accepted rounds.

The registrar is idempotent by season/week/mode and refuses already-started full rounds. Previous teams can be copied into a new draft, revalidated and explicitly entered; never auto-entered. Missing or unreliable fixture mappings block affected cards. The source adapter does **not** automatically rewrite accepted fixture schedules. For a verified postponement/cancellation/reschedule, pause the affected mode, retain snapshots, inspect the mapping and make an audited forward correction; never unlock a previously locked slot. No automatic substitutions or invented zero/DNP results. Automated schedule-change application remains a documented operational limitation.

## Verification evidence

- `qa/seven-round/hosted-replay.json`: two dedicated AAL1 accounts, rollback-only historical acceptance. Actual retained NFL statistics, synthetic correction clearly isolated. Nine-card purchase/open/idempotency, owned selection, draft/entry separation, rolling locks, transfers and adjusted scoring/standings. No owner/Barry purchase, entry, transfer or grant.
- `tests/database/nfl-seven.test.ts`: actual migrated SQL, exact 4.4M boundary, over-cap rejection preserving entry, Open 5.6M, incomplete drafts, six/eight-card rejection, private table permissions, ordinary-member admin denial, immutable config and write-boundary lock guard.
- `tests/platform/nfl-seven.test.ts`: mandatory slots, salaries/replacement budget, duplicate canonical identity, all multipliers/negative rounding, strict payloads.
- `qa/seven-round/member-access.json`: read-only owner/Barry admission and position coverage. Both can form a valid Core team; no additional pack purchase is necessary.
- Browser/deployment/domain evidence is added after execution, not inferred from these tests.

Historical replay is **not** a genuine member result. Upcoming Week 6 and first real entered-round observation remain pending. Authenticated worker idle proves dispatch, not a fresh source download. Existing schedules/cooldowns remain unchanged. Physical S24 and owner visual approval remain pending.

## Migration and rollback

Additive migrations `20261013064456_nfl_seven_slot_modes.sql` and `20261013073543_nfl_seven_final_write_guard.sql` extend existing beta tables/functions. No database reset, renumbering, grants or commercial issuance. Append-only entry revisions and individual locks are private under RLS. The older web release cannot see the new rounds unless its trusted server enables the new read projection.

Rollback web aliases to the deployment saved in `qa/seven-round/rollback.json`, using the existing Docked Vercel project. Pause the two new modes before rollback if members have entered; retain all entries, locks, transaction and scoring history. Do not drop tables or reverse issuance. Legacy rounds stay on their original functions/rules. The source worker remains backward compatible. Mail/DNS/Auth policies and native package/signature are unchanged.

The installed **v22 APK loads docked.com.au** and receives these web screens after reopening. No native code change requires an APK update. Do not distribute protected-owner QA builds. Existing v22 download expires 19 October 2026 23:43:59 Sydney. Device acceptance must be performed by the owner/tester.
