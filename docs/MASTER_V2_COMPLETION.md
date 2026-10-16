# Docked Master V2 — implementation and acceptance

## Changes

- `CollectibleFace` is the shared non-interactive face used by `FantasyCardArtwork`, NFL/EPL lineup tiles and player selectors. Collection, Social posts, member collections, offers, Marketplace and pack reveals inherit that face. Contextual prices, salaries, controls and detailed scoring remain outside it. The existing rarity themes, jersey illustration and verified-number provenance are retained.
- One explicit city projection and serial formatter render live text. Canonical affiliations, historical snapshots, card IDs, rarity probabilities, scarcity and scoring are unchanged. Unverified locations (including regional names and non-NFL records without explicit city metadata) use “Location unavailable”; no string-splitting or fabricated cities/numbers.
- Market now has compact search/sort, active filter chips, reset and a labelled filter sheet. Existing URL-backed advanced filters remain available. Listing information has a separate aligned footer. Nested card articles no longer inherit listing-wrapper styles.
- Social attachment selection uses a dedicated sheet, selected-card previews and explicit review/publication. Acquisition sharing now preselects the acquired card. Interrupted requests preserve the draft and idempotency key. Card loading is bounded and has an inline Retry cards action. Attachment previews span the composer width; rail previews use two readable cards.
- Existing secure avatar crop/upload/moderation/replacement/removal and premium profile functionality are preserved. The moderation menu has a recognisable accessible three-dot control. App notices now use readable dark styling.

## Scrolling defect

Independent sheets previously saved and restored `body.style.overflow` separately. An earlier sheet closing while a later sheet remained open could leave the final restoration set to `hidden`. Each sheet also listened to Back independently, while native Back selected the first dialog rather than the top one.

`modal-lifecycle.ts` now owns an ordered registry and a single body-scroll lease. Only the last release restores the original overflow. Cleanup is idempotent; Back dismisses the top sheet; focus restoration ignores detached triggers and respects any remaining modal. The focus trap runs only for the top dialog. The card picker no longer creates a second capped inventory scroller inside the feed.

This lifecycle defect was reproduced and regression-tested. The reported Samsung Social video was not available in the current attachments, so this is not a claim of reproducing that exact recording or testing a physical S24.

## Verification

- Full platform suite: **386 passed**, uninterrupted (`platform-tests.txt`).
- Full database suite: **158 passed**, uninterrupted (`database-tests.txt`). These are repository database tests, not a claim of hosted member transactions.
- Visual/gameplay/reveal browser suite: **14 passed** in the final run (`browser-regressions-final.txt`). Includes seven-player formation, empty/invalid/entered/partially locked states, Salary Cap/Open, long names, all rarities, contrasting jerseys, enlarged text, keyboard focus, reduced motion, nine-card progression, rapid taps, Skip/reopen and delayed compositor behavior.
- Isolated Marketplace acceptance: **8 groups passed** (`market-final.txt`), including URL filters, no results, error/session recovery, privacy, original purchase-receipt recovery and responsive/Axe checks.
- Pack recovery: **4 groups passed** (`pack-flow.json`). Uses actual React/domain code with synthetic in-memory HTTP. Lost response and reload recover one purchase/opening; all nine stages settle; replay/Skip do not charge or issue again. This is explicitly not authenticated hosted purchase testing.
- Actual local GoTrue/PostgreSQL security and avatar checks passed before the V2 screen-matrix checks: owner AAL1 denial/MFA approval, ordinary-member denial, discussions/community restrictions, private avatar upload/crop/moderation, cross-account/anonymous denial, replacement/removal/reload persistence and broken-image fallback. Preserved in `auth-security-and-avatar.json`; the enclosing run failed later and is not called a full pass.
- Final authenticated local journey: **passed**, including actual touch-start/move/end scrolling, attach/remove/cancel, network-failure retry with the same idempotency key, and one successful publication (`authenticated-journey-final.json`). A separate final capture pass also passed (`authenticated.json`): eight surfaces at 1440/1024/412/360, no page overflow and no serious/critical desktop Axe findings. Physical-device acceptance remains pending.
- Typecheck, lint, clean production build and client-canary boundary checks passed. Eight focused modal/city/network tests also passed after the recovery changes.

## Failed and retried checks

The initial browser suite had two failures: short-screen reveal padding overrode dedicated reveal sizing (fixed), and an older pack-link assertion omitted the existing `?view=packs` query (corrected). Final suite: 14/14.

Authenticated attempts exposed: an isolated fixture missing Fantasy enablement/consent (fixed locally without changing app gates); a failed post response retained as a failed run; one screenshot write error (each run now has its own evidence directory); cold development-route assertion timing; a CDP synthetic-scroll helper that did not move the page (replaced with explicit touch-start/move/end events); and an actual low-contrast Play notice (fixed). Intermediate failures are retained, not counted as successful complete runs.

## Security and data boundaries

No new database migration, account grant, member asset change, financial activation or policy change is part of this UI release. Local mutations use isolated synthetic accounts and balances. Real-money redemption, bank settlement, real-document collection, public signup and live trading remain disabled. Owner MFA and ordinary-member login behavior are unchanged.

The raw secret scan remains **FAIL with nine known matches**. Eight unchanged fixture/generated-value matches were checked against recorded hashes. The ninth is an untracked obsolete APK capability whose prior revocation receipt matches; it was not used or included in tracked/publishable content. No scanner exclusions were added. See `secret-scan.json` and `secret-review.json`. A passing browser-canary scan is separate from this raw scanner result.

## Delivery authority

The owner’s latest instruction supersedes the earlier Preview-only release direction. **Released to the existing live beta at [docked.com.au/app](https://docked.com.au/app)** on 16 October 2026. Both `docked.com.au` and `www.docked.com.au` were verified against deployment `dpl_6vjJaVrhN3zgqT3FEz7ASrmDm85d`, source commit `3513d9f1688bd98bc8200821571731e5379d6900`.

The candidate and live site each passed ten hosted checks: exact build/database identity, invite-only admission, anonymous member-data denial, deployed card/Market/Social/reveal assets and disabled redemption. Evidence: `docs/qa/master-v2/release/candidate.json` and `live.json`. Prior live deployment is recorded in `release/rollback.json`.

This intentionally reuses the existing live beta database and accounts, not a new isolated Preview. No migrations, hosted fixture creation, member transactions, invitations or role changes were performed. Owner, Barry and Luke use their existing accounts. No additional member MFA requirement or owner MFA reset was introduced. Fresh hosted authenticated member journeys were not performed; authenticated acceptance used isolated local Auth/PostgreSQL fixtures. No new Android APK was built in this V2 web release.

## Screenshots and reference comparison

Final local authenticated browser captures are in `docs/qa/master-v2/final/` at desktop 1440, tablet 1024, mobile 412 and narrow mobile 360. They show isolated fictional QA data, not live member data. Missing verified city/number metadata is deliberately not fabricated. Local development indicators can appear in these captures.

- [Social desktop](qa/master-v2/final/social-1440.png) / [mobile](qa/master-v2/final/social-412.png)
- [Market desktop](qa/master-v2/final/market-1440.png) / [mobile](qa/master-v2/final/market-412.png)
- [Profile desktop](qa/master-v2/final/profile-1440.png) / [mobile](qa/master-v2/final/profile-412.png)
- [Cards desktop](qa/master-v2/final/cards-1440.png) / [mobile](qa/master-v2/final/cards-412.png)
- [Populated lineup desktop](qa/master-v2/final/populated-lineup-1440.png) / [mobile](qa/master-v2/final/populated-lineup-412.png): isolated visual fixtures, separate from the authenticated empty-round fixture.
- [Pack reveal](qa/master-v2/final/pack-reveal-412.png): isolated purchase/recovery fixture.

The supplied Social reference informed the navy shell, compact feed, collection showcase and suggested-member rail. The result uses live components, existing Docked branding and real counts rather than the reference's logos, invented activity or flattened card artwork. It is an adaptation, not a pixel-identical reproduction.

## Files and remaining limitations

Shared presentation: `collectible-face.tsx`, `collectible.css`, `card-presentation.ts`, `fantasy-card-artwork.tsx`, NFL/EPL lineup and selector components. Reliability: `modal-lifecycle.ts`, `fantasy-screen.tsx`, `native-bridge.tsx`, Social composer/hub/acquisition sharing. Market: `marketplace.tsx` and `marketplace.css`. Test/release helpers and focused platform/browser regressions were updated. The exact source list is in `qa/master-v2/release/changed-files.txt`. **No migrations.**

Remaining acceptance: physical Samsung Internet/system Back/keyboard/orientation behavior, fresh hosted owner/tester authenticated journeys, and an updated Android package. Raw secret scanning still reports the nine reviewed matches described above. No real-money or document-collection activation is included or approved by this release.

## Physical S24 acceptance still pending

On Samsung Internet and the installed Android shell: sign in with your existing account; attach/remove a card, preview, cancel and publish; use system Back and reopen; scroll/navigate across all five tabs; rotate and open/dismiss the keyboard; open a permitted test pack and use Next/Skip/replay; check the collection, a player detail, lineup transfer and saved entry. Browser-emulated touch/viewport evidence does not constitute physical-device acceptance.
