# Play and Cards redesign — local review

15 October 2026. Continues the live rarity/reveal release at `74191226` and its receipt `9bd66c75`. The two attached mockups were readable and inspected. The written brief takes precedence: the original Docked logo and generic team-colour jerseys remain; there are no numbers, names, sponsor marks or logos on jerseys.

## Preview

Run `node --import tsx scripts/marketplace-local.ts --serve --visual`:

- [Play](http://127.0.0.1:3023/fantasy/play)
- [Cards](http://127.0.0.1:3023/fantasy/cards)
- [All rarities / pagination](http://127.0.0.1:3023/fantasy/cards?scenario=all-rarities)
- [Entered team](http://127.0.0.1:3023/fantasy/play?scenario=entered)
- [Partially locked team](http://127.0.0.1:3023/fantasy/play?scenario=partial)
- [Empty collection](http://127.0.0.1:3023/fantasy/cards?scenario=empty)
- [Reveal regression preview](http://127.0.0.1:3023/fantasy/reveal)

These routes use non-persistent/sessional synthetic fixtures. Preview names, dates, balances, entitlements and states are explicitly local test data, not real members or genuine NFL results. Application requests retain their existing authenticated server routes and validations. No hosted access, database migration, member mutation, credit/card issuance, posts, messages or deployment is part of this task.

## Implementation

- Shared shell: existing logo, compact desktop sidebar, account link at its foot, grouped secondary navigation, slim page-context bar and an authenticated test-credit projection. The header uses spendable test Docked Credits from the existing wallet API, never gameplay points. Failed reads show unavailable; old/cancelled responses and mismatched member identities are rejected. Refresh on app resume, network recovery and returning to the page.
- Play: existing seven-slot builder in QB / RB-RB / WR-WR / TE-FLEX field rows. Desktop budget/actions beside the field; mobile stacks without compressing typography. Exact configured salaries have accessible labels and compact visible amounts. Entry deadline, next selected kickoff (draft) and next player lock (entered) are labelled separately. Existing save/entry/update/withdraw handlers, lock snapshots, independent mode state and player-detail controls remain.
- Cards: compact pack links; actual inventory rarity counts with toggle-to-reset filtering; search, team, canonical position, rarity and sort; mobile filter panel; grid/list views and ten-card pagination. Collection options and rules remain accessible. Limited serials/caps and unlimited Core status use actual card data. Existing detailed actions and pack history/replay remain.
- Shared artwork: removed jersey text from both artwork renderers; retained colour mapping, paths, sleeve trim, rarity themes and live player/team text. No player metadata was changed. Reveal geometry, one-way animation, Icon effects, next/Skip and persisted receipts are unchanged.

Main files: `app-shell.tsx`, `fantasy-screen.tsx`, `fantasy-play.tsx`, `nfl-seven-play.tsx`, `fantasy-card-artwork.tsx`, `fantasy-player-sheet.tsx`, `use-workspace-wallet.ts`, and the scoped `play-cards.css` stylesheet. Existing test/build helpers now accept separate evidence locations. Local fixture scenarios and browser acceptance cover the new composition.

## Boundaries and review

No database, scoring, formation, salaries, rarity definitions, pack odds or transaction engine changes. The formation remains QB ×1, RB ×2, WR ×2, TE ×1, FLEX ×1 (RB/WR/TE). Salary Cap remains 4,400,000; Open has no cap. All data comes from existing projections or explicitly isolated local fixtures.

Physical S24 testing is still required. Desktop layouts preserve readable names when a long-name/large-text lineup needs scrolling; they do not impose clipping to meet a fixed height. Browser fixture tests are not authenticated hosted transaction or physical-device acceptance.

The owner approved this preview and requested deployment for Luke and Barry on 15 October 2026. The following release receipt will distinguish the reviewed candidate from the verified live deployment. No new APK is required: the installed shell loads `https://docked.com.au/app` using package `au.com.docked.app`.

The separately authorised account operation is recorded locally and excluded from the application source release. No personal account identifiers or grant receipts are published with this visual update.

## Verification evidence

- Full relevant browser suite: **17/17 passed**, including mobile cleanup, Social confirmation, reveal/replay/Skip, single forward rotation, Icon effects and all rarity palettes. After the final display-only correction retaining the submitted entry's lock clock while editing drafts, all **4/4 focused Play/Cards checks passed again**. Reports: `qa/play-cards/browser-full-results.json` and `browser-results.json`. The added regression removes all seven local draft selections and verifies the submitted lock clock remains unchanged and incomplete Update Team is disabled.
- TypeScript, ESLint, clean credential-free production build and client-boundary canary scan passed. No runtime dependencies were added.
- Platform suite: 345 tests, 341 passed on the initial sandbox run. One subprocess exceeded its timeout and three isolated Git tests could not initialise temporary repositories under sandbox permissions. Both affected test files passed on a supported local rerun: 11/11, including all four previous failures. See `qa/play-cards/platform-tests.txt` and `platform-rerun.txt`; the initial result is not represented as an all-pass run.
- Existing seven-player SQL regression passed (1/1), using isolated embedded PostgreSQL/PGlite fixtures. This is database-model regression, not authenticated hosted acceptance.
- Browser evidence uses Edge with isolated fixture transport at desktop 1440×900 and 1366×768, tablet 820×1000, phone 412×850 and 360×740, plus enlarged text and reduced motion. No physical Android/S24 acceptance is claimed.
- Browser checks caught and repaired filter pagination restoration, missing explicit filter names, primary-action contrast, collection heading order and duplicate banner semantics. A localhost execution-context connection failure was resolved by running the fixture server in the same supported context as Edge; no hosted workaround was used.
- Targeted source/evidence secret scan passed with no findings. Existing unrelated untracked private artifacts were not used or modified.

Screenshots (synthetic preview data):

| Screen | Desktop | Phone |
| --- | --- | --- |
| Play | [1440px](qa/play-cards/play-1440.png) | [412px](qa/play-cards/play-412.png) |
| Cards | [1440px](qa/play-cards/cards-1440.png) | [412px](qa/play-cards/cards-412.png) |

The fixture banner and fictional names deliberately distinguish visual evidence from member accounts and imported NFL results. Full-page captures include content below the viewport; the fixed mobile navigation remains viewport-anchored. Long-name lineups can require vertical scrolling at shorter desktop heights.

Physical review checklist: open Play in both modes; inspect/replace an unlocked card using designated QA inventory; check saved versus submitted states; search/filter Cards and open card details; follow Open/Buy packs without accidental mutation; confirm text, scrolling, Back and touch targets on the S24. Hosted transactional testing is not part of this local visual review.
