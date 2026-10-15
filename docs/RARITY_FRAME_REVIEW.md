# NFL rarity frames — released 15 October 2026

This is a presentation-only change after release 8a585d1b. The owner subsequently requested outer reveal frames, one smooth reveal, Icon effects, and deployment for existing testers. Release is authorised after verification; the release receipt below records completion. No cards, balances, teams, catalogue records, rules or database schema are changed. The original written rarity treatment and the later physical-device reveal screenshots are the visual references.

## Working preview

Start with `node --import tsx scripts/marketplace-local.ts --serve --visual` and open:

- [All six rarities](http://127.0.0.1:3023/preview/rarity-frames)
- [Cards](http://127.0.0.1:3023/fantasy/cards), [Play](http://127.0.0.1:3023/fantasy/play), [Market](http://127.0.0.1:3023/fantasy/market), [Reveal](http://127.0.0.1:3023/fantasy/reveal)

The gallery exists only in the local fixture server, not in the deployed Next.js routes. Same-player comparisons use non-persistent synthetic data. White/gold are explicitly labelled colour studies using the generic jersey renderer; real NFL team mappings are unchanged. The other palettes use existing NFL mappings, plus the established unknown-team fallback.

## Implementation

- `src/core/rarity-theme.ts`: one shared presentation palette and frame treatment for all six rarities. No scoring or supply constants are duplicated here.
- `src/components/rarity-badge.tsx`: explicit rarity text and multiplier from `card-rarities-v1`; decorative Icon crown. Optional applied multiplier preserves saved competition context, including legacy 1.0×.
- `fantasy-card-artwork.tsx`: common collection, marketplace, wallet/replay and reveal face; existing jersey SVG, team colours, serials and details remain intact.
- `nfl-seven-play.tsx`, `fantasy-play.tsx`, `fantasy-player-sheet.tsx`: compact lineup/selector and detail treatments; all actions and eligibility logic retained.
- `pack-opening.tsx`: inherited shared accent for the existing case/effects; opening, recovery and persisted results unchanged.
- Follow-up reveal: shared rarity frame around the entire outer case, neutral inner face; one arrival wrapper owns the animation, separate from post-reveal tilt. The previous timed pseudo-back is suppressed in favour of an actual backface-hidden back/front pair. The card rotates once to an identity transform without the tilt transition replaying it. Icon adds a bounded gold halo and three small firework bursts, while retaining its pearl frame; no flashes, effect libraries or additional audio. Simple/reduced motion suppress the celebration. Each persisted card resets the presentation by receipt/index key.
- `fantasy.css`, `mobile-cleanup.css`: replace separate tier colours with crisp 3px standard/2px compact frames, dark separators, double-line Elite, angular Ultra Rare, restrained gold foil and pearl Icon. Static by default; visible keyboard focus and reduced-motion support.
- Local gallery and browser checks; existing browser tests accept a separate evidence directory so previous release screenshots are preserved. Local build helper accepts `--rarity` for separate receipts.

## Evidence

- [Desktop six-tier gallery](qa/rarity-frames/CHI-1440.png)
- [Mobile six-tier gallery](qa/rarity-frames/CHI-412.png)
- [360px / long names](qa/rarity-frames/long-360.png)
- [White jersey](qa/rarity-frames/WHITE-1440.png), [gold jersey](qa/rarity-frames/GOLD-1440.png)
- [Lineup](qa/rarity-frames/lineup-refined.png), [player profile](qa/rarity-frames/player-profile.png), [reveal](qa/rarity-frames/reveal-second.png)

Validation results are recorded in `docs/qa/rarity-frames`. Browser tests exercise application components with synthetic fixture transport, not authenticated hosted/database transactions. No real accounts or posts are used. Physical S24 acceptance and owner visual approval remain pending.

Completed checks:

- Final reveal follow-up: **13/13 browser tests passed** after outer-case frames, single-turn animation, separate tilt and Icon effects. Rotation sampled across the transition moves forward and remains settled; all six outer frames, reduced-motion suppression and zero opening mutations passed. The earlier screenshot write error is retained in `browser-first-run.json`; the rerun passed in a fresh evidence directory. Final typecheck, lint, clean build and client boundary passed. Exact source/public/config/evidence scan: 509 files, no findings/errors (later receipt count can increase).
- [Icon celebration](qa/rarity-frames/icon-celebration.png), [outer Rare frame](qa/rarity-frames/reveal-outer-1.png), [six-tier reveal recording](qa/rarity-frames/reveal-update.webm). The gallery's “Preview six-card reveal” uses existing non-persistent cards only.

- 12/12 Edge browser tests passed: six-tier gallery at 1440/412/360px, seven palettes, long names, exact fixture serials, legacy multiplier context, enlarged text, keyboard/Escape/focus and axe accessibility; existing lineup, modal, independent-draft and reveal/replay/recovery regressions. [Machine-readable results](qa/rarity-frames/browser-results.json).
- 5/5 focused platform tests passed (`card-presentation.test.ts`, `rarity-scoring.test.ts`), including jersey provenance/fallback and saved scoring corrections/negative totals.
- Typecheck and lint passed. Credential-free production build passed; canary boundary scan found no server credential markers in 55 browser assets. [Build](qa/rarity-frames/build.txt), [boundary](qa/rarity-frames/client-boundary.txt).
- Manual screenshot inspection of standard/mobile cards, compact lineups and the phone reveal. This found and corrected an inherited compact-width rule before the passing captures.
- A final focused gallery rerun also passed with explicit hover-frame preservation and real keyboard Tab focus assertions. Programmatic focus after mouse hover was corrected in the test to exercise keyboard focus-visible semantics.
- Initial sandbox Edge/build launches failed on Windows process/junction restrictions; the supported local runs outside the sandbox succeeded. No hosted fallback was used.

## Review / rollback

Compare Rare with Ultra Rare and Legendary with Icon, inspect long names and enlarged text, tap a card, and try the reveal. All rarities keep the same jersey and live text. Core remains unlimited; limited serials/caps come from each card.

No migration or data rollback is needed. The verified prior live deployment is `dpl_3nnwtajpgUqHRrELA3xnDtoaLVbq` (source `8a585d1b`). Promote that deployment through the existing Vercel project if the application release fails; never restore database data or overwrite subsequent transactions. The current Android shell's server URL is `https://docked.com.au/app`, package `au.com.docked.app`; web changes arrive on close/reopen with no rebuild or uninstall required.

## Live release receipt

Released at 11:45 Australia/Sydney on 15 October 2026. Both domain aliases point to `dpl_9BQYQsDsrjJrHjFqGYS57xD9AokK`, application source `74191226e9d957ec0930e0da496df00ed2f510bb`. Live: https://docked.com.au/fantasy/cards. The six-frame gallery remains development-only.

- Staged candidate and live checks each passed six checks: exact source/project/database binding, invitation-only registration boundary, private marketplace/activity/wallet/gameplay API denials, and deployed frame/reveal/effect assets.
- Public domain/callback/admission suite: 15/15 passed. These are anonymous boundary and asset checks, not hosted member transactions. No member data or database migrations were performed.
- The Windows CLI curl wrapper incorrectly forwarded global arguments to native curl. Candidate verification used the existing deployment-scoped one-hour private share mechanism. Its capability is stored only in ignored private-data and is omitted from evidence. Deployment protection remains unchanged.
- The existing Android shell loads https://docked.com.au/app. Fully close and reopen v22; refresh an open browser tab. No APK rebuild, reinstall or data clearing is required.
- No invitations/messages, payments, grants or member gameplay mutations. Existing economy and saved scoring rules remain unchanged.
- S24 follow-up: replay an existing saved pack, check outer rarity frames and one smooth reveal for each card, try Skip and close/reopen, inspect Icon effects if present in that saved result, and confirm reduced-motion controls. Replays award nothing. Physical-device acceptance remains unperformed.

Evidence: [candidate](qa/rarity-frames/candidate.json), [live](qa/rarity-frames/live.json), [domain boundaries](qa/friends-cutover/domain-boundary.json). Roll back only the application to `dpl_3nnwtajpgUqHRrELA3xnDtoaLVbq` using the existing project promotion workflow; preserve all database transactions and history.
