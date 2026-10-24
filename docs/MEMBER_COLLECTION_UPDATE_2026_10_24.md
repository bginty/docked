# Docked member collection update

Implemented locally for NFL, AFL and NRL. **Not deployed. No production records, balances, inventory, entries, prizes or activation settings were changed.** NBA remains hidden. This release does not alter scoring, pack pools, rarity probabilities, lifetime supply, deposits, withdrawals, KYC or push services.

Implementation commit: `2c0f23c3` on `codex/member-platform-updates`.

## Changes by requirement

| Requirement | Implementation and verification |
| --- | --- |
| 18 AFL jerseys | Two configurations in `afl-jerseys.ts` feed the existing shaded `PlayerJersey` renderer: six angular designs and twelve horizontal designs. Existing stable team keys and aliases resolve identity. Numbers remain dynamic, including a numberless fallback. NFL/NRL geometry is unchanged. Old social/transaction artwork snapshots retain their earlier presentation. |
| Shared navigation | `NavigationShortcut` provides full and compact navy panels, blue icons, chevrons and visible focus. Applied to Profile, Wallet, Play, Rankings, Prizes, Social help/announcements and pack completion/collection links. Links remain links; purchase, copying and disclosure controls remain buttons. No global anchor restyling. |
| Profile ownership | A new private read service uses the same `owned_collection_page` projection as Cards. Counts include owned listed cards and exclude transferred cards, unowned catalogue players and unopened allocations. Rarity totals use the same inclusion policy. Confirmed entries and completed opening events are counted independently by sport. |
| Mobile Profile | NFL/AFL/NRL selection sits inside Collection & record. Two compact statistics columns at narrow widths, with Packs opened spanning the row; history is separate navigation. Account shortcuts now wrap into usable rows instead of narrow text columns. |
| Support | Exact requested support copy, `mailto:support@docked.com.au`, and Copy email with accessible success/failure feedback. No account details are appended and no email was sent. |
| Multiplier badges | AFL/NRL use the existing shared rarity badge and authoritative configuration. Saved applicable multipliers remain respected. This is presentation only: no score recalculation or extra multiplication. |
| Salaries | Versioned AFL $13.8m and NRL $8.2m Traditional rules reuse the approved rarity salaries; All-Star is uncapped. Existing NFL $4.4m remains unchanged. Exact-cap and over-cap validation, historical guards and positional feasibility were tested. Old QA rules keep their units and labels. |
| Prizes | Four inactive, versioned sport/mode templates contain the requested credit and pack rewards. The existing prize editor can load them as drafts. Shared rendering handles credits plus packs at second place. A guarded reward engine reuses the credit ledger and pack allocator, with deterministic item IDs, correction holds and partial-failure retries. Database tests persist rewards and open one without disturbing the others. No automatic award trigger or production award operation is enabled. |
| Coupons | The existing coupon UI is available for AFL/NRL; admin sport selection includes NRL. Quotes and purchases retain exact product eligibility. NFL-only campaigns remain NFL-only. All six product variants use the existing catalogue, validation and purchase transaction. |
| Credit-sales only | Offers/swaps and private-offer creation/acceptance are blocked at customer command boundaries, including isolated-fixture paths that previously bypassed the restriction. Customer offer actions are removed. Credit listings, edits, cancellations, purchases and historical records remain. |
| Pack routes | `/fantasy/cards?tab=packs&sport=afl` is the canonical Buy Packs route; `packs=mine` and `packs=history` select subviews. Shared helpers preserve sport. Legacy `/fantasy/packs` and wallet pack routes redirect to the equivalent canonical view. Query-only navigation now updates state, including Back/Forward. |
| Buy another pack | Completed reveals offer the same product through a fresh availability/balance check and explicit purchase confirmation. Clicking the action does not purchase. A new confirmed purchase has a new idempotency key; retries retain their operation key. Unsupported free/reward equivalents use Browse packs. Real unopened entitlements drive Open next pack. Cards remain visible in the result. |
| Friendly labels | Internal test-season identifiers render as friendly test-season labels. Traditional/All-Star and sport-specific Week/Round wording are preserved. |

## Root causes

**Profile totals:** Profile counted cards from its general fantasy-state response. That response did not include the same current isolated and permanent inventory projection used by Cards. It also displayed an account-wide history link where a numeric sport-specific opening count belonged. The new server aggregation shares Cards' ownership source, scopes to the authenticated subject and counts opening events separately. Failed requests show Retry rather than zero; aborted requests cannot overwrite a newer sport.

**Pack navigation:** Multiple URLs addressed the same experience, while client state effects watched the pathname but not query-only changes. Moving between wallet shortcuts and pack subviews could leave the URL, selected sport and visible subview out of step. Canonical route helpers, server redirects and reactive query tracking resolve this. A small Suspense-isolated query observer avoids suspending the public application shell during prerendering.

**Offers returning:** The private-fixture path was treated as an exception to the credit-sales restriction. The shared customer-command guard now applies before that branch. Underlying historical settlement code remains for retained records and regression tests, but cannot be reached to create a new customer offer.

## Evidence

These are local browser tests of the actual React components against isolated APIs and test-economy state, not authenticated hosted acceptance.

Final executed results: **618/618 platform tests, 221/221 database tests, and 3/3 focused prize tests passed**. The focused prize run adds all podium combinations after the full platform run. TypeScript, full lint and the production build passed. The suites include existing NFL regression coverage; no production purchases or awards were used as tests.

- [All 18 AFL mappings](qa/member-collection-update/afl-all-18.png), [all six rarity frames](qa/member-collection-update/afl-six-rarities.png), [AFL card back](qa/member-collection-update/afl-card-back.png).
- Profile and shared navigation: [320px](qa/member-collection-update/profile-320.png), [375px](qa/member-collection-update/profile-375.png), [390px](qa/member-collection-update/profile-390.png), [430px](qa/member-collection-update/profile-430.png), [desktop](qa/member-collection-update/profile-1440.png).
- Completed pack actions: [NFL mobile](qa/member-collection-update/packs/nfl/completed-412.png), [AFL mobile](qa/member-collection-update/packs/afl/completed-412.png), [NRL mobile](qa/member-collection-update/packs/nrl/completed-412.png), [desktop](qa/member-collection-update/packs/afl/completed-1440.png).
- Fresh purchase review: [AFL](qa/member-collection-update/packs/afl/repeat-review-412.png), [NRL](qa/member-collection-update/packs/nrl/repeat-review-412.png).
- Machine-readable evidence: [Profile/artwork](qa/member-collection-update/browser.json), [nine card journeys](qa/member-collection-update/cards/browser.json), [long names/missing numbers](qa/member-collection-update/cards/browser-edges.json), [catalogue positional feasibility](qa/member-collection-update/positional-feasibility.json), [security findings](qa/member-collection-update/security.json), [test summary](qa/member-collection-update/verification.json).

Profile tests cover all five widths, recoverable failures, delayed responses, sport switching and clipboard success/failure. The displayed 18-card sample is explicitly synthetic test data, not a claim that a live account was inspected after deployment.

Card tests cover NFL/AFL/NRL, six rarities, flips, reveals, collections, missing numbers and long names. Pack tests cover all six products per sport, 412px/1440px, repeat confirmation, cancelling without a charge, duplicate taps, retired products, Back and refresh. Wallet and ownership mutations occur only in isolated fixtures.

The retained 2026-10-23 roster catalogue admits distinct-player 22-slot AFL and 13-slot NRL formations. All-Rare lineups fit; 16 Rare plus 6 Ultra Rare equals $13.8m, and 9 Rare plus 4 Ultra Rare equals $8.2m. All-Ultra-Rare lineups exceed the caps. This establishes positional and budget feasibility against that snapshot, not ownership or current eligibility for every member.

The repository-wide secret heuristic reports eight existing findings in unchanged development/test files. No findings occur in changed source files. This is not a claim of a clean repository-wide security scan or an authenticated hosted security audit.

## Migrations and future entries

Apply only after release approval, in this order:

1. `20261023234346_member_collection_record.sql`: read-only member aggregation; execute granted only to the existing server role. No ownership, pack or wallet updates.
2. `20261023234740_approved_afl_nrl_future_rules.sql`: two new lineup configurations, four inactive prize templates, and an owner/MFA-protected salary-adoption function. Existing competitions are not updated automatically.
3. `20261024000314_australian_prize_preparation.sql`: permits tightly scoped salary-version adoption on empty future rounds; supports AFL/NRL prize drafts and combined reward display; requires a saved active policy with a tie decision before publication; extends owner reporting. Existing schedules and results remain untouched.

The salary adoption function accepts a competition ID and an audit reason of at least 12 characters. It refuses past/locked/scored rounds and any round with drafts, entries or slot locks. It changes only the salary lineup version under the existing advisory lock. It does not enable the competition or alter its scoring/prize policy.

Read-only inspection found ten future unscored AFL rounds on the old QA version, with five drafts and one confirmed entry across them, and ten future NRL rounds with no drafts or entries. These observations must be refreshed before adoption. **Do not bulk-adopt all AFL rounds.** Keep occupied rounds under their saved rules or obtain an explicit migration decision for affected entries; this release does not rewrite or invalidate them. Empty future rounds may be adopted individually after review.

No scheduled-job change is required for the Profile, artwork, coupon or routing updates. Existing weekly starter-pack schedules and NFL ingestion remain unchanged.

## Prize activation blockers

No approved AFL/NRL tied-place policy was found. The templates keep `active=false` and `tiePolicy=null`. Do not infer split credits, duplicated packs, skipped places or an expanded prize pool. The owner must decide how ties affect both credit and pack awards.

Before enabling an award runner, save the approved eligibility/finalisation/tie policy on a future competition, approve that prize-bearing round, and bind the trusted final-results source to the tested reward transition through the existing locked store. No customer-supplied placing, finality, eligibility or reward context may be accepted. The transition and database persistence are tested locally; this authoritative result-to-runner binding and hosted award acceptance remain gated work. No new production cron, endpoint or award execution is enabled by this release.

Once authorised, test failure after a completed credit item but before pack issuance, then resume using the same deterministic reward IDs. A revised finalisation snapshot must enter review, never create another payout. Keep financial journal/history and pack receipts append-only. Genuine prize credits remain subject to the existing environment and ledger policy; beta credits are not cash or withdrawable funds.

## Legacy offers

Read-only production inspection returned zero OPEN credit-economy swaps and zero OPEN private offers. The retained legacy swap table contained five expired and one cancelled record. Nothing was executed, cancelled or deleted. Retain those records. Recheck pending reservations at release time; if new pending records appear, quarantine creation/acceptance and review cancellation/release of holds separately rather than silently discarding them.

## Deployment review and recovery

No deployment or database application was performed. The latest inspected live application remains `f04a5ab92e766b1c12760586473d4694540d2b29` at `https://docked.com.au`; refresh this identity before a later release.

1. Review the committed diff and these three migrations. Record explicit deployment approval. Keep salary adoption and prize activation as separate decisions.
2. Capture the current Vercel production deployment ID and verify an accessible Supabase recovery point. Capture protected-table counts/hashes for cards, ownership, wallets, ledgers, entries/results, pack receipts, weekly schedules, sport controls and NFL feed state. Store any raw backup privately, never in Git.
3. Run `supabase db push --dry-run` against the explicitly verified project. Confirm the pending set is exactly the reviewed migrations; stop if unrelated migrations appear. Rehearse those files transactionally against a protected clone, including runtime-role checks and the Profile query. Do not use Production mutation tests.
4. After approval, apply the reviewed migrations transactionally through the existing restricted release process and record their hashes. Do not execute salary adoption, template publication, awards, grants or campaign activation as part of schema installation.
5. Build an immutable candidate from the committed source using the existing Vercel project and protected environment configuration. Verify the candidate release identity and anonymous access denials before promotion. Do not reuse an older release script's embedded activation authority or product-configuration step.
6. Verify signed-in Profile/Cards counts for the same subject and sport, pack route Back/Forward, existing entitlements, coupon reviews, mobile layouts and NFL navigation. Production customer accounts are read-only during acceptance. Exercise purchases/awards in isolated infrastructure only.
7. Promote only that reviewed candidate, then compare protected-state fingerprints and flags. Registration stays closed, NBA hidden, commercial/issuance gates unchanged, and AFL/NRL prize-bearing rounds disabled.

Application rollback: restore the captured deployment alias. The additive schema can remain with the old application; do not delete data to reverse this release. If a function regression requires reversal, restore its captured prior definition through a reviewed forward migration. Once a future round has adopted new salary rules or accepted entries, do not revert its rules silently: retain its snapshot and handle any policy rollback as a separate audited decision. Reward journals and completed pack receipts must never be rolled back by deleting ledger history.

## Remaining verification limits

- No authenticated hosted acceptance, physical Samsung-device test or installed Android-app test was performed for this candidate. Local Chromium mobile-sized checks are evidenced above.
- The production schema remains unchanged, so live Profile counts and the new endpoint cannot be claimed fixed until the approved release is applied.
- Automatic prize awards remain blocked as described above; no live prize schedule has been published.
- Actual member-owned positional feasibility must be checked per account; catalogue feasibility is not an ownership grant.
- Existing repository-wide secret-scan findings require their own classification before treating the whole repository as security-clean.
