# Barry beta review — 14 October 2026

Release acceptance in progress. Scope: existing admitted test economy only. Payments, prizes and withdrawals remain disabled. Owner/Barry assets and submitted teams are not QA fixtures.

## Findings and implementation

| Finding | Evidence / change |
|---|---|
| Scoring rules 404 | Reproduced ordinary-member hosted HTTP 404. Route incorrectly required Preview/development even on admitted production-target friends beta. Now uses existing admission and saved competition rules. |
| Contradictory scoring copy | Confirmed in homepage, pack replay and card screens. Current Salary Cap/Open explicitly 1.0–1.5x; legacy equal-scoring remains 1.0x. |
| NFL position filters | Confirmed hardcoded association-football positions. NFL collection uses central QB/RB/WR/TE plus K; competition eligibility is separate. No current individual DEF/DST inventory is inferred. |
| Kicker pack utility | New seven-player pack versions exclude K and DEF/DST. Old cards, products, receipts and entitlements remain intact. |
| Results navigation | Shared mode/week selector, counts, self highlight, saved rules links and distinct pending/provisional/final/empty/failure states. No other member selections or card IDs projected. |
| Selection information | Exact card identity, roster source reason, mapped kickoff and outgoing/incoming/net/remaining salary. Unsupported opponent/injury/recent points explicitly unavailable. Open does not filter by salary. |
| Tile identity | Core instance identity/unlimited and limited serial/cap, rarity, named ruleset multiplier. Player variants sort together without losing instance selection. |
| Unavailable player | Kyle Juszczyk source 00-0029892, SF/RB, INA observed 13 Oct 00:15 UTC. Existing rules require fresh ACT for new selections. INA does not establish injury, retirement or DNP. Locked snapshots unchanged. |
| Draft/entry states | No saved draft, saved incomplete draft, unsaved, changes not submitted, entered, partial/full lock and action required derived separately. Occupied count is not validity. |
| Supply labels | Test economy, artwork edition, permanent identity and supply are distinct. Core has no finite denominator. |
| Ownership history | Current-owner-only records, actual pack-open timestamp when present, issuance/transfers and listing/selection state. Other account IDs removed from history projection. |
| Loading | Original Barry stall not reproduced. Removed redundant wallet read, bounded fetch including body, server loading fallback, explicit Retry, stale response/account guards and online/resume recovery. No automatic mutation retry. |
| Public copy | Seven-player NFL/post-game beta, EPL unavailable, no universal equal scoring or legal eleven. Historical fixture demonstrations retain explicit labels. |
| Pack odds | Independent rarity-attempt probabilities, not conditional successful-pack odds. Values below certainty never render 100%. Exact rarity distinguished from rarity-or-better; configured guarantees separate. |
| Navigation | Shared collection includes legitimately owned paid test and Core instances; one packs entry to existing wallet, saved reveals preserved. |
| Card readability | Text rarity, position, serial/instance, explicit multiplier context and existing tier art. No new licensed assets or identity changes. |

## Pack configuration

New active versions: `standard-nine-seven-test-v2`, `premium-nine-seven-test-v2`.
Nine different players, no Core; QB/RB/WR/TE. 451 active fresh eligible players at migration check. Existing weights/prices unchanged: Standard 900 test credits, Premium 1,800. Rarity weights in Rare/Elite/Ultra Rare/Legendary/Icon order: Standard 8500/1200/250/49/1; Premium 6000/3000/850/149/1 (10,000 total). No guaranteed slots.

Each rarity is independently selected before eligible supply validation; player selection excludes prior players in the pack. An exhausted chosen rarity fails the entire purchase without charge or partial award. Conditional frequencies among successful packs may differ near exhaustion. Probability display is not a guarantee or a claim of measured fairness. Standard exact-Rare-at-least-once attempt probability is >99.999%, not 100%. Test settings are not commercially approved.

## Migration and rollback

Additive migration `20261013223206_barry_beta_review_projection.sql` extends read projections. Prior function definitions saved privately in `private-data/barry-review/prior-functions.json`. New product versions appended and active-offer list switched; original versions unchanged. Migration receipt proves all remaining wallet/state fields unchanged. Never restore an old wallet document over new purchases. For rollback, first promote the recorded previous deployment, retain compatibility read functions, and perform an audited active-offer change if necessary. Preserve new receipts and permanent issuance; do not delete data or renumber cards.

## Evidence and limits

Evidence in `docs/qa/barry-review`. Dedicated synthetic accounts only. Local database/unit checks and hosted rollback tests are distinct from candidate/domain browser acceptance. Genuine future member-round results, physical Samsung S24 and owner visual acceptance remain pending. Android v22 is a hosted shell connected to docked.com.au; no native behavior/config/signature changed.

## S24 review

1. Reopen v22, sign in, visit Play → Scoring rules and return.
2. Select Salary Cap then Open; confirm separate saved state and specific card identities.
3. Check replacement budget and precise unavailable-card reason, without submitting unwanted changes.
4. Cards: NFL filters/eligibility, card details/history, packs/replay and wallet return.
5. Results: mode/week and pending status. Interrupt/reconnect network and use Retry.
