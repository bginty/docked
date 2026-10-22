# Docked private multi-sport beta — 23 October 2026

The NBA, AFL and NRL **fictional private-beta experience is deployed to [docked.com.au](https://docked.com.au)** within the existing Docked application. It shares authentication, navigation, the test-credit wallet and settlement services with NFL. This is not a verified real-player launch and does not meet the real-roster or authenticated hosted acceptance criteria yet.

## Release

| Item | Result |
| --- | --- |
| Live application commit | `fe5a6b24070cb2e358322c8945ca8885b134750e` |
| Vercel deployment | `dpl_2ghyNJsCsiRgxitaZfaN6B4gRBkg`, READY, Production target |
| Staged URL | https://docked-production-jihtuv5qt-briant-s-projects.vercel.app |
| Live domain | https://docked.com.au |
| Application checkpoints | `7625f75e` implementation; `0e8eab0c` integrated pack verification/release control; `a9066d17` owner operations; `fe5a6b24` offer filtering/recovery verification |
| Statistics repository | `4251632`, including roster validation implementation `0330912`; clean working tree, no configured remote to push |
| New-sport real feeds/schedules | Disabled |
| Permanent new-sport card issuance | Disabled |
| Public registration | Closed; verified on the live domain |

Application changes are committed and pushed to `codex/member-platform-updates`. The subsequent evidence/documentation commit does not change the deployed application. Existing unrelated working-tree files were preserved rather than included in this release.

## What testers can use

After normal sign-in and required MFA, use the existing sport selector to choose NBA, AFL or NRL. Each sport has its own Play and Cards views, test packs and marketplace. The global credit balance remains shared. Select NFL to return to the existing experience.

| Capability | NBA | AFL | NRL |
| --- | --- | --- | --- |
| Restricted sport switching, Cards and Play | Implemented, locally tested, deployed and enabled for admitted testers | Same | Same |
| Formation | Approved 8: PG, SG, SF, PF, C, G, F, UTIL | Approved 22: 6 DEF, 8 MID, 6 FWD, 2 RUC | Provisional 13-player test formation |
| Salary Cap / Open | Approved protected-test $5.2m NBA configuration / uncapped Open | Explicit QA salary units; final commercial cap unapproved | Explicit QA salary units; final roster/cap unapproved |
| Real players newly verified and loaded | **0** | **0** | **0** |
| Fictional catalogue | 24 players | 44 players | 26 players |
| Free lineup inventory | Available to admitted testers | Available to admitted testers | Available to admitted testers |
| Nine-card Standard / Premium test packs | Implemented, locally tested, deployed, test commerce enabled | Same | Same |
| Collection, test serials and artwork | Shared collectible renderer; basketball silhouette | Shared collectible renderer; guernsey silhouette | Shared collectible renderer; rugby jersey silhouette |
| Fixed-price sales, private offers and swaps | Implemented, locally tested, deployed, restricted test economy | Same | Same |
| Lineup validation, save/edit, rollover and historical snapshots | Implemented and tested in isolation; deployed | Same, all 22 slots | Same, provisional 13 slots |
| Scoring, DNP, corrections and rankings | Versioned weekly, multiple games; synthetic verification | Versioned provisional rules; synthetic verification | Versioned provisional rules; synthetic verification |
| Real fixtures/statistics and automated updates | Blocked; disabled | Blocked; disabled | Blocked; disabled |
| Authenticated Production journey | **Not verified** | **Not verified** | **Not verified** |

“Enabled” above means the application and database gates permit the approved test accounts. It is not a claim that a member successfully completed a hosted purchase, trade or competition week during this work.

Test packs use the existing nine-card prices: Standard **700** test credits and Premium **5,000** test credits. Existing probability tables are reused and paid/test purchase pools exclude Core. Purchases consume the tester's existing shared beta credits; no credits were added by this deployment. No test purchase or sale was executed against a real member account during verification.

Fictional pack cards have separate test identity/serial registries. They do not consume permanent real-player supply or become permanent collectibles. Free lineup fixtures stay separate from tradeable pack inventory. The collection labels fictional testing explicitly; no synthetic result is presented as a genuine sports result.

## Fixes and integration details

- Reused the existing NBA allowlist and verified session rules for AFL/NRL. Confirmation, admission, expiry, account status and required MFA remain server enforced.
- Connected opened test-pack cards to lineup inventory in the settlement transaction. Previously the two projections could diverge, leaving an opened card unavailable to team selection. Transfers update current ownership without rewriting locked historical selections.
- Kept canonical underlying player identity stable across free and opened cards so a second rarity/serial cannot bypass the duplicate-player rule.
- Reused existing wallet and transaction services for purchases, listings, direct offers and card-plus-credit swaps. NFL's existing eligibility and reservation rules remain in place.
- Restricted new-sport fixture commerce to the authorized test environment and matching sport. Existing sale commission remains **5%, capped at 2,000 credits, round half up**. Combined offers retain the existing swap-fee minimum. Historical fees are not recalculated.
- Removed an obsolete “7.5%” sentence from the offer review; the calculation already used the approved policy. Scoped each sport's inbox to its own cards and retained loaded offers during refresh errors.
- Kept Social attachment ownership validation at posting time. Existing shares continue to reference the same fixture card after transfer and are visible only to admitted testers; an old owner cannot share it anew as an owned card.
- Added a read-only owner operations projection to the existing readiness dashboard. It reports actual fixture counts, test issuance, product availability, pack purchases/openings, listings, sales, recorded fees, entries and competition counts, separately from genuine provider/data readiness. Owner role plus MFA are required server-side.
- Retained existing sport adapters, versioned scoring journals, roster identity/reconciliation and ingestion contracts. No additional provider or hosting subscription was purchased, and no new real-data schedule was activated.

## Tester access

The existing account identities were resolved from the database; no duplicate accounts or guessed addresses were created.

| Tester | Database readiness | Hosted signed-in verification |
| --- | --- | --- |
| Owner | Confirmed, admitted, allowlisted; MFA required | Not performed |
| Barry | Confirmed, admitted, allowlisted; MFA required | Not performed |
| Luke | Confirmed, admitted, allowlisted | Not performed |
| Brenton | Allowlisted; **email confirmation still outstanding and account not yet admitted** | Blocked by normal account requirements |

The actual in-app browser opened the live sign-in page and showed empty email/password fields. There was no authenticated session to use. Confirmation/MFA were not bypassed and a member session was not manufactured. The browser screenshot operation was unavailable; local screenshots below are explicitly isolated test evidence.

## Verification performed

| Check | Actual result |
| --- | --- |
| Platform suite, including NFL regressions | **587 passed, 0 failed** |
| Frozen database suite | **206 passed, 0 failed** |
| Final focused database verification | **4 passed**: three fixture-economy lifecycles plus stable identity/readiness coverage, including owner report permission assertions |
| Separate statistics service suite | **109 passed** |
| Final application typecheck, lint, production build | Passed |
| Client secret boundary | Documented credential test markers absent from 64 browser assets. A full canary-injected build is not claimed. |
| Local integrated Play/Cards, each new sport | Passed at 412 and 1440 px; switching, collection and no horizontal overflow |
| Local pack journeys, each new sport | Passed at 360/412/1024/1440 px, including purchase/reveal/history, errors and lost-response recovery; zero serious/critical axe findings in tested flows |
| Local marketplace, each new sport | Listing, reprice, remove, stale confirmation, buyer settlement, activity filters, lost response and retry passed |
| Local combined offers, each new sport | Create, review, accept, lost-response recovery for both commands, no debit before acceptance and one ownership exchange passed on mobile/desktop |
| Owner operations local browser | Passed at 360/412/1440 px |
| Protected candidate HTTP checks | **17 passed**, exact commit and closed registration verified |
| Live domain HTTP checks after promotion | **17 passed**, exact commit and protected API denial verified |
| Post-release runtime logs | Six authentication-error entries matched the six anonymous Play probes; no other errors observed in the checked 30-minute window. This is not a signed-in journey or long-running monitoring result. |
| Real PostgreSQL multi-connection concurrency | **Not run**: Docker Linux API returned 500 while starting. Local PGlite tests are not a substitute for this. |
| Authenticated hosted gameplay/purchases/trades | **Not run**: no signed-in member session available |

Local browser tests use the actual UI components with isolated accounts, data and transport. They are not authenticated hosted tests. A 1,000-credit combined-offer test verified a recorded 50-credit commission and 950-credit seller proceeds, exactly one ownership exchange and consistent wallet accounting after response loss/retry.

The existing heuristic repository secret scan flags eight pre-existing test/template files; this is not described as an entirely clean repository scan. No credentials or authentication state are included in these evidence files.

Machine-readable results: [verification](verification.json), [evidence index](evidence-manifest.json), [candidate checks](release/final-candidate-http.json), [live checks](release/live-http.json).

## Screenshots

All screenshots in this table show **local isolated fixtures**, not signed-in Production users.

| Sport | Play mobile / desktop | Packs | Offer acceptance |
| --- | --- | --- | --- |
| NBA | [Mobile](basketball/integrated-play-412.png) · [Desktop](basketball/integrated-play-1440.png) | [Review](basketball/packs/browser-1792702616177/review-412.png) · [Reveal](basketball/packs/browser-1792702616177/reveal-412.png) | [Mobile](basketball/market/browser-1792704719556/offer-review-412.png) |
| AFL | [Mobile](afl/integrated-play-412.png) · [Desktop](afl/integrated-play-1440.png) | [Review](afl/packs/browser-1792702735421/review-412.png) · [Reveal](afl/packs/browser-1792702735421/reveal-412.png) | [Mobile](afl/market/browser-1792704785900/offer-review-412.png) |
| NRL | [Mobile](nrl/integrated-play-412.png) · [Desktop](nrl/integrated-play-1440.png) | [Review](nrl/packs/browser-1792702735367/review-412.png) · [Reveal](nrl/packs/browser-1792702735367/reveal-412.png) | [Mobile](nrl/market/browser-1792704785903/offer-review-412.png) |

Owner operations: [mobile](operations/owner-412.png) · [desktop](operations/owner-1440.png).

## Migrations, preservation and rollback

The following six additive migrations were rehearsed with rollback and then applied to the existing Supabase project `pojoymtniryarxxunyvz`:

1. `20261022115817_nba_isolated_economy_boundary.sql`
2. `20261022122441_multi_sport_private_beta_access.sql`
3. `20261022123136_multi_sport_fixture_economy.sql`
4. `20261022124750_fixture_inventory_projection.sql`
5. `20261022203038_fixture_social_audience.sql`
6. `20261022211500_private_beta_operations_report.sql`

Each application transaction checked existing records before and after, and preserved them. The fixture preparation added isolated inventory and test rounds only. Commerce configuration changed its aggregate revision from 173 to 174; the ledger and balances did not change. No permanent issuance occurred.

The later operations verification preserved nine complete record-group fingerprints. NFL round processing changed `last_checked` and `next_check` during the running schedule. The [field-level comparison](release/nfl-round-processing-verify.json) confirmed unchanged fixture data, locked snapshots, round identity and lock times. This is why the whole NFL round table is not claimed to be byte-for-byte unchanged over time. NFL cards, ownership, entries, results, player records, wallet state and control records were preserved in the checked release snapshots.

A private application-row/function recovery snapshot was read back and hashed. It is **not** a full Auth/Storage backup and a full disaster-recovery restore was not exercised. See [recovery receipt](release/recovery-snapshot.json).

For an application regression, promote the previous deployment `dpl_H778Czde9vkrpy989DhsERJTXDjj` (`a9066d17`). If the fixture economy must be suspended, disable affected private-sport/test-commerce application gates while retaining all ownership, receipts and audit records. Do not delete additive schemas or reverse settled member transactions. The earlier pre-multi-sport deployment and migration preimages are retained in the first-release receipts for further controlled recovery. See [rollback](release/rollback.json).

## Remaining blockers and exact decisions

1. **Verified real rosters:** zero real NBA/AFL/NRL players were newly loaded. Complete, provenance-backed current roster/contract and fantasy-position batches are still required. Roster import is independent of statistics; an authorized roster-only dataset can be imported before game data. Supply the source/export and permitted use, or approve a provider arrangement that includes it. Existing stable identity/import validation should be used; do not overwrite fictional inventory with real identities.
2. **Statistics rights and credentials:** obtain written permitted use for player statistics display, fantasy calculations, historical/derived retention and the intended website/mobile/card-marketplace product, plus server credentials and adequate field coverage. Public API documentation alone does not establish those rights. The [prepared SportsDataIO request](../../SPORTSDATAIO_NBA_LICENSING_EMAIL.txt) specifies NBA requirements. No paid subscription or commercial rights have been accepted.
3. **Permanent issuance:** approve each sport's verified catalogue, eligibility and supply preview before activating permanent card issuance or commercial pack/trade features. Current test serials must remain test-only.
4. **Gameplay:** NBA rules remain the approved private-testing rules. AFL's 22-player structure is approved, but final sport-specific salary/scoring choices still require acceptance. NRL's 13-player structure and salary/scoring remain provisional. No new final rule was silently approved.
5. **Hosted ingestion:** approve the hosting/provider configuration and verify authenticated real-data scheduling, correction handling and recovery before enabling any new-sport recurring job. NFL scheduling was left running.
6. **Account/acceptance:** Brenton must complete normal email confirmation/admission. A normal signed-in owner/tester session is required to finish actual hosted gameplay, purchase, swap and social acceptance; MFA remains required where configured.
7. **Concurrency environment:** restore an isolated real PostgreSQL test environment to run multi-connection purchase/offer contention tests. Do not use live member assets as a substitute.

The remaining real-data gap is substantive: these builds do not yet let a tester browse a verified current NBA/AFL/NRL roster or see genuine new-sport results. Full NFL-equivalent real-player acceptance is therefore **not complete**. The deployed private fixture experience allows the integrated UI and test economy to be exercised while those gates remain closed.
