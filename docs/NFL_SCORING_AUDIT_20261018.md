# NFL scoring audit and card statistics repair — 18 October 2026

Status: implementation under verification; scoring-policy decision and browser acceptance remain open. This is not a completed production scoring rollout.

## Established root causes

1. The signed receiver did import real statistics. Player history reproducibly calculates points with `scorePlayer`; points were not missing from the API. The old card back placed scores beside expanded raw-statistics rows inside a small scrolling table. This made 15.40 and 21.56 difficult to see.
2. Player history uses `docked-nfl-postgame-full-ppr-test-v1`, separately authorised for member-visible reference history. Existing member competitions freeze `docked-nfl-half-ppr-beta-v1` or its explicit rarity/seven-slot variants. These are different policies, not interchangeable scores. The generic card also automatically multiplied reference history by rarity. This repair removes that adjusted reference from history; existing explicit competition multipliers are unchanged.
3. All four live member NFL round journals currently contain zero imported scoring snapshots. Five entries have pending points and null ranks. Their collection issues report awaiting verified completion / collection delay. The independent history importer intentionally cannot settle competitions.
4. A scoring-engine edge case treated a player with no matching fixture as zero because an empty array passed `every`. It now remains pending with no rank. No affected saved production result was found in the audited journals.
5. Retained-score diagnostics previously relaxed field confidence and game identity/completion checks. Retention now relaxes freshness only. Mixed scoring coefficients in fallback history fail closed rather than produce a combined season total.

## Rules and worked example

Both versions support individual QB/RB/WR/TE. Kicker, team defence and IDP are unsupported. Integer centipoints are the calculation unit; display rounds to two decimals. Negative yards and turnovers subtract points. Missing/unconfirmed fields never become zero. Confirmed DNP is distinct from a played zero-point game.

| Statistic | Member half-PPR | History full-PPR reference |
|---|---:|---:|
| Passing yards | .04 each | .04 each |
| Passing TD | 4 | 4 |
| Interception thrown | -2 | -2 |
| Rushing / receiving yards | .1 each | .1 each |
| Rushing / receiving TD | 6 | 6 |
| Reception | .5 | 1 |
| Fumble lost, once | -2 | -2 |
| Passing / rushing / receiving two-point conversion | 2 | 2 |
| Kickoff / punt return TD | 6 | Outside version |
| Offensive fumble-recovery TD | 6 | Outside version |

Rome Odunze maps through reviewed GSIS `00-0039919` to canonical `p_dd48e448025d462ab60bada48e32055a` and Docked `9d7761ae-f5a7-4c13-a4a0-6da3fb41b0c8`. The retained real source record for week 4, game `g_532b80904b0241d386dbc70199bf9437`, has 6 receptions, 94 receiving yards and zero in every other required reference field. It produces **6 + 9.4 = 15.40** reference points. The half-PPR subtotal is **3 + 9.4 = 12.40**, but must not be represented as a complete legacy competition score without the additional return/recovery fields. The previous **21.56** was `15.40 × 1.4`, a card reference rather than awarded competition points.

Week 5 includes one lost fumble: 3 receptions + 40 yards - 2 = **5.00**. The five valid observed games total **42.30**, average **8.46**. These totals are not a claim of complete season coverage or earned member points.

## Read-only reconciliation

`docs/qa/nfl-scoring-audit/dry-run.json` records the audited live snapshot. Full private row-level comparison is in `private-data/nfl-scoring-audit-20261018/comparison.json` (excluded from Git).

- 433 mapped players; 1,673 eligible observed player-games independently reproduce the current history calculator.
- 1,064 observations would change from reception policy alone; aggregate shared-category difference is -162,350 centipoints. This is a diagnostic subtotal, not an approved backfill.
- All 1,673 lack at least one confirmed legacy return/recovery field. Backfill must obtain that evidence or use a newly approved version; never insert zeroes.
- Four current round journals reproduce their persisted calculated projections exactly. Five entries are pending; zero finalised rounds, zero source snapshots, no cash prize awards in these rounds.
- No result, reward, locked lineup, rules snapshot or historical audit has been rewritten. No backfill apply command is enabled.

Owner decision requested: retain half-PPR as the shared authority or prepare an explicit versioned full-PPR migration. Existing immutable competition versions cannot be edited in place. Material historical changes require a separate exact impact review and approval.

## Implemented changes

- Large latest-game Fantasy Points display; season total, average, played count and position-relevant summary. Card flip/front retained. No inner scrolling raw-statistics panel or automatic rarity-adjusted history total.
- Separate expandable Player Statistics section outside the card: game date, verified opponent, relevant stats, base points, game/scoring states, missing fields, calculation parts, revision and source-update time. One outer dialog scroll.
- History carries rule version, per-game calculations and canonical team metadata. Duplicates cannot inflate totals, revisions replace prior observations, latest removals stay removed. Incomplete-game flags remain visible even when individual player fields are sufficient for reference history.
- Owner view adds game/player drilldowns, missing statistics and revised-record diagnostics. Retained history scores use the same freshness policy as member history. Existing owner-authorised read RPCs expose frozen competition rules and pending/provisional/final result counts. No result-editing controls or new database grants.
- Same-version tests compare player history, selected player contributions, team totals and rankings. All supported scoring categories, fractions, negatives, missing/mismatched games, duplicates and corrections are covered.
- Isolated release test exports now include the existing NFL target dependency; this fixes four unrelated harness failures found during the full suite.

## Source and deployment boundaries

Statistics originate from retained nflverse weekly player data, with reviewed provider identity mapping. [nflverse-data](https://github.com/nflverse/nflverse-data) is published under CC BY 4.0; attribution remains in the UI. [Published update schedules](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) describe postgame processing and later corrections, not a live-data guarantee. No commercial feed, paid service or restricted scrape was activated.

Current retained dataset: 11,475 change events, 5,569 latest raw player-game records, 272 games, 1,603 source players. Six final games retain incomplete flags; 74 final games have available game coverage and 192 are scheduled. Missing appearances are not inferred as DNP. History publication is manual, with explicit stale-state disclosure.

The export adapter now adds home/away team labels from canonical entities in the same consistent SQLite snapshot. The metadata publication changed 272 game labels only: all raw change pages and player metadata are byte-equivalent after JSON parsing; record, competition journal and economy hashes were unchanged after delivery. Receipt digest: `2da6b47b76d5d42985b63fcf57a8ad88e64982fec150db7c8016d6cd25b5f10b`.

Recovery: `private-data/nfl-scoring-audit-20261018/before-labels.json` contains the verified pre-publication game metadata and consumer state. The original signed source batch remains in `private-data/nfl-live-release/initial.json.gz`; previous recovery receipts remain applicable to untouched tables. If labels need reverting, replay a fresh signed export with the original verified game metadata through the existing receiver; do not restore a whole local database or alter competition journals.

## Acceptance still required

The local real-source browser preview was denied at the browser origin-permission prompt. No alternate port, browser or automation workaround was attempted. Screenshots supplied by the owner establish the before state; after screenshots and Samsung visual acceptance are pending permitted browser access. Automated source/test/build success is not a substitute for this check.

Protected Preview will use the exact reviewed commit, existing Vercel project and restricted runtime/history reader. The history writer and receiver are disabled there. Production domains must not be promoted as part of this audit without resolving the scoring-policy and acceptance gaps.

Samsung checks when browser access is available: flip Rome's card; latest 5.00, season 42.30, average 8.46, played 5 under the labelled reference policy; open full statistics and verify week 4 vs NYJ 15.40 and week 5 @ GB 5.00 including the fumble penalty; inspect missing-data player state; check ordinary-member and owner access separately; no nested card scroll or horizontal clipping at 360/412px; preserve close/back focus and reduced-motion behaviour.
