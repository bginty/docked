# NFL lifetime card economy — 12 October 2026

This specification supersedes conflicting **new** economy plans. Historical purchases, free-beta competitions, ownership and original rules remain unchanged. Premium is now a pack type, not a rarity. Real payments, deposits, bonus activation, redeemable balances, prizes and withdrawals remain disabled. This is the existing invited test wallet, not a commercial economy.

## Authoritative configuration

`config/card-rarities-v1.json` is the source for six labels, multipliers and lifetime caps. The same document is registered immutably in the database. Core: free/unlimited/1.0×; Rare: 5,000/1.1×; Elite: 2,500/1.2×; Ultra Rare: 400/1.3×; Legendary: 50/1.4×; Icon: 1/1.5×. Limited total: 7,951 per permanent player in this isolated economy. Core keeps the existing free starter allocation and transfer rules. Its old technical allocation denominator is no longer presented as commercial scarcity.

Permanent identity uses established Docked IDs where mapped and deterministic nflverse GSIS identities for previously unmapped players, including kickers. Latest roster conflicts fail closed; missing data becomes unknown, not retired. The private current-status projection uses the existing retained roster cache and requires fresh observations. No extra provider polling or new subscription. Attribution: nflverse data, CC BY 4.0, https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md. Existing free-beta permit expires 10 November 2026 UTC. Commercial player/artwork use is not asserted.

986 catalogue identities were staged from retained revision 5 (535 active: QB 84, RB 120, WR 179, TE 120, K 32). Current counts can change. No player photos or league/team logos were added. Docked original shirt artwork is used.

## Test products, not approved commercial economics

| Setting | Standard test v1 | Premium test v1 |
|---|---:|---:|
| Test-credit price | 900 | 1,800 |
| Cards | 9 | 9 |
| Rare per draw | 85% | 60% |
| Elite | 12% | 30% |
| Ultra Rare | 2.5% | 8.5% |
| Legendary | 0.49% | 1.49% |
| Icon | 0.01% | 0.01% |
| Guaranteed slots | None | None |
| Duplicate players | Not allowed within pack | Not allowed within pack |

These settings make testing practical; they are not a commercial recommendation based on demand or profitability. Recommend retaining no guaranteed slot and no duplicate player for initial usability review, then approve prices/weights only after supply and economic review. The old A$49/A$99 deposit-bonus offers are not mapped to either new pack; mapping, frequency and economics remain an owner decision. The prior one-card receipts retain their original terms; no new one-card purchases after activation.

The server draws rarity first using Node cryptographic `randomInt`, then uniformly selects an eligible player with remaining allocation. Slot guarantees are optional immutable configuration, not implied by Premium. Active is the default status eligibility; a new version may explicitly change eligible statuses, but unknown status is never eligible. No Core. If the selected rarity has no eligible player, the entire attempt rolls back without a debit, substitution or reroll. Consequently accepted-pack rarity frequencies can differ near exhaustion. The displayed `1-(1-w)^9` is the independent pre-availability chance of at least one, not a guarantee for accepted packs. Specific outcomes use deterministic tests; sampler observations do not prove fairness.

## Integrity and recovery

The existing locked aggregate, balanced credit journal and transaction store are extended. All nine immutable instances, sequential serials, one debit, receipt and ownership events commit together. The database separately enforces permanent player/rarity definitions, caps, unique serials and immutable receipts. Unopened packs are already issued and privately owned; reserved supply is therefore zero. They cannot be listed or swapped before opening. Normal retries retrieve the existing result. Client confirmation includes immutable product version; changed terms require new consent.

Transfers, source team changes, artwork, seasons, account closure and refunds cannot decrement lifetime issuance. Foreign provider aliases require operator reconciliation against an established identity; no browser or routine owner control can create identities, edit caps or remap issued cards. A future provider switch must append mapping evidence to the existing identity, not seed a second player. No reset command is provided.

Collection and disclosure show all six rarities, current versus printed team, status, multiplier, permanent serial/cap, issued/reserved/available and ownership history. Owner reporting includes product versions, actual draw counts, rejected purchases and source warnings. 7.5% sandbox commission and 50-credit-per-participant sandbox swaps are retained; ordinary free swaps are separate.

## Scoring boundary

`docked-nfl-rarity-test-v1` is a separate opt-in version. Complete player base points × saved multiplier, once per player/round, to 0.01 points using integer arithmetic and ties away from zero. Negative scores are multiplied too. Lineup snapshots preserve card ID, player, position, rarity, multiplier, rarity version and rules hash. Corrections use that saved round configuration. Duplicate-player restrictions still apply across rarities.

The existing seven-player QB/2RB/2WR/TE/FLEX formation is unchanged. K is collectible only: no kicker scoring rules or slot have been invented. Existing DEF/DST implementations remain untouched; team-defence assets are a separate asset kind and excluded from these individual-player packs. AFL gameplay was not added.

The shared period engine and server-owned inventory adapter support new explicitly scoped `beta-real:nfl:rarity-test:*` periods; an ordinary free period cannot select rarity rules accidentally. **No existing or underway member round was converted.** No new real weighted competition is scheduled by this release. The member-round bridge continues to use its original free inventory; connecting a newly scheduled rarity round to that bridge is a remaining integration step, not completed live weighted gameplay. Tests demonstrate locked rarity arithmetic, negative scores, later transfers and appended corrections using isolated fixtures, not invented sporting results.

## Migration and rollback

Migration `20261012101915_lifetime_card_economy.sql` is additive in `credits_sandbox`. Preflight recorded 41 main beta cards, 678 legacy editions, 498 mapped players, four legacy orders (one sealed), three opened test cards and eleven existing wallet events. The private preimage is retained under `private-data/economy-v2`. No existing document field other than the new economy property was changed; no human credit grant was executed.

Legacy season-linked editions and fictional test players are deliberately **not** converted into lifetime real-player allocations. Commercial migration requires an inventory-by-identity/rarity reconciliation and owner review of duplicates or cap conflicts. Do not renumber, delete or silently fold old records into new allocations. The new isolated test caps do not consume future commercial supply.

Operator workflow: `node --import tsx scripts/apply-card-economy.ts --inspect`, then `--prepare` (disabled), deployment/acceptance, then `--activate`. `--pause` stops new purchases while retaining receipts, cards and trading history. Never undo issuance by restoring an old state JSON. Keep the additive tables. If rolling web code back to v20, first disable test-wallet access with an audited operator action because v20 cannot render new economy cards; preserve main free gameplay and all records. Prefer a compatible forward repair. DNS, Auth, mail, owner MFA and source schedules are not changed.

## Acceptance

Receipts are in `docs/qa/economy-v2` and `docs/qa/android-v21`. Local PostgreSQL used eight restricted-role connections to contend for the final Icon: one winner, seven clean failures; repeated opens returned the same nine cards. Hosted testing uses only the existing synthetic QA account, restores its temporary admission, and compares owner/Barry fingerprints. Human visual approval and physical Samsung S24 acceptance remain pending. No messages or invitations are sent.
