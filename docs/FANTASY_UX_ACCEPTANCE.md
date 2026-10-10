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

## Final delivery

- Branch: `pivot/fantasy-cards-preview-v1`. Application commit: `46eff700`.
- Protected Preview: https://docked-production-72jth6bfn-briant-s-projects.vercel.app (READY, Preview target, no aliases/custom domains).
- Connected APK: [Docked v12 Owner Connected QA](../artifacts/android/Docked-v12-Owner-Connected-QA.apk), 11,036,122 bytes; versionCode 12 / 1.11-preview; package `au.com.docked.app.preview`. SHA256: `116616c68bf9483f50b86ea312de4e7224517c2f9f90034c00641dd83c8a1c22`. Same signing certificate as v11; ARM64 compatible, non-debuggable, cleartext disabled.
- [Screenshot gallery](qa/fantasy-ux/VISUAL_REVIEW.md) · [validation summary](qa/fantasy-ux/validation-summary.json). Private seven-day APK download expires 17 October 2026; bearer URL is kept out of Git. No email sent in this milestone.

| Executed gate | Result | Boundary |
|---|---|---|
| Typecheck, lint, production web build | PASS | Final local source |
| Platform | 197 PASS | Local automated |
| Migration/RLS/database | 147 PASS | Disposable PGlite |
| Additional targeted core/sandbox rerun | 13 PASS | Includes changed-offer terms test |
| PostgreSQL isolation and sandbox races | 20 + 5 PASS | Real disposable loopback PostgreSQL |
| Browser / responsive / accessibility | 29 PASS, no skips | Local server and explicitly labelled fixtures; 320–1440px |
| Hosted SQL read/save/permissions | PASS | Exact restricted role, existing owner session context; new entry tests rolled back; official and beta table hashes unchanged |
| Hosted HTTP / console / accessibility | 32 PASS | Protection, anonymous denials and public access surfaces; not an owner browser gameplay session |
| Runtime dependency audit | PASS | Zero runtime vulnerabilities reported |
| APK build, identity, HTTPS and credential scan | PASS | 988 archive entries; exact-secret source/client/extracted-APK scan reports zero findings |
| Native emulator launch | PASS on retry | Initial Android system restart caused timeout; v12 cold launch then passed. Protected sign-in/gameplay/session reopening unverified in emulator |
| Owner login | ACCEPTED BY OWNER | Preserved; no password reset or MFA enrolment |
| Visual approval / physical S24 / launch | PENDING | Not signed off by automation |

The public holding HTML differs from the previous milestone's baseline because public main independently received commit `73205733` at 07:41 UTC, before this Preview push. The live HTML exactly matches that main commit. This milestone performed no public-main, production, DNS or authentication-policy mutation. See [comparison](qa/fantasy-ux/holding-after.json).

Next milestone: owner visual and physical-device gameplay acceptance, then a separately authorised capped private-beta readiness review covering sport rules, operational data/scoring, support/moderation and admission. Paid marketplace activation remains a separate gate.
