# Fantasy field, points and sandbox marketplace UX — 10 October 2026

Owner login is manually confirmed working. No reset or MFA setup was repeated. **Owner visual approval and physical Samsung S24 acceptance remain PENDING.** This report does not turn owner login acceptance into gameplay or launch approval.

## Implemented

- Login defaults to `/app`, preserving identity/onboarding gates and resolving to Play. Five tabs and existing brand assets remain.
- Play separates the latest scoring round from the next editable entry. Existing saved scoring lineup is shown first where available. Weekly/season fantasy points, round rank, championship standings and daily participation rewards remain distinct. Server ranks/ties are preserved. Season points total all the user's entered rounds in that season, not an invented league rank.
- Sport preference is stored on the device under the account ID. Football uses the existing 11-player 1 GK / 4 DEF / 4 MID / 2 FWD configuration. Other sports show unavailable setup. No FPL captain/chips/budget or SuperCoach squad sizes were imported.
- Tap-first field and accessible list views, owned-card search/rarity filtering, replacement, unselected reserves, validation, unsaved changes and confirmed server save/retry. Selecting owned cards is free. Reserves do not score and are not automatic substitutes.
- Player sheet: full name, team, position, catalogue status, permanent edition/serial/supply, ownership provenance, historical round score and breakdown where present. Missing authorised fixtures/availability are explicit. Rarity never changes scoring.
- Additive beta read model returns the owner's entry snapshots and immutable round scores. It retains exact-owner/AAL2/admission gates. It never reconstructs a historical lineup from current holdings. Original snapshot position/tier/player identity drive history; descriptive player names/team/artwork use catalogue metadata and are not represented as a historical news archive.
- Current transfer policy remains: unresolved locked-entry cards cannot transfer; settled entry/results stay immutable. Hosted transfers remain disabled.
- Android Back dismisses a player dialog before navigation. Resume/online events refresh authoritative state; pending draft selection is retained. Native dialog supplies focus trapping, Escape and focus return. Physical keyboard/system-bar/background behaviour remains an owner device check.

## Proposed marketplace — no commercial activation

`src/core/fantasy-market-fees.ts` holds integer AUD cents. Proposed fee: 250 cents each participant, 500 cents total **per completed bilateral transaction**, never per card. Fee-free 48 hours every 28 days. Live cycle start remains null; the test schedule begins 10 October 2026 UTC.

Swap means cards both ways with no sale price. Sale means one card for an agreed mock AUD price. Bundle means several cards under one bilateral agreement, optionally with a mock price. All three incur the same per-trade fee once. Browsing, listing, rejections, cancellations, failures and lineup changes do not incur this fee.

Protected Preview exposes only a server-time illustration and disabled confirmation. POST execution always denies. `sandbox/fantasy-market.sql` is **not a migration and is excluded from the deployment export**. It runs only in disposable local QA databases, using synthetic cards and mock balances; no service/payment credentials.

The local transaction engine binds both participants' consent to an immutable, expiring quote, offer terms, ownership revisions and policy version. Expiry is capped at the next fee boundary. Changed fees/terms require a new quote and both consents. Transactions serialize, validate balances/locks/ownership, and atomically update mock price/fees/cards/receipt/history. Repeated confirmation returns the same immutable receipt. Payment failure leaves no partial ownership or fee updates. This is a tested sandbox proposal, not a production marketplace implementation.

## Evidence boundaries

Local unit/database/browser, real loopback PostgreSQL races, hosted restricted-role SQL and protected hosted HTTP checks are recorded separately in `qa/fantasy-ux`. Local UI screenshots visibly disclose either authored fixtures or a real isolated hosted QA snapshot rendered locally. They are not claimed as owner-authenticated browser screenshots.

No new FPL/SuperCoach attachments were available in this task's current files. Layout follows the written interaction brief and existing Docked fantasy assets, with no copied competitor artwork.

## Launch gaps

1. Authorised sporting fixtures/statistics/results, mapping, correction handling and operational scoring are not connected. Current football catalogue and deterministic scoring are fictional QA, explicitly labelled.
2. Active approved AFL/NFL/other sport squad, position, eligibility, bench/substitution, deadline and scoring configurations are still required. The existing NFL module is preserved; it is not an operational game.
3. Marketplace production wallet/payment/refund/dispute integration, commercial/policy approval and explicit live epoch/activation are outstanding. All hosted execution remains off.
4. Owner gameplay walkthrough, visual approval and physical S24 acceptance remain separate pending gates. External beta admission, public registration, paid services and public launch are not authorised by this milestone.

## Owner S24 checklist

1. Review the Play, field selection, points, card-detail and market screenshots; approve the visual direction or identify changes.
2. Install the connected v12 QA APK over v11 (do not uninstall or clear app data). Use the existing owner login/MFA; complete Vercel protection if requested.
3. Check Play's current round versus Pick Team's next editable round. Tap a position, search, select/replace, save, refresh and reopen; confirm the XI persists. Review a previous round and its player breakdown.
4. Check all five tabs, full names, list view, keyboard/search, Android Back, system bars and bottom navigation. Hosted Market must not execute a trade or charge.
5. Background/reopen, go offline/reconnect and sign out. Report these physical results separately from visual approval and the already accepted login.

Release URL, APK checksum/link and final executed counts are appended after verification. Production holding page, authentication policies, historical records and scarce supply limits remain unchanged.
