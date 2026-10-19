# Premium UX and weekly lineups — 19 October 2026

Implementation is ready for review. Local automated and browser acceptance is complete; hosted activation and authenticated hosted navigation timing are not complete. No Production code, competition, entry, wallet, ownership, scoring or DNS mutation was performed for this release.

## Delivered

- Pack reveals use symmetric stage padding. The old stage still reserved 46 extra pixels on the right for a side action that now sits below the card. Measured card-centre error changed from **−23px to 0px** at 1536, 1440, 1024, 412 and 360px. Canonical card art, flip/tilt, rarity, replay and settlement remain unchanged.
- Ordinary content loading reuses the approved Light Sweep component at compact size instead of three blank panels. Initial startup retains its existing full-screen treatment. Authentication identity is deduplicated with React's request-scoped cache; no member identity is shared across requests. Background service failures preserve current content and drafts, with Retry. Verified expired-session/MFA/permission failures retain their separate recovery flow and destination.
- Published weekly competitions are selectable with previous/next controls and a themed, keyboard-accessible sheet. URL context includes sport, mode, season and week. Existing per-account/per-competition drafts and entry snapshots remain authoritative. Fully locked/completed entries display their saved cards, including cards no longer owned, with recorded points/rank when available. Missing snapshots/results are not invented.
- Future drafts can be saved before the published competition's entry-opening time. This is a narrow change to the existing server command; it does not enter the competition. Entry-opening, salary, ownership, revision, kickoff and privacy checks remain. Week 7 edits do not modify Week 6.
- Auto Select runs on the authenticated server's eligible owned inventory. It returns a preview; Apply changes only the editable draft. Save Draft and Enter Competition remain separate actions. Locked slots are fixed, duplicate players are excluded, and incomplete collections show missing slots. A changed draft invalidates an old recommendation.
- Completed marketplace purchases display the actual purchased collectible with Congratulations, recorded paid amount, rarity lighting, shared ICON effects, close/skip, View in My Cards, Continue Browsing and optional existing sharing. Receipt/listing/card/settlement identity gates the celebration. No settlement, fee, wallet or ownership implementation changed. No Social post is automatic.

## Auto Select method and scope

The benchmark uses up to five verified final scored appearances in the selected season, strictly before the selected week and server time. DNP, live, incomplete and missing observations are excluded; unavailable history remains explicitly unranked. Full-PPR player history is multiplied by the existing approved card multiplier. This is a historical ranking benchmark, not a projection or a change to competition scoring.

An exact multiple-choice dynamic program groups canonical player IDs and tracks roster slots and salary. It maximises filled slots, then slots with verified evidence, then historical value; lower salary and stable IDs break ties. Traditional uses the configured $4.4m cap; All-Star uses the same roster without a cap. Locked slots are held constant. Equivalent instances collapse deterministically. Tests compare the optimiser against exhaustive combinations, including a greedy-selection salary/FLEX trap.

This release enables the existing published NFL seven-slot Traditional/All-Star architecture. It preserves other sports; it does not invent EPL schedules, salary data or a new EPL ranking model. Missing future eligibility/configuration blocks selection rather than fabricating values.

## Verification and limits

| Check | Result |
| --- | --- |
| Platform tests | 502 passed, 0 failed |
| Local PostgreSQL regression | 187 passed, 0 failed |
| TypeScript | Passed in clean production builds |
| ESLint | Passed, zero warnings |
| Production webpack build | Passed; separate clean-environment canary build recorded with release evidence |
| Client boundary | Test-secret-marker scan follows the canary build; see verification.json |
| Two-account marketplace browser flow | Passed isolated listing, publication/polling, repricing, cancellation, purchase, lost-response recovery, gross 1,000 / fee 50 / seller 950, ownership and activity reconciliation |
| Weekly browser flow | Passed independent future draft before opening, Enter disabled, historical snapshot display, Auto Select preview/apply/cancel, reload and return to Week 6 |
| Database protections | Future-draft idempotency, repeated migration, unchanged current entry, entry-before-open rejection, salary bounds, MFA, stale revisions, immutable locks and opposing-lineup secrecy passed |
| Visual/accessibility | Actual screenshots inspected at five widths; multiple rarity reveals, reduced motion, animated Next/Skip, Escape/Back dismissal, short-screen controls, serious/critical axe checks passed |

Browser fixtures use real components with isolated simulated identity/persistence. PostgreSQL tests exercise migrated command functions with fixture inventory/auth adapters. Together these are meaningful local acceptance, **not a deployed member-session end-to-end test**. No real user's credits/cards were used. Native Samsung/Android-shell installation and real-device performance remain unverified; 412/360px browser viewports were tested.

The first passes caught and corrected a 7.5px purchase alignment error from scrollbar gutter, a compact-logo CSS selector, an Auto Select toolbar overlap, and insufficient podium-to-receipt spacing. A test fixture needed complete history fields; a database assertion needed the explicit fourth test round; the animated Skip test needed its accessible name. The boundary check initially ran while a clean build had removed its output directory; it was rerun after building. Final runs pass without suppressed assertions.

## Performance evidence

Request-local authentication caching removes duplicate identity work within a render while preserving every existing auth/MFA/admission check. Batched historical ranking reads reuse the published statistics generation, avoid per-player database connections, use indexed canonical/alias ID matching and group results once.

Read-only warm alternating SQL measurements for the same 30 canonical players / 128 rows: old query **6.901 / 7.028ms**, revised query **2.035 / 2.090ms**. These measure the historical ranking query, not end-user route navigation.

The browser results record before/after local fixture timings, with mixed results. They do **not** establish a hosted navigation speedup. Authenticated Production network waterfalls, server timings, cold/warm route comparisons and actual Android timings still require the approved member runtime. No claim of immediate cached hosted navigation is made.

## Evidence

Selected actual renders and recordings are in [release evidence](qa/premium-ux/release-2026-10-19/). Fixtures use clearly local sample cards, not member assets.

- [Reveal before](qa/premium-ux/release-2026-10-19/reveal-before-412.png) / [after](qa/premium-ux/release-2026-10-19/reveal-after-412.png), [desktop](qa/premium-ux/release-2026-10-19/reveal-after-1536.png), [narrow](qa/premium-ux/release-2026-10-19/reveal-after-360.png).
- [Compact loading](qa/premium-ux/release-2026-10-19/loading-after-412.png).
- [Future draft](qa/premium-ux/release-2026-10-19/future-draft-412.png) / [historical entry](qa/premium-ux/release-2026-10-19/historical-412.png).
- [Purchase mobile](qa/premium-ux/release-2026-10-19/celebration-motion-412.png) / [desktop](qa/premium-ux/release-2026-10-19/celebration-1536.png).
- [Browser results](qa/premium-ux/release-2026-10-19/results.json), [verification scope](qa/premium-ux/release-2026-10-19/verification.json), journey recordings in the same directory.

## Migration and recovery plan

`supabase/migrations/20261019113000_future_week_private_drafts.sql` changes exactly one guarded predicate in `sports_feed.seven_command(text,jsonb,uuid)`. Reapplying is a no-op. An unexpected source definition aborts rather than guessing. There are no table/data changes or new grants. It must be applied to the approved isolated database before hosted future-draft acceptance.

Before any hosted application, retain the exact existing function definition and migration receipt. Recovery restores that definition in a transaction after verifying the new predicate is present exactly once. Existing drafts and entries remain untouched; never delete them to roll back. Restore the previous web deployment independently if needed. Do not edit migrations already recorded as applied.

## Hosted round activation findings

Read-only inspection found only 2026 Week 6 seven-slot rounds: Traditional (`70de1f8e-b789-4331-99aa-6afb0c31a8a2`, two entries) and All-Star (`315280d3-7413-4c2d-8a63-fef6d7e37003`, one entry). There is no Week 1 record to reconstruct and no registered Week 7 competition. The published import already contains 14 scheduled Week 7 fixtures, first kickoff **2026-10-23 00:15 UTC**, last **2026-10-27 00:15 UTC**. The UI cannot expose a competition that does not exist.

To activate Week 7, use the existing `registerNflRound` workflow after reviewing current fixtures and fresh canonical player/position mappings. Register exactly one Traditional and one All-Star 2026 Week 7 round with existing approved lineup/scoring configuration, salary table and rolling locks. Set explicit entry-opening/deadline values consistent with the existing policy and verify duplicate-registration behaviour. Preserve Week 6 and its frozen configuration. Registering a round must not enter members, mint rewards, settle results or alter inventory. `scripts/seven-round-prepare.ts` is an existing Production-writing script, not a dry-run; do not execute it casually or use its automatic week selection without reviewing the exact resulting round.

## Protected Preview preparation

Configured target: Vercel `docked-preview`, project `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, isolated Supabase `bckkllmndoxzpzdqrevb`. These are repository configuration identities, not a claim that current remote protection/settings were verified this turn.

The current branch is `codex/member-platform-updates`. Existing preparation/deployment guards pin older reviewed branches and the private Preview runtime explicitly disables fantasy gameplay. The credential-free review runtime also cannot exercise member/database journeys. No guard was relaxed, Production credentials copied, branch identity spoofed or unusable Preview presented as accepted. **No new hosted Preview deployment or URL is claimed.**

Prepared for target review: committed web changes, migration, reproducible tests, visual evidence and this activation/recovery plan. A local committed-source archive may accompany the handover; it is not an executable deployment approval and does not change the existing guard.

Remaining decisions: approve a feature-capable isolated protected Preview target/branch contract, then apply the migration and isolated fixtures there and verify authenticated navigation/transactions. A later Production release requires explicit approval for the web deployment, this function migration and exact Week 7 registration. This task's final instruction requests protected Preview preparation; earlier live-release approvals were not reused for new Production changes.

## Main change locations

Shared loading/auth: `startup-loading`, `content-loading`, `fantasy-screen`, `fantasy-load-error`, `src/server/auth.ts`. Reveal styling: `mobile-cleanup.css`. Weekly UI: `nfl-seven-play`, `competition-week-selector`, `weekly-lineup-result`. Server reads: `api/fantasy/auto-select`, `api/fantasy/lineup-history`, `nfl-player-history`. Ranking: `lineup-auto-select`, `owned-lineup-recommendation`. Purchase UI: `credit-marketplace`, `purchase-celebration`, shared `icon-celebration`, `premium-ux.css`. Verification: `tests/platform/premium-ux.test.ts`, `tests/database/nfl-seven.test.ts`, `scripts/premium-ux-browser.ts`, `scripts/fixed-price-marketplace-browser.ts` and isolated fixtures.
