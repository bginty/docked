Current status: **RELEASED** on the owner's subsequent deployment instruction. https://docked.com.au runs source 8a585d1b. [Live release evidence](qa/mobile-release/RELEASE.md). Earlier local-only statements below describe the prior review stage. Physical S24 acceptance remains pending.

# Mobile cleanup — local visual review

The owner explicitly authorised deploying the reviewed visual changes on 15 October 2026, with concise pack chances and Social feed fixes. Release is pending the current verification below; the earlier local-only boundary is superseded for this admitted beta update. Physical S24 acceptance remains pending. Accounts, balances, cards, teams, scoring rules and receipts are preserved.

## Review the working preview

Start/restart: `node --import tsx scripts/marketplace-local.ts --serve --visual`.

- [Play](http://127.0.0.1:3023/fantasy/play)
- [Cards](http://127.0.0.1:3023/fantasy/cards)
- [Nine-card reveal](http://127.0.0.1:3023/fantasy/reveal)
- [Social](http://127.0.0.1:3023/fantasy/social)
- [Market](http://127.0.0.1:3023/fantasy/market)
- [Test wallet / existing pack purchase flow](http://127.0.0.1:3023/fantasy/test-wallet#packs)

The loopback preview uses original application components and isolated synthetic accounts/cards. Play's draft/entry responses are browser-fixture responses, persisted in session storage for visual state review. Market/wallet use the existing domain engine over local HTTP with synthetic identity and in-memory state. **Neither is authenticated application/database end-to-end evidence.** No hosted service is contacted. Social does not publish real posts. The fixture's dates and player names are illustrative, not genuine scheduled competitions or catalogue claims.

## Changes

- Compact Play title, two-part mode control, short round selector and status badge; budget only for Salary Cap. Legacy history and owner actions are secondary. Save Draft and Enter remain separate; submitted teams show Update Team only enabled when selections differ. Withdrawal still confirms. Independent drafts, ownership checks, locks, seven-slot formation and server operations are unchanged.
- Compact jersey/card face with a central NFL team-colour treatment, readable name, rarity, position and explicitly labelled Salary Cap/Open multiplier. No logos or official uniform artwork. Full identity, lifetime supply, edition, status, rules and ownership information remains in details. Current team presentation does not mutate printed edition or identity.
- Existing NFL `shirt` values are placeholders (the allocation path writes `1`). They are **not** displayed as real numbers. A separately verified jersey-number field is supported, including zero; current payloads without it show a neutral dash. No roster-number data was invented or fetched.
- Buy/Open pack tiles above My Cards; claimed starter information is in pack history. Zero unopened packs is explicit and links to the store. Navigation alone neither buys nor opens. Existing entitlements and receipts are reused.
- Reveal uses dynamic viewport height and safe-area padding. Each persisted card gets a keyed reveal transition, including repeated rarities. Next arrow is beside the card; Skip goes to the saved summary. No identity tables or long rules in the stage. Reduced motion, sound preference, tilt controls, background recovery and replay remain available. Large text/short screens may scroll rather than clip.
- Social starts with the existing composer, editable immediately, with collapsed post options and attachments. Removed the irrelevant performance-record disclaimer on ordinary posts. Existing posting API, moderation, permissions and idempotency remain intact; a synchronous submission guard prevents double taps. Recoverable failures retain text.
- Compact purchase/list/cancel confirmations. Purchased card, amount and View card lead; durable receipt remains in Activity. Marketplace cards no longer repeat the same name/rules/identity paragraphs below the artwork.
- Optional acquisition sharing prepares a plain-text editable post, with no price, balance, receipt, counterparty or private lineup data. Only Post sends. The prompt can be dismissed and is remembered per member/acquisition on that device; replay does not create awards or automatic posts. No new social card-attachment format or unverified notable-player ranking was introduced.

## Visual evidence

Before images below are the owner's supplied physical-device screenshots. After images are local browser captures; they are not physical S24 acceptance and are not pixel-identical viewport comparisons.

| Screen | Before | After |
|---|---|---|
| Play | [S24](qa/mobile-cleanup/before-play.jpg) | [Mobile](qa/mobile-cleanup/after-play-412.png), [desktop](qa/mobile-cleanup/after-play-1440.png) |
| Cards | [S24](qa/mobile-cleanup/before-cards.jpg) | [Mobile](qa/mobile-cleanup/after-cards-412.png), [desktop](qa/mobile-cleanup/after-cards-1440.png) |
| Social | [S24](qa/mobile-cleanup/before-social.jpg) | [Mobile](qa/mobile-cleanup/after-social-412.png), [desktop](qa/mobile-cleanup/after-social-1440.png) |
| Purchase confirmation | [S24](qa/mobile-cleanup/before-purchase-success.jpg) | [Mobile](qa/mobile-cleanup/market-regression/purchase-success-mobile.png), [desktop](qa/mobile-cleanup/market-regression/purchase-success-desktop.png) |

[Consecutive reveals and Skip recording](qa/mobile-cleanup/nine-card-reveal.webm) · [second reveal](qa/mobile-cleanup/reveal-second.png) · [enlarged text](qa/mobile-cleanup/reveal-enlarged-text.png).

## Verification evidence and boundaries

- Initial cleanup platform suite: 341/344 passed inside the Windows sandbox; the only three failures were disposable Git fixture creation denied by sandbox permissions. All three passed on a scoped local rerun outside it. Combined: **344/344**, no test exclusions. [Raw run](qa/mobile-cleanup/platform-tests.txt), [permission retry](qa/mobile-cleanup/platform-permission-retry.txt).
- The initial seven browser cases passed for mobile/desktop hierarchy, card details, independent mode states, draft/entry controls, social failure recovery, every-card animation, rapid taps, no new mutation on reveal/replay, lost opening response, resumed result, single-card opening, reduced motion and keyboard/axe checks. [Report](qa/mobile-cleanup/browser-results.json).
- Additional touch/Android-like browser viewport check passed (1/1), recorded separately in [touch check](qa/mobile-cleanup/touch-check.txt). Browser emulation is not an Android emulator or physical device.
- Existing local marketplace regression passed: explicit purchase/cancel review, exactly-once lost-response recovery, retained receipt amounts, expiry, account/session error handling, stale consent, keyboard/focus/Escape, responsive layouts, console checks and WCAG A/AA axe checks. Added explicit sharing consent and failure retention. [Report](qa/mobile-cleanup/market-regression/browser.json).
- Typecheck, lint, clean-environment production build and canary client-boundary scan passed. [Lint](qa/mobile-cleanup/lint.txt), [build](qa/mobile-cleanup/build.txt), [client boundary](qa/mobile-cleanup/client-boundary.txt). The initial sandbox build could not create Turbopack junctions; the clean build succeeded outside that sandbox, with no hosted secrets.
- No database migration, hosted acceptance, new authenticated/database race test or emulator test was performed for this presentation-only pass. Existing server-side transaction/scoring logic is unchanged. Previous marketplace/database acceptance remains historical evidence, not a new claim.

## Changed-file summary

- Cards: `card-presentation.ts`, optional display metadata in `fantasy.ts` / `pack-opening.ts`, `fantasy-card-artwork.tsx`, `fantasy-player-sheet.tsx`.
- Play/Cards: `fantasy-play.tsx`, `nfl-seven-play.tsx`, `fantasy-screen.tsx`, `fantasy-rewards.tsx`.
- Reveal/sharing/social/market: `pack-opening.tsx`, `acquisition-share.tsx`, `social-composer.tsx`, `social-interactions.tsx`, `marketplace.tsx`, `member-test-wallet.tsx`, `sandbox-swaps.tsx`.
- Shell/routes/styles: `app-shell.tsx`, `app/fantasy/[tab]/page.tsx`, `app/layout.tsx`, `mobile-cleanup.css`.
- Local-only fixtures, browser/platform tests, capture/build scripts and this review document. No dependency, payment configuration, API route, database, supply, salary, pack-weight or scoring-rule changes.

## Owner review / remaining limits

1. Review Play hierarchy and both modes; try a local draft, entry and edit. Check the retained secondary actions.
2. Review card colours, long names and the neutral number fallback. Browse My Cards and open details.
3. Open the nine-card preview, reveal several in sequence, Skip, close and reopen. Check reduced motion and enlarged text.
4. Review Social and local Market success/review screens. Posting is explicit; no real member posts are authorised for this milestone.
5. After visual approval, plan a separately authorised web release and physical S24 check for browser chrome, native Back, keyboard, app reopen, scroll and touch comfort. **No visual approval or physical acceptance is claimed.**

The local preview is on this computer only. It is not a friends download or new APK. v22 continues to load the unchanged live release. No messages/invitations were sent and no real payments, prizes or withdrawals were activated. No member assets, balances or teams were used for QA.

## Player-profile refinement after owner review

The seven-slot field now shows the player name, full current-team name and multiplier. Jersey numbers/placeholders, serials, individual salaries, kickoff paragraphs and large Remove buttons are removed from the field. Locked/attention badges remain where necessary. The same card instances and rules are retained.

Tapping an occupied slot opens the existing player-details component in a compact lineup context, including fantasy salary (not a credit price or cash valuation), roster status, available saved scoring history and mapped upcoming fixtures. Unknown opponents, injuries, market values and missing scores are not invented. **Transfer** starts a free lineup replacement; **Use this player** changes the draft, and Save Draft / Update Team remains explicit. Removal is secondary inside Card details & rules. Locked players remain inspectable but cannot be transferred or removed from their locked slot.

The owned-card selector is compact and opens the same profile before selection. Position/duplicate-player/ownership/fixture/salary validation remains in the existing selection and server paths. Salary Cap replacement details subtract the outgoing salary; Open has no budget restriction. Full team names use a shared code-to-name map with an honest unknown-team fallback.

- [Refined lineup](qa/mobile-cleanup/lineup-refined.png)
- [Player profile with Transfer](qa/mobile-cleanup/player-profile.png)
- Focused presentation/lineup tests: **9 passed**. Initial focused browser pass: **3 passed**, covering profile/transfer, mode independence, saved drafts, explicit posting, locks, focus and accessibility. Final local browser results are recorded in the linked browser report. The clean production build and canary client-boundary scan passed again after this refinement; typecheck and lint also passed.

These are local fixture checks, not new authenticated database, hosted or physical S24 acceptance. No deployment or member-data mutation.

Final refinement regression: **10/10 browser tests passed**, including existing reveal/recovery flows and both new player-profile cases. Focused platform tests **9/9 passed**. Typecheck, lint, clean build and canary client-boundary check passed. Physical S24 and owner visual acceptance remain pending.

## 15 October release follow-up

Rarity chances now contain only rarity/per-card percentages; guarantees, eligible pool, exhaustion and configuration information remain accessible under Pack details. No price, weight, draw or supply change. The local visual server has no Social publishing endpoint and uses a sample feed, explaining the reported localhost posting failure. This is separate from actual live posting. The actual Social route now respects feed query parameters; Feed, Following and My posts navigation is explicit. Inline successful posts return to the feed; submission uses a synchronous double-tap guard and keeps the original key on failure. No owner/Barry posts are used for QA. Current acceptance and deployment receipts: `docs/qa/mobile-release/`.
