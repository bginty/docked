# Multi-sport cards and NBA rarity scoring — 23 October 2026

NBA now uses the owner-approved NFL rarity factors in the new private-beta scoring version `docked-nba-weekly-rarity-v2`: Core 1.0, Rare 1.1, Elite 1.2, Ultra Rare 1.3, Legendary 1.4, Icon 1.5. The existing point/rebound/assist/steal/block/turnover weights and stacked double-double/triple-double bonuses are unchanged. Base game logs remain unmultiplied. Contributions, partial weekly totals and rankings derive from the authoritative scoring journal and locked card rarity. Multiply the weekly base sum once, with integer centipoints and half-away-from-zero rounding. A 41.50 base triple-double becomes 58.10 with Legendary; two such games contribute 116.20. Missing statistics remain unresolved; confirmed DNP is zero.

## What changed

- Removed the explicit NBA jersey-number suppression and forced 1.0× card badges. AFL/NRL do not display unsupported scoring multipliers.
- Kept the existing NFL face, frames, typography and card renderer. All sports now share those components in collections, lineup details, market projections and reveals. Existing original sport-specific uniforms remain.
- Added matching team/city labels using explicit known-team aliases. Fixed empty colour fields masking team palettes.
- Added a reversible read-only jersey overlay: **517 NBA and 542 AFL** players with exact roster/profile agreement. Three AFL numbers remain unresolved. NRL has no permanent numbers in this source; no positional number is invented. NBA `00` stays distinct from `0`.
- Source revisions, attribution and conflicts are in `jersey-evidence.json`, also downloadable from `/roster-sources`. The original roster dataset, inventory and ownership records were not rewritten.
- Collection cards now open the existing flip viewer. Locked comparison cards can open read-only details. History is loaded when the back is opened, with sport filtering. Missing statistics show the existing empty state.
- Compact three-button collection navigation and expandable beta disclosure retain purchase/source information without a large paragraph above the cards.

## Historical protection and migration

Production preflight found ten NBA beta rounds, one entry and **no NBA scoring journals**. Docked freezes competition rules on creation. The first migration rehearsal rejected in-place changes and rolled back; no guard was bypassed.

Migration `20261023130000_nba_private_beta_rarity_v2.sql` registers V2 and creates separately versioned successor rounds for unscored, unlocked private-beta periods. Existing competitions, selections and results retain V1. The new testing season suffix is `-RARITY-V2`; this is an explicit rule-version boundary, not a change to any real NBA schedule. Existing synthetic fixtures remain labelled testing data.

The UI prioritises **Rarity scoring** rounds. Original rounds with saved entries/drafts remain accessible as **Original scoring** and retain their original 1.0× contribution rule. No finalised or historical result is recalculated. The migration is idempotent and records each successor in the existing administrator audit trail. It neither issues cards nor activates a data feed.

Rollback: use the captured deployment in `release/rollback.json`. Suspend private NBA through its existing server gate before using a V1-only binary. Retain additive rules, rounds and all audit/entry records; never delete or reinterpret them. Restore access with a V2-compatible build. NFL and wallet controls remain independent.

## Verification

- **603/603 platform tests passed**, including NFL, cards, economy, marketplace, identity, missing data, corrections and security regression.
- **4/4 database integration tests passed**: NBA V2 journal reconciliation, legacy NBA weekly privacy/locks, private-beta access, NFL seven-slot authority and immutable rules.
- **12 browser journeys passed** at 360, 412 and 1440 pixels across NFL/NBA/AFL/NRL: all six rarities, front/back flips, collection detail opening, nine-card reveals and no horizontal overflow. Local actual React components and isolated data; no purchases or real accounts.
- Four additional 360-pixel journeys checked all six rarities with synthetic long names and missing numbers; no clipped names or horizontal overflow.
- Typecheck, lint, clean Next production build and canary client-secret scan passed.
- Hosted database rollback rehearsal verifies existing cards, entries, results, ownership, sales, shared credits state, NFL rounds/control, player records and sandbox inventory hashes remain unchanged. It also checks original NBA competitions and migration replay.

Screenshots in this folder are explicitly local visual fixtures. Representative mobile evidence: `nfl-rarities-412.png`, `basketball-collection-412.png`, `afl-collection-412.png`, `nrl-collection-412.png`; backs and pack reveals have equivalent sport/viewport filenames.

## Limits

No attached signed-in browser session was available. Authenticated Production gameplay, purchases and tester-specific acceptance are **not claimed**. Release receipts separately record deployment and signed-out hosted health/access checks. Real NBA/AFL/NRL statistics remain disconnected; no synthetic result is described as real. Permanent issuance, wallets, supply, pricing, existing ownership and NFL scoring are unchanged.

Deployment URL, exact commit and final database outcome are recorded in `release/deployment-submitted.json`, `release/deployment-promoted.json` and `release/database-apply.json` when those steps complete.

## Live release result

- **Deployed:** https://docked.com.au, application commit `a2fdd38a703cb50946424812aa4e432b28614489`, Vercel deployment `dpl_Cd4wPZcFJJJNSY85VLuT2aMZYPxi`, READY. Build URL: https://docked-production-lra0s8gmc-briant-s-projects.vercel.app.
- **Migration applied and verified:** ten V2 successor test rounds added; original NBA competitions and saved selections retained. Protected record hashes were identical immediately before and after the migration. The NFL scheduled feed can continue its ordinary updates independently.
- **Hosted checks:** 19 health/access checks passed both before promotion and on the live domain. Registration remains closed; anonymous requests cannot read private sport, wallet, marketplace or owner data.
- **Hosted browser:** 20 signed-out route and recovery checks passed at 412/1440 pixels for NBA/AFL/NRL pack links, history and login return paths. No stuck loading screen or uncaught browser error in these journeys. This does not establish authenticated pack-purchase acceptance.
- **Published metadata:** live jersey attribution/evidence exactly matches the committed artifact (517 NBA, 542 AFL).
- **Acceptance gap:** no signed-in Production session was available. Member-specific collection, purchase and gameplay acceptance is not claimed. Local component, scoring and SQL evidence remains separately labelled.

Open the **Rarity scoring** NBA rounds to test the new multipliers. An existing saved team under **Original scoring** remains governed by its original immutable contract; no historical conversion or prize recalculation occurred.
