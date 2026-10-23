# Docked owned collection release

The CARDS page now reads actual collectible ownership, keeps free Core eligibility in PLAY, and renders a compact, paginated collection for NFL, NBA, AFL and NRL. Existing artwork, card flips, scoring multipliers, purchase services and ownership rules are reused.

Application commit: `88094d578aa82bbf0a0945a11f4408bd2ab8ea33`.

Release status: **Deployed to https://docked.com.au**. Vercel deployment `dpl_Gnmjv9vJi5SmxNpXmZjpEAwHr1q9` is READY and the live release endpoint reports the application commit above. Deployment URL: https://docked-production-7feddrrte-briant-s-projects.vercel.app. Registration remains closed; existing private-beta gates are retained.

## Ownership correction

The former private-sport Cards view reused PLAY's sandbox inventory, which contains the free Core player catalogue and initial gameplay fixtures. It therefore presented eligible selections as owned cards. NFL's collection also loaded the complete fantasy state instead of a focused inventory page.

The new authenticated endpoint reads the two existing ownership sources: `beta_fantasy.cards.owner_id` and the settled card ownership ledger in `credits_sandbox.state`. Unopened entitlements, unrelated members' cards and free-selection inventory are excluded. Recorded starter/Core grants and legitimately purchased non-permanent beta cards remain visible. Current ledger transfers take precedence over stale legacy identities. No records are deleted, reissued or transferred.

Independent read-only Production queries reconciled these complete owned counts:

| Account label | NFL | NBA | AFL | NRL |
| --- | ---: | ---: | ---: | ---: |
| Owner | 163 | 9 | 18 | 9 |
| Barry | 131 | 0 | 0 | 0 |
| Luke | 116 | 0 | 0 | 0 |

These are ledger observations, not signed-in browser acceptance. Only returned admitted account labels are listed. Rarity counts reconcile independently and cover the entire selected-sport collection, not the visible page. Owner NFL includes 14 genuinely owned Core cards; freely selectable players do not add to it.

## Collection experience

- Compact NFL/NBA/AFL/NRL selector and My Cards/Packs tabs, with My Cards as the default.
- Two cards per row on mobile, four on desktop, preserving the canonical card artwork.
- Horizontal rarity chips with full owned counts; debounced name, team/city and serial search.
- Position/team/sort drawer; recently acquired, rarity, name and serial ordering; reset controls.
- Eighteen server-filtered cards per page. Stable ordering includes card ID, and cursors bind to the account, filters and inventory revision. Transfers between pages reset pagination rather than duplicating or omitting cards.
- Card details and Packs load on demand. Existing purchase/reveal/history and weekly/original starter-pack services remain accessible. No pricing or issuance activation changes.
- Private cache is memory-only and account-scoped. Mutations, focus/resume and access failures invalidate it; visible collections also revalidate every 30 seconds. Cached previews require current server confirmation before actions become available.
- Corrected the existing card-detail sale-eligibility request to include the card's sport.

## Performance evidence

Previously the Owner's Cards data included 550 NBA, 607 AFL and 372 NRL gameplay cards. Actual settled ownership is 9, 18 and 9 respectively. Raw database JSON comparisons:

| Sport | Previous whole gameplay-card JSON | New owned first-page SQL response |
| --- | ---: | ---: |
| NBA | 651,145 bytes | 14,993 bytes |
| AFL | 689,583 bytes | 28,623 bytes |
| NRL | 426,622 bytes | 14,637 bytes |

These are measured database JSON sizes, not authenticated HTTP transfer sizes. The application further projects those records to preview fields. Full statistics, card backs and the full wallet/fantasy state are not fetched for every collection card.

The SQL extracts the shared credits document's relevant sections once, then filters ownership and constructs only the visible page. Existing owner, card-history and pack-item indexes are sufficient; no speculative indexes or RLS changes were added. Owner query samples took approximately 96–136 ms including the database network round trip. The query-plan evidence includes an earlier **unreleased query prototype**; its 6–8 second times are not a claimed previous live-page baseline.

Isolated Chromium browser acceptance used 412×915 with 4× CPU throttling and a 180 ms simulated collection response, plus unthrottled 1440×915 desktop:

| Measurement | Observed |
| --- | --- |
| Earlier Cards fixture | 4,008 ms; 36 rendered cards; 328,845-byte gameplay response |
| New first mobile visit | 3,357 ms |
| Subsequent mobile sport visits | 1,505–1,600 ms |
| Desktop visits | 425–617 ms |
| Cached sport content visible | 109 ms |
| New collection fixture responses | 7,010–8,432 bytes; 18 rendered cards |

The earlier fixture contains 600 gameplay items; new fixture collections have 72 owned items and serve 18. Cold/warm cache and sport differences mean these timings are not a controlled production A/B benchmark. The two-second cold-start target is not consistently demonstrated. Physical Samsung frame-rate/memory measurements and authenticated hosted collection timings remain unverified.

## Verification

- 603 existing platform tests passed, plus two new collection unit tests run separately.
- 22 targeted database tests passed: ownership, account/sport isolation, transfer invalidation, unopened-pack exclusion, 99-card pagination per sport, NFL seven-player scoring, NBA rarity V2, AFL 22-player lineups, private-sport access, marketplace settlement, weekly Core and runtime permissions.
- Eleven isolated browser acceptance checks passed, including all four sports at mobile/desktop, card flips, filtering/search, pagination, transfer removal, cached switching, empty state, retry, access revocation and revision reset.
- Existing pack purchase/reveal tests passed for all four sports at 360, 412, 1024 and 1440 pixels. Repeated taps and lost-response retries delivered nine cards once; no serious accessibility findings were reported.
- Typecheck, lint, clean production build and canary client-secret boundary scan passed.
- Production migration rehearsal, application and privilege checks passed. Stored fingerprints showed no migration changes to credits state, cards, ownership events, entries, results, competitions, sales, packs, sandbox inventory or NFL control.
- All 27 protected-candidate and 27 live HTTP checks passed, including release identity, closed registration, denied private APIs and functioning page routes.
- Sixteen actual signed-out Production browser checks passed: Cards and Packs for all four sports at 412 and 1440 pixels. Sign-in recovery appeared without exposing private inventory or leaving the loading screen stuck. This is not authenticated collection acceptance.
- Post-release fingerprints matched the pre-migration state for all ten protected data groups, including wallets, ownership, packs, teams, results and NFL control; see [integrity verification](release/post-release-integrity.json).

Sources: [test manifest](tests.json), [collection browser evidence](browser.json), [database measurements](release/performance.json), [migration application](release/database-apply.json), [live HTTP checks](release/live-http.json), [hosted browser checks](release/hosted-browser.json), and pack results for [NFL](packs-nfl.json), [NBA](packs-basketball.json), [AFL](packs-afl.json), [NRL](packs-nrl.json).

## Screenshots

The screenshots show the actual shared React components with **isolated sample ownership**, not a signed-in Production account.

| Sport | Mobile | Desktop |
| --- | --- | --- |
| NFL | [412 px](nfl-412.png) | [1440 px](nfl-1440.png) |
| NBA | [412 px](basketball-412.png) | [1440 px](basketball-1440.png) |
| AFL | [412 px](afl-412.png) | [1440 px](afl-1440.png) |
| NRL | [412 px](nrl-412.png) | [1440 px](nrl-1440.png) |

[Previous Cards fixture](before-412.png).

## Migration and recovery

`20261023022240_owned_collection_read.sql` adds one private, read-only function. It validates the admitted active session and sport gate internally; only the existing server runtime role may execute it. Public, anonymous, authenticated-client and service roles have no execution grant. Client queries cannot select an owner. API responses are private/no-store.

A 15.3 MB private application recovery snapshot was saved and read back successfully before applying the migration. It contains relevant application rows and function definitions. This is not a full Auth/Storage backup or a restoration-tested disaster-recovery archive; see [snapshot receipt](release/recovery-snapshot.json).

Rollback: promote the captured prior deployment `dpl_Cd4wPZcFJJJNSY85VLuT2aMZYPxi`, application commit `a2fdd38a703cb50946424812aa4e432b28614489`. The additive function may remain unused; no ownership, wallet or scoring data rollback is required. The existing release script records the exact candidate and baseline and rejects a changed live baseline.

## Remaining acceptance limits

No authenticated Production browser session was available. Signed-in live collection/pack purchase acceptance therefore remains unverified; no live customer purchase, swap, grant or balance mutation was used for testing. Physical Android performance also remains unverified. The underlying shared credits document is still monolithic; a future growth-driven projection/index change may be warranted, but this release deliberately reuses the established ownership ledger.

NFL and NBA scoring contracts, all multipliers, permanent supply, existing wallet/marketplace accounting, account permissions and ingestion schedules are unchanged. This release introduces no new commercial activation.
