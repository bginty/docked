# NFL roster reconciliation — 17 October 2026

Continuation of accepted commit 08298555. This is isolated local verification, not hosted activation. The fresh 32-team official roster collection from 05:22–05:23 UTC was reused; targeted official transactions and seven supplementary official news pages resolve exceptions. Source URLs, timestamps and SHA-256 hashes are retained in reconciliation.json and supplemental-evidence.json. No player is removed solely for an absent statistic or failed name match.

## Outcome and overlap

| Classification | Original 208 identities |
| --- | --- |
| Current supported-position player missing from the catalogue | 0 |
| Existing player with an ID, name, team or position mismatch | 5 |
| Reserve/practice-squad status requiring explicit classification | 62 |
| Unsupported position | 2 |
| Confirmed released, retired or unsigned player | 137 |
| Historical identity retained only for statistics | 0 |
| Genuinely unresolved identity | 2 |

The 49 original missing roster rows overlap the 208 quarantined identities by **44 distinct identities / 45 rows**. Audric Estimé appears on both MIN and CLE roster pages; CLE's dated 13 October signing from MIN's practice squad supersedes the stale MIN row. The other four rows are actual catalogue omissions. Therefore the two exception lists must not be added as 257 separate people. All 208 cases are in [exceptions.csv](exceptions.csv); all 49 original rows are in [original-49-roster-rows.csv](original-49-roster-rows.csv).

| Original 49 outcome | Rows |
| --- | --- |
| eligible | 4 |
| intentionally-unreleased | 4 |
| practice-squad | 35 |
| reserve | 5 |
| superseded-roster-row | 1 |

Four formerly quarantined identities now qualify: Audric Estimé, Joe Milton III, Marquise/Hollywood Brown and Andrew/Drew Ogletree. The fifth identity mismatch is Ty Pezza: corrected **only in the prepared unissued local catalogue** from WR to official TE. His stable identity has no editions, owned cards or historical lineup records; practice-squad status still excludes acquisition. Full team IDs and historical raw provider positions remain intact.

## Coverage in both directions

**493 active supported catalogue players** pass fresh official evidence and position checks. All **791 supported official roster rows** have an explicit outcome: 493 eligible, 189 practice squad, 104 reserve, four deliberately unreleased catalogue omissions and one superseded row. Zero current supported roster rows remain unaccounted for. Practice-squad/development and reserve players are excluded from new acquisition by the existing active-only policy, not declared departed.

The four verified omissions are **Justin Watson (KC), Jake Browning (LAC), Luke Grimm (LAC), Al-Jay Henderson (NYJ)**. All are practice squad. They remain intentionally unreleased; no new player, edition, card or scarcity allocation was created. Roster eligibility is only a gate: product, release, permanent supply and serial rules remain authoritative.

Active eligible counts by team and fantasy position follow. RB includes already-approved FB/HB mappings (including FB/DL); dual-role players count once in their existing Docked fantasy position, for example WR/CB as WR and Eli Heidenreich's RB/WR as RB. PS/reserve counts include supported positions, while the four missing catalogue rows are shown separately to avoid double counting.

| Team | QB | RB | WR | TE | Eligible | PS | Reserve | Unreleased | Superseded |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARI | 3 | 3 | 6 | 4 | 16 | 5 | 5 | 0 | 0 |
| ATL | 4 | 2 | 5 | 4 | 15 | 6 | 2 | 0 | 0 |
| BAL | 3 | 3 | 5 | 4 | 15 | 4 | 4 | 0 | 0 |
| BUF | 2 | 3 | 6 | 4 | 15 | 6 | 1 | 0 | 0 |
| CAR | 3 | 2 | 5 | 5 | 15 | 5 | 4 | 0 | 0 |
| CHI | 3 | 3 | 5 | 3 | 14 | 8 | 3 | 0 | 0 |
| CIN | 2 | 3 | 5 | 5 | 15 | 7 | 1 | 0 | 0 |
| CLE | 3 | 4 | 6 | 3 | 16 | 5 | 4 | 0 | 0 |
| DAL | 2 | 4 | 6 | 3 | 15 | 5 | 3 | 0 | 0 |
| DEN | 3 | 4 | 5 | 4 | 16 | 6 | 3 | 0 | 0 |
| DET | 2 | 3 | 4 | 4 | 13 | 7 | 3 | 0 | 0 |
| GB | 2 | 3 | 5 | 4 | 14 | 6 | 5 | 0 | 0 |
| HOU | 2 | 3 | 5 | 5 | 15 | 8 | 4 | 0 | 0 |
| IND | 3 | 3 | 6 | 4 | 16 | 4 | 4 | 0 | 0 |
| JAX | 2 | 4 | 6 | 4 | 16 | 8 | 0 | 0 | 0 |
| KC | 3 | 4 | 5 | 4 | 16 | 5 | 4 | 1 | 0 |
| LAC | 2 | 4 | 7 | 3 | 16 | 5 | 4 | 2 | 0 |
| LAR | 3 | 3 | 7 | 5 | 18 | 3 | 2 | 0 | 0 |
| LV | 3 | 4 | 5 | 3 | 15 | 8 | 5 | 0 | 0 |
| MIA | 2 | 4 | 5 | 4 | 15 | 7 | 2 | 0 | 0 |
| MIN | 3 | 4 | 5 | 3 | 15 | 5 | 2 | 0 | 1 |
| NE | 3 | 3 | 4 | 4 | 14 | 6 | 6 | 0 | 0 |
| NO | 3 | 3 | 4 | 4 | 14 | 7 | 5 | 0 | 0 |
| NYG | 3 | 5 | 4 | 4 | 16 | 5 | 4 | 0 | 0 |
| NYJ | 2 | 5 | 5 | 4 | 16 | 3 | 3 | 1 | 0 |
| PHI | 4 | 3 | 7 | 3 | 17 | 5 | 5 | 0 | 0 |
| PIT | 4 | 5 | 5 | 3 | 17 | 6 | 1 | 0 | 0 |
| SEA | 3 | 4 | 6 | 4 | 17 | 6 | 4 | 0 | 0 |
| SF | 3 | 4 | 5 | 3 | 15 | 8 | 6 | 0 | 0 |
| TB | 2 | 3 | 5 | 4 | 14 | 7 | 2 | 0 | 0 |
| TEN | 2 | 5 | 5 | 4 | 16 | 6 | 1 | 0 | 0 |
| WAS | 3 | 3 | 6 | 4 | 16 | 7 | 2 | 0 | 0 |

The full team × position × disposition matrix is [team-position-coverage.csv](team-position-coverage.csv). Individual official roster evidence is [roster-coverage.csv](roster-coverage.csv).

## Remaining evidence limitations

**Cam Camper (00-0040324) and Cody Hardy (00-0041327)** have official NYJ practice-squad signing evidence but are absent from the current official roster page. Their current status remains genuinely unresolved. Neither has an owned test card. They cannot enter new packs or administrative issuance. Do not declare them released without a subsequent official transaction or corrected roster evidence.

**23 additional reserve-status cases** have explicit reserve/retired, waived-injured or practice-squad-injured evidence but are absent from the current roster page. They remain retained and excluded pending authoritative status clarification. This includes retirement-list identities; retirement alone does not justify deleting a still-reserved identity. These are status exceptions, not statistical mapping failures. The complete list and specific evidence are in [pending-status-cases.csv](pending-status-cases.csv).

| Player | Position | Disposition |
| --- | --- | --- |
| Teddy Bridgewater | QB | reserve-review |
| Ray-Ray McCloud | WR | reserve-review |
| Will Grier | QB | reserve-review |
| Parris Campbell | WR | reserve-review |
| Jermar Jefferson | RB | reserve-review |
| Dennis Houston | WR | reserve-review |
| Danny Gray | WR | reserve-review |
| Ben Sims | TE | reserve-review |
| McCallan Castles | TE | reserve-review |
| Carter Bradley | QB | reserve-review |
| Cole Burgess | WR | reserve-review |
| Ja'Lynn Polk | WR | reserve-review |
| Thomas Yassmin | TE | reserve-review |
| Cam Camper | WR | quarantine |
| Ja'Quinden Jackson | RB | reserve-review |
| Bryson Nesbit | TE | reserve-review |
| Dominic Richardson | RB | reserve-review |
| Chase Roberts | WR | reserve-review |
| Le'Veon Moss | RB | reserve-review |
| Caullin Lacy | WR | reserve-review |
| Alex Bullock | WR | reserve-review |
| Chase Curtis | TE | reserve-review |
| Squirrel White | WR | reserve-review |
| Cody Hardy | TE | quarantine |
| Connor Hulstein | TE | reserve-review |

There are **zero uncertain owned cards** across both the aggregate economy and legacy inventory, and **zero uncertain recorded lineup selections**. Thus no uncertain owned card is currently selectable. This does not add a blanket injury-based lineup prohibition: ordinary ownership, position, salary, duplicate-player and kickoff rules remain unchanged for retained owned cards. Audric Estimé's existing card is retained under the corrected CLE evidence.

## Cleanup and integrity

**No additional players, cards, ownership records or dependent test records were removed.** The accepted eight-card/seven-player cleanup remains the only removal. Its manifest and recovery snapshot are untouched. New preimage recovery and an empty additional-removal manifest were written before preparing the local catalogue. No replacement cards or credits were issued, and no lineup total needed recalculation.

- Accepted original snapshot SHA-256: 7f79214ed0ae8a2db426ff7cdcec5688264d97d4803400de3de53aea2c47fb69.
- Prepared-copy preimage SHA-256: a92574ebf511db72b2ba19a955f18ef4f6c51de1d9a619ff59b140c575ec0e2e (private recovery files are not committed).
- Preserved active aggregate cards: 316; legacy cards: 51.
- Existing consumed serial tombstones, allocation receipts, supply definitions, ownership, wallets, accounts, historical statistics and recorded entries are unchanged.
- Dependency checks passed for ownership_events: 51, pack_items: 11, listings: 0, trade_items: 0, entries: 68, drafts: 14, locks: 2, swaps: 12. No active orphan references found. Original removed IDs remain absent.
- Local preparation uses a PGlite audit mirror and a separate prepared state file, not a full production database restore. No remote connection or production mutation is in the apply runner.

## Feed mapping and proof

| Eligible Docked players | Count |
| --- | --- |
| Verified statistical identities | 433 |
| No recorded appearances in supplied season dataset | 60 |
| Mapping conflicts | 0 |
| Total | 493 |

The 60 players without observations have verified roster identities. Their lack of a canonical feed observation is **not a mapping failure, DNP or confirmed zero**. The dataset's canonical entities are observation-derived. Eight explicit position reviews resolve six existing RB/FB/HB labels plus Travis Hunter's offensive WR/CB role and Jackson Meeks' current TE role. Raw historical positions are retained; no IDP scoring or competition rules were added. See [position-reviews.json](position-reviews.json), [eligible-statistics.csv](eligible-statistics.csv) and the dataset-bound [reviewed-feed-mappings.json](reviewed-feed-mappings.json).

The actual separate Python API ran against an isolated copy of its SQLite database over authenticated loopback HTTP. The existing localhost:8080 service was unavailable; this is not evidence of a running hosted service. The original SQLite hash was unchanged. The API returned **5,569 records**, **272 scheduled games**, **74 available games**, **six incomplete games** and **192 not-started games**. The handover's 80 final games includes the six incomplete games, rather than 80 fully complete games plus six.

Real Carson Wentz week 2: 143 × 0.04 passing yards + 6 × 0.1 rushing yards = **6.32**. Week 1 19.22 + week 2 6.32 = observed season **25.54**. The isolated recorded seven-card lineup scored **33.64**. Duplicate import produced no new journal revision. A labelled local +1 reception correction changed it to **34.64** and the affected season subtotal by 1.00; explicit resync restored original totals. Missing required fields stay incomplete. The six anonymous source rows are a separate source-data blocker to affected result finalisation, not one of the two roster identity exceptions.

Configuration: **docked-nfl-postgame-full-ppr-test-v1**, fumbles lost **−2 once per player**, receptions **1**; existing approved competition versions are unchanged. No current ownership is used to award historical team points. Evidence: [real-api-verification.json](feed-verification/real-api-verification.json), [real-game-journal.json](feed-verification/real-game-journal.json), [resync.json](feed-verification/resync.json), [scoring-configuration.json](feed-verification/scoring-configuration.json).

## Acquisition guards and next step

The prepared aggregate state explicitly enables official-nfl-roster-v1. Both active Standard and Premium product pools contain 493 verified players; uncertain, reserve, unsupported and departed identities are excluded. Stale evidence fails closed after 72 hours. Pregenerated ineligible packs require review rather than rerolling or charging.

Focused SQL tests exercise the existing shared eligibility guard on direct administrative issuance and pack allocation, including legacy and aggregate paths; Starter/Weekly Core migrations also use it. These tests run on isolated databases. Hosted controls were **not enabled**, and production's configuration has not been asserted to match this prepared state. Hosted activation must install fresh evidence and verify all guards on the exact isolated target.

Focused verification: **12 platform tests and four database tests passed**, plus typecheck and targeted lint. The actual API proof passed; the existing-build client scan found no known canary markers. Scope, commands and limitations are recorded in [VERIFICATION.md](VERIFICATION.md).

See [the concrete hosted testing plan](../../NFL_HOSTED_TESTING_PLAN.md). No services were purchased, computer exposed, production changes made or hosted ingestion activated.
