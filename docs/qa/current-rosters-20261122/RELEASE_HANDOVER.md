# Docked release handover

**22 November 2026 — prepared locally; not published or live.**

Worktree: `/workspace/scratch/441b4116a503/docked-current-rosters`

Branch: `codex/current-rosters-20261122`

The latest [read-only production check](PRODUCTION_READONLY.json) still shows
web source `83794e9a`, no pack-award or roster-event tables, and Marketplace
transfers disabled. No production migration, roster change or customer award
has been made for this release.

## What Briant will receive

- **Free packs from the Owner dashboard:** mix Standard and Premium 1-, 3- and
  9-card packs for one customer, with quantities and a Promotion/Prize reason,
  then review and issue. Maximum 20 packs per request. The requested Premium
  1-card + Standard 9-card example gives two sealed packs and ten cards, without
  credits or a payment. MFA, eligibility, supply, audit and safe retry apply.
- **Player roster and full CSV export:** `/admin/rosters`, linked from
  Commercial operations and Cards, shows canonical names, current reviewed
  clubs/statuses, saved card clubs, evidence and supply. Unreviewed legacy clubs
  are labelled; CSV includes every matching page.
- **Roster decisions govern future draws:** delisted, retired, unsigned,
  pending re-list and unknown registrations are excluded from new paid and free
  packs once the reviewed decision is applied. Existing cards retain their
  identities, serials and normal ownership/trading rules.

**An already-issued sealed pack keeps its allocated cards.** Contents are
allocated when a pack is bought or awarded; opening does not draw again.
Roster changes do not replace cards already owned.

## Data ready for review

| Deliverable | Scope and status |
| --- | --- |
| [AFL_OWNER_AUDIT.csv](AFL_OWNER_AUDIT.csv) | All 542 saved canonical AFL players, sorted by saved club/name. Verified totals: 2,690 definitions, 2,680 approved, 342 lifetime issued. Saved club is not asserted to be current. Seven proposals are labelled **Proposed — not applied**. |
| [AFL_REVIEWED_EXISTING_BATCH.json](AFL_REVIEWED_EXISTING_BATCH.json) | Seven existing-player decisions: two pending re-list, one delisted, two retired and two completed ACTIVE returns. No new definitions or credit changes. Held definitions stay held. **Not applied.** |
| [AFL_REVIEWED_NEW_BATCH.json](AFL_REVIEWED_NEW_BATCH.json) | Nine corroborated new-to-Docked identities with exact club and position evidence. Creates 45 dormant definitions when applied; no cards or activation. **Not applied.** |
| [AFL_NEW_PLAYER_PLAN.json](AFL_NEW_PLAYER_PLAN.json) | Canonical identity decisions and source evidence for those nine, with all 54 remaining selections and their unresolved fields. The exact 45-row definition artifact is linked from this plan. |

Of the 65 completed national-draft selections, two already map to existing
identities and nine are in the supplemental preparation, leaving **54 selections
requiring further identity/position/source work**. Do not invent mappings or
treat a planned rookie re-selection as a completed return.

Prepared new-player definitions remain **dormant and unapproved**; registering
them mints no cards. Future pack eligibility requires separate explicit
activation with current registration and rights approval. ACTIVE alone does
not approve a held definition.

## Verification completed

- **55 focused platform tests passed**, with no failures or skips, on Node 22.
- **24 native PostgreSQL checks passed.** The [database report](DATABASE.json)
  covers allocation, concurrency, retained assets and direct-runtime guards,
  with zero supply mismatches, duplicate serials or incomplete packs.
- Full lint, TypeScript and the optimized production build passed. The
  [local advisor report](ADVISORS.json) has no issues for the disposable fixture.
- Component SSR and CSS inspection passed. **Real browser, hosted end-to-end
  and installed Android acceptance have not been executed for this release.**

`PLATFORM.tap` and `BUILD.log` preserve the final platform run and production
build; `VERIFICATION.json` records full lint and TypeScript outcomes and hashes.
The six roster-data tests include the exact seven-player and nine-player
batches, all 45 dormant definitions, source hashes, captured club IDs and
known-name-variant checks. The combined `VERIFICATION.json` records the final
source and evidence hashes.

## Why work is waiting, and the next permission

Automatic approval review rejected **both** publishing implementation source to
the public `bginty/docked` GitHub repository and uploading the minimal source/test
bundle to a temporary Vercel Sandbox for browser acceptance. Neither source
transfer happened; the unused Sandbox was stopped. Explicit permission for
these source disclosures is required before retrying the blocked actions.

The concrete permission requested is:

> I authorise publishing the reviewed Owner pack-award and roster implementation
> to the public `bginty/docked` repository, and uploading the minimum required
> source/test files to a temporary Vercel Sandbox for the remaining browser tests.

## Codex continuation

1. Verify the prepared patch and combined source/evidence manifest. Refresh
   sources and current revisions before applying any roster batch. Retry a
   possibly committed request with the exact same ID and payload; if new facts
   require a changed decision, prepare a new reviewed request instead.
2. After permission, publish and finish award recovery/two-tab,
   roster/filter/CSV/mobile and installed-app acceptance with synthetic members.
   Existing shared Preview mutation limits still apply.
3. Recheck production drift and backup/recovery readiness. The deployment must
   use the **complete repository tree and assets**, not a bare upload of this
   sparse checkout. Apply `20261122005246_owner_pack_awards.sql`, then
   `20261122011302_commercial_player_roster.sql`, before the compatible web app.
   Verify paid purchases and Owner routes, then apply the exact reviewed batches
   under the release authority. Activate new definitions separately.
4. Use the issuance pause if needed. Preserve awards, decisions, cards and
   receipts; never reset serials or delete owned cards. Pause issuance before
   reverting to web code without roster-aware allocation.

There is no Android binary or billing-product change in this candidate. The
installed-app navigation and export handoff still need acceptance.
