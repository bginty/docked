# Barry beta review — 14 October 2026

Released to the existing admitted beta; final deployment identity and browser receipts are recorded below. Scope: existing admitted test economy only. Payments, prizes and withdrawals remain disabled. Owner/Barry assets and submitted teams are not QA fixtures.

## Findings and implementation

| Finding | Status | Evidence / change |
|---|---|---|
| Scoring rules 404  | Fixed; automated verification passed | Reproduced ordinary-member hosted HTTP 404. Route incorrectly required Preview/development even on admitted production-target friends beta. Now uses existing admission and saved competition rules. |
| Contradictory scoring copy  | Fixed; automated verification passed | Confirmed in homepage, pack replay and card screens. Current Salary Cap/Open explicitly 1.0–1.5x; legacy equal-scoring remains 1.0x. |
| NFL position filters  | Fixed; automated verification passed | Confirmed hardcoded association-football positions. NFL collection uses central QB/RB/WR/TE plus K; competition eligibility is separate. No current individual DEF/DST inventory is inferred. |
| Kicker pack utility  | Fixed; automated verification passed | New seven-player pack versions exclude K and DEF/DST. Old cards, products, receipts and entitlements remain intact. |
| Results navigation  | Fixed; automated verification passed | Shared mode/week selector, counts, self highlight, saved rules links and distinct pending/provisional/final/empty/failure states. No other member selections or card IDs projected. |
| Selection information  | Implemented; unsupported fields labelled unavailable | Exact card identity, roster source reason, mapped kickoff and outgoing/incoming/net/remaining salary. Unsupported opponent/injury/recent points explicitly unavailable. Open does not filter by salary. |
| Tile identity  | Fixed; automated verification passed | Core instance identity/unlimited and limited serial/cap, rarity, named ruleset multiplier. Player variants sort together without losing instance selection. |
| Unavailable player  | Fixed; automated verification passed | Kyle Juszczyk source 00-0029892, SF/RB, INA observed 13 Oct 00:15 UTC. Existing rules require fresh ACT for new selections. INA does not establish injury, retirement or DNP. Locked snapshots unchanged. |
| Draft/entry states  | Fixed; automated verification passed | No saved draft, saved incomplete draft, unsaved, changes not submitted, entered, partial/full lock and action required derived separately. Occupied count is not validity. |
| Supply labels  | Fixed; automated verification passed | Test economy, artwork edition, permanent identity and supply are distinct. Core has no finite denominator. |
| Ownership history  | Fixed; automated verification passed | Current-owner-only records, actual pack-open timestamp when present, issuance/transfers and listing/selection state. Other account IDs removed from history projection. |
| Loading  | Recovery verified; original cause unresolved | Original Barry stall not reproduced. Removed redundant wallet read, bounded fetch including body, server loading fallback, explicit Retry, stale response/account guards and online/resume recovery. No automatic mutation retry. |
| Public copy  | Fixed; automated verification passed | Seven-player NFL/post-game beta, EPL unavailable, no universal equal scoring or legal eleven. Historical fixture demonstrations retain explicit labels. |
| Pack odds  | Fixed; automated verification passed | Independent rarity-attempt probabilities, not conditional successful-pack odds. Values below certainty never render 100%. Exact rarity distinguished from rarity-or-better; configured guarantees separate. |
| Navigation  | Fixed; automated verification passed | Shared collection includes legitimately owned paid test and Core instances; one packs entry to existing wallet, saved reveals preserved. |
| Card readability  | Fixed; automated verification passed | Text rarity, position, serial/instance, explicit multiplier context and existing tier art. No new licensed assets or identity changes. |

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

## Executed acceptance

- 331 platform tests: 323 passed in the sandbox; eight filesystem/Git temp-directory failures passed on the required unsandboxed rerun (10 tests in those files, all passed). No product assertion failure remains.
- 151 database tests passed, including the new private member-review projection assertion. The first added fixture tried to change an immutable round purpose; corrected the fixture to declare its purpose at creation, preserving the production guard.
- Focused final pack/reveal/display suite: 17 passed. Typecheck and lint passed. Production web build passed locally and on Vercel. Local build initially required elevation for Windows path canonicalisation.
- Hosted migration rollback, persisted migration receipt and full post-release state comparison: PASS. Wallet revision 48 to 49 changes only additive pack versions/active-offer list. Balances, grants, cards, serials, lifetime allocation, receipts and previous products unchanged.
- Hosted two-member rollback replay: base 71.24 points produced saved-card totals 78.96 and 78.36. Actual retained NFL statistics; synthetic one-yard correction verified separately. No genuine member results or human team changes created.
- Ordinary-member hosted browser: draft/save/enter/reopen, mode isolation, concurrent retries/conflicts, direct admin denial, rules links/direct refresh, NFL filtering, mobile overflow, accessibility and controlled network outage/recovery passed. QA entries cleaned with audit history preserved.
- Local synthetic browser: pack purchase/open retry and reveal restoration, marketplace transactions, commission/free-window behavior, interrupted request recovery, 360/412/1440 layouts, accessibility and console checks passed. This is not physical Android evidence.
- Public-domain boundary suite: 15 passed, including exact deployment identity, HTTPS/www, callback/origin checks, private API denial and closed registration.
- Known-secret scan: zero findings/errors; client boundary check passed. No new privileged browser or APK credentials.

Candidate review found and repaired a missing Play rules link, starter-panel equal-scoring copy and narrow-screen table overlap. A final pre-game leaderboard row now shows the viewer's confirmed entry without assigning rank/points before results exist.

## Review links and Android

- https://docked.com.au/fantasy/play
- https://docked.com.au/fantasy/scoring/how-it-works
- https://docked.com.au/fantasy/cards
- https://docked.com.au/fantasy/results
- https://docked.com.au/fantasy/test-wallet#packs

v22 (1.21-beta), package au.com.docked.app.preview, loads the accepted domain. Close/reopen the installed app with a connection; no uninstall, data clear or APK update is required. No native files changed. Physical S24 acceptance remains pending.

Before/after images and screenshots of Play, Cards, Results, rules, market, selected team and wallet are in `qa/barry-review`. `modified-application-files.txt` lists the exact application/migration changes. Receipt `.rerun` files retain initial attempts; successful replacement evidence is in the normal JSON files.

## Remaining limitations

Barry's original loading root cause is unconfirmed. Controlled failures and recovery are verified; please report the screen and time if the original stall returns. Opponent/injury/recent-score fields without verified data stay unavailable. No injury is inferred from the roster INA code. Historical rules/results are unchanged. Genuine upcoming Week 6 results await games; the existing new-entry deadline remains 16 October 2026 11:15am Australia/Sydney, with each selected player's own kickoff displayed. Owner visual review and physical S24 testing are not signed off by automation.

## Final release identity and rollback

- Branch: `pivot/fantasy-cards-preview-v1`.
- Application commits: `b9dd8b4d` (core fixes/migration), `c499deee` (Play link/starter copy), `fec31497` (mobile tables), `fba1ae08` (confirmed pre-game entry row).
- Final deployment: `dpl_7WLNn8tA9Wdzz2ZJympK9CroCgba`, web commit `fba1ae08a16882c91b47e9cb712b6b36e2933f49`.
- Review URL: https://docked.com.au/fantasy/play (existing invited-account admission).
- Previous accepted release: `dpl_9VGsX1b4EtQyqJoJLRoigdnxqB6V`; original pre-review release: `dpl_EtPaDiF7DPLTXwify5Sou2ebMb3J`.
- Emergency web rollback: promote the appropriate recorded prior deployment in existing Vercel project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, then rerun domain identity/admission checks. `rollback.json` and `rollback-initial.json` preserve both stages. No DNS/email changes are needed. Retain additive DB read functions and every new receipt; do not restore an old wallet snapshot.

The immediate post-promotion identity check may observe the previous deployment while aliases propagate; final acceptance requires the exact candidate identity and is recorded in `domain-boundary.json`.

## Screenshot review

[Before Play](qa/barry-review/before-play.png) · [Released Play](qa/barry-review/domain-play.png) · [Released collection](qa/barry-review/domain-cards.png) · [Rules](qa/barry-review/domain-rules.png) · [Entered Salary Cap team](qa/barry-review/salary-domain-mobile.png) · [Confirmed-entry Results](qa/barry-review/points-domain.png) · [Wallet](qa/barry-review/local-wallet/wallet-412.png).

Final propagated domain identity, navigation and team-journey receipts all passed at the final web commit. Local evidence does not establish physical-device acceptance. Existing untracked `artifacts/android/Docked-v20-Samsung-install.txt` was preserved untouched.
