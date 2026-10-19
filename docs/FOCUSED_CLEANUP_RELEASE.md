# Focused member cleanup — 19 October 2026

## Scope

Removed the Profile Completed swaps tile, Social Trading & offers panel, obsolete fallback trade controls and obsolete beta copy. Profile retains three responsive summary tiles. Social uses “Collect. Compete. Connect.” Historical records, member-authored content and legitimate sale/ownership-transfer information are preserved. Owner dashboard routing/access, Social attachments and announcements are unchanged.

Marketplace NFL filters expose QB/RB/WR/TE. Old K/Kicker URLs resolve to all supported positions and discard incompatible cursors. Listings, filters, sale/manage dialogs and Activity use the shared Core/Rare/Elite/Ultra Rare/Legendary/Icon labels; stored enums are unchanged.

Prizes now uses Finish and Reward columns with readable ordinals. The podium and table use one structured product/quantity formatter. Weekly quantities remain 5/3/1, Traditional Standard 9 Pack NFL and All-Star Premium 9 Pack NFL. Season remains unannounced; there are no reward issuance changes.

## Authentication finding

The member request boundary already identified missing authentication and required MFA, but its shared error component still displayed the generic “Docked couldn’t load” text. MFA and login recovery also lost the requested member destination. This is an established presentation/navigation defect; the exact cause of the previously reported session failure cannot be established retrospectively.

Missing authentication now shows “Please sign in again”; MFA uses the existing authenticator flow; permission denial has its own state; network/server failures retain Retry. Exact server error classifications are used, so transient authentication-service failures are not labelled session expiry. A bounded same-origin member-route allowlist preserves query context through login and MFA while rejecting external/auth/admin return destinations. Server identity, admission, session and MFA checks are unchanged. Saved drafts are not cleared.

## Scoring execution and migration decision

This discrepancy affects actual execution, not just documentation. The collection worker reconciles retained imported statistics into an immutable competition stream. `scorePlayer` uses that stream's saved rule weights; the engine then applies the locked card multiplier once to the complete player-round base total, rounds half-up away from zero to hundredths, and sums the team.

The authoritative game-log policy awards 100 centipoints per reception. Saved legacy competition rules award 50. Legacy rules additionally score kickoff-return touchdowns, punt-return touchdowns and offensive fumble-recovery touchdowns at 600 centipoints each; those three categories are outside the game-log policy. The other twelve shared weights agree (including fumbles lost −200).

New base, rarity and seven-slot period configuration now derives its weights from the authoritative game-log policy, using new immutable v2 version IDs. The imported-statistics adapter and strict schema follow the selected saved version. Registration rejects newly submitted obsolete configurations. Rarity multipliers, rounding, salaries, formation, lock rules and historical v1 execution remain unchanged. Documentation derives from the selected configuration.

Read-only production audit at 06:59:34 UTC found no future/unlocked NFL rounds. All four existing Week 6 rounds locked at 00:15 UTC on 16 October:

| Competition | ID | Entries | Existing version |
|---|---|---:|---|
| NFL Week 6 · post-game beta | b828817d-0ba9-4edd-87a3-fe6dd23ad7a0 | 2 | half-PPR v1 |
| NFL Week 6 · RARITY TEST · no prizes | 8841bf7d-5952-47c4-b926-40b04fdc5cba | 0 | rarity v1 |
| Traditional / Salary Cap | 70de1f8e-b789-4331-99aa-6afb0c31a8a2 | 2 | seven-slot v1 |
| All-Star / Open | 315280d3-7413-4c2d-8a63-fef6d7e37003 | 1 | seven-slot v1 |

The stream journals agree with the saved half-PPR definitions. None was finalised or had imported competition sources at audit time. Game-log imports are separate and unchanged. All four existing rounds retain their old rules, including the zero-entry round because its lock time has passed. Consequently, full current-round alignment is **not** claimed.

Separate owner decision required before changing these rounds: explicitly select the affected locked round IDs and approve a versioned amendment/recalculation. That migration must snapshot competition definitions, stream revisions, entries, slot locks and results; retain old immutable rules and audit the amendment; recalculate from verified retained source records using the existing locked multipliers; validate missing-data states and review totals before publication. Completed/settled history would require separate correction authority and award-ledger reconciliation. No such migration or recalculation was performed in this release.

## Verification

- Platform regression: 496/496 pass on the final full run. The initial run had three stale test expectations that used the newly-current rules for legacy fixtures; tests now explicitly distinguish legacy preservation from new-period configuration. Added direct imported base → locked rarity → total/replay coverage and category-by-category agreement with game logs.
- PostgreSQL regression: 187/187 pass (isolated PGlite databases).
- TypeScript and lint pass. Initial typecheck exposed an adapter overload annotation and test narrowing; corrected. Lint found one test-only `let`; corrected.
- Marketplace isolated two-account browser journey passes create/cancel/reprice/cross-account polling/purchase lost-response recovery, historical fee receipts and ownership/ledger reconciliation. No live trades were made by the agent.
- Prizes and Profile: real rendered components at 1536/1440/1024/412/360px, selectors, history navigation, empty states, two-column reward consistency, no horizontal overflow, no serious/critical axe violations. Screenshots reviewed visually. These are isolated fixtures, not real member screenshots.
- Recovery: missing-session, MFA, permission and network-retry states tested separately at 1440/412/360px. Controlled login/MFA transport carries the correct return URL and retains a saved draft; serious/critical axe violations zero. This does not claim a new real-user Supabase/MFA login.
- Recovery browser's first run failed because axe requires an explicit browser context; corrected the harness and the full three-width run passed.

Evidence is in `docs/qa/focused-cleanup`. Physical Samsung/installed Android authentication was not exercised by the agent. Existing unrelated working changes were preserved.

## Deployment

Application-only release; no SQL migration or live data mutation is required. Deployed application commit `3e530a75d8d2b5c6197bd6c5a64cea2dad583d70`, Vercel deployment `dpl_2b8acxWRhttZuXnLGvyZJZcAkEFE`. The staged Sydney production build reached READY; protected candidate identity and missing-session response passed before promotion. Canonical https://docked.com.au identity matched at 07:19:59 UTC. The production site and www alias were promoted using the existing project; public registration remains disabled and invited authentication remains enabled. Rollback is promotion of the preceding application deployment; no data rollback is needed.

Fresh anonymous live browsers at 1440px and 412px verified the branded sign-in state, working sign-in link, retained Play sport/mode destination, no overflow and no client errors. The first live browser assertion was too broad and also matched Next’s empty route announcer; the selector was scoped to the branded alert and both widths then passed. No real account credentials or production transactions were used. The 07:20:09 UTC runtime scan found three expected authentication classifications from these anonymous probes and no service/fatal failures. Existing member screen rendering and login/MFA success were verified in isolated browser fixtures as described above, not by impersonating a real member.

Barry can refresh Play, Market, Profile, Social and Prizes. Review Traditional and All-Star weekly prizes, then Season. On Samsung, verify sign-in/MFA returns to Play with the selected mode. No production database migration, score rewrite, ownership change, wallet change or reward issuance occurred.
