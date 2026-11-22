# Docked: finish Owner awards and roster release

## Authoritative continuation status — 22 November 2026, Australia/Sydney

Briant requested that the remaining updates be made live and subsequently requested a Codex handover because GitHub sign-in attempts in ChatGPT repeatedly showed an error. This document records the handoff. It supersedes the outstanding-permission and browser-blocked sections in the earlier `current-rosters-20261122/RELEASE_HANDOVER.md`; retain those earlier files as historical evidence.

The two features are implemented locally. This session applied no production migrations or roster batches, issued no customer awards, changed no Vercel project settings, and deployed or promoted no new application. A GitHub tree-upload attempt returned an error, `user rejected MCP tool call`. No successful new tree, commit, or branch publication was established. That connector result does not establish why the user's sign-in UI failed. Do not retry that ChatGPT connection as part of this handover.

Briant has authorized publishing the reviewed source to the public `bginty/docked` repository, performing the necessary release work, and bringing these updates live. The earlier authorization also covered a minimal temporary Vercel Sandbox for acceptance; that test has now completed and the Sandbox is stopped. Use legitimate credentials and existing release authority. Ask only for a genuinely required user login, MFA, or unresolved decision, and make clear the exact blocker. Do not manufacture Owner claims or bypass release controls.

## Recovered source and baseline

- Repository: https://github.com/bginty/docked (public).
- Last verified application branch: `codex/owner-customer-browsing`, head `58841a60b4e4c57d9c410c4f1c2e315ee8bf20d2`. This is the patch base. The default `main` branch was an old landing site; do not use it as the application baseline.
- Last verified live application source: `83794e9ac31c54960bfc76b9a07b36047f20486b`. The patch base adds release evidence after this application source.
- Recovered implementation commits: `f1af4cdb23f394db615b9637d9b65566bf571d5b` (awards) and `b3c2228205985b62972a9ad93e0c775d7bfaaec8` (rosters). Source refresh commit: `cbb74d60a7ef549b7e8246666d63ab066190ed92`.
- The recovery archive supplies a full-index patch and exact changed files, with hashes. It is not a standalone deployment tree. Recover into a complete repository checkout, preserving newer unrelated work.
- Previous ChatGPT `/workspace/scratch/...` paths are not expected to exist on the laptop. All needed changed source is in the archive. The portable patch can produce the same file tree without preserving the original local commit IDs.

Refresh the current remote and live state first. If equivalent changes already exist, compare them and continue from the actual state rather than applying duplicate migrations or code. Do not force-push, discard laptop edits, or reset the application to this historical baseline.

## Feature acceptance

### Owner free packs

`/admin/pack-awards` lets an authenticated Owner with current MFA award one member a reviewed mix of Standard/Premium packs, in 1-, 3-, or 9-card sizes, with quantities and a Promotion/Prize reason and reference. Limit: 20 packs per request. For example, Premium 1-card plus Standard 9-card yields two sealed packs containing ten cards. It does not issue credits or alter payments or Google billing products.

The feature enforces member eligibility, commercial controls, supply limits and lifetime serials. It records immutable audit receipts and supports exact idempotent retry, lost-response recovery, browser two-tab locking, and Owner-bound pending requests. Paid and free draws share the same lifetime supply. Opening a sealed pack reveals its already allocated cards; it does not draw again. Do not use a real customer award as a deployment test.

### Owner roster and future eligibility

`/admin/rosters` provides club-sorted audit/filtering and a CSV of every matching row across all pages. It separates canonical identity, reviewed current club/status, saved card club, evidence, eligibility and supply. Unreviewed legacy clubs are labelled accordingly.

Reviewed delisted, retired, unsigned, pending-relist and unknown registrations are excluded from future paid/free draws. Existing cards, ownership, unopened allocations, serials and historical supply are preserved. Returning players reuse existing canonical identity and supply; ACTIVE registration alone does not release held definitions.

## Reviewed data and time-sensitive facts

Read `ROSTER_SOURCE_REFRESH.md` and `.json` in this directory, then refresh official sources and expected revisions again at application time. The November 22 source refresh corroborated seven existing-player decisions and nine new-to-Docked identity candidates. It did not re-download and rehash the original raw page capture cache; do not present the old page hashes as newly verified.

The exact prepared files are in `docs/qa/current-rosters-20261122/`:

- `AFL_REVIEWED_EXISTING_BATCH.json`: Riley Garcia and Ryan Byrnes PENDING_RELIST; Jack Carroll DELISTED; Dougal Howard and Dane Rampe RETIRED; Elliott Himmelberg and Jamarra Ugle-Hagan ACTIVE at Gold Coast using their existing identities.
- `AFL_REVIEWED_NEW_BATCH.json`, `AFL_NEW_DORMANT_DEFINITIONS.json` and `AFL_NEW_PLAYER_PLAN.json`: Ethan Drever, Jack Riding, Caylen Murray, Archie Elliott, Arki Butler, Lachlan Hicks, Mitch Knevitt, Gus Kennedy and Cooper Hodge; 45 dormant, unapproved definitions. Registration mints no cards and does not activate definitions.
- `AFL_OWNER_AUDIT.csv`: 542 saved canonical AFL players, with proposed changes explicitly not yet applied.

Rookie re-listing was scheduled for November 23 at 3 pm AEDT. Do not blindly reuse the November 22 pending-relist decisions after new results become available. Fifty-four other draft selections still require identity/position/source resolution. Preserve unresolved DOB conflicts for Xavier Ladbrook, Harvie Cooke and Brady Wright; do not guess, silently activate, or expand this deployment into unreviewed identity imports.

Apply only refreshed, exact reviewed batches through the legitimate Owner/session/MFA or established reviewed release mechanism. Refresh revision preconditions immediately before applying. After an uncertain commit, inspect the receipt and replay the same request ID and payload; changed facts require a new reviewed request. New-definition activation requires its own complete eligibility and rights approval.

## Verification completed and still needed

- This session: 36 focused platform tests passed, zero failures/skips; `PLATFORM_RERUN.tap`.
- This session: 24 isolated native PostgreSQL checks passed, including concurrent paid/free issuance, retries, permission/MFA/session enforcement, roster races and preserved assets; `DATABASE_RERUN.log`. The fixture advisor reported no discrepancies. No production writes were involved.
- This session: three real Chromium acceptance journeys passed, zero failures/skips/flakes, using real components with synthetic HTTP transport; `BROWSER_ACCEPTANCE.md` and its text result files. They cover mixed awards/two tabs/recovery, 201-row filtered CSV/mobile navigation, and roster-state clarity. The temporary Sandbox was stopped. Screenshots were inspected internally and are not included in this portable handover.
- Full lint passed. Complete TypeScript checking passed after sparse checkout assets were restored and browser tests were added.
- The earlier source snapshot has a passing optimized build in `current-rosters-20261122/BUILD.log`. This session's fresh build attempts did not finish: sparse checkout data/assets were missing. Those inputs were subsequently restored and typechecking passed, but a fresh optimized build was not rerun. `SPARSE_BUILD_ATTEMPT.log` records the last incomplete attempt; do not call it a build pass.
- A fresh build from a complete tree, protected hosted verification, live authenticated acceptance and physical installed-Android acceptance remain outstanding. Browser fixture success is not production or physical-device acceptance.

The old `VERIFICATION.json` files refer to earlier snapshots; use the archive's current checksums for delivered bytes. Reproduce meaningful checks where needed, without running issuance tests against production or shared Preview.

Useful commands from the repository root (adapt runtime setup to the laptop):

```sh
npm ci
npm run lint
npx tsc --noEmit --incremental false --pretty false
node --import tsx --test --test-concurrency=2 tests/platform/owner-pack-awards.test.ts tests/platform/owner-pack-awards-route.test.ts tests/platform/commercial-player-roster.test.ts tests/platform/owner-rosters.test.ts tests/platform/owner-rosters-ui.test.ts tests/platform/afl-reviewed-roster-data.test.ts tests/platform/post-beta-owner.test.ts
EXTERNAL_PREVIEW=1 node node_modules/playwright/cli.js test --config=playwright.owner-release.config.ts
```

The isolated PostgreSQL runner is `scripts/owner-pack-awards-local-postgres.mjs`; install the expected disposable PostgreSQL runtime and supply `OWNER_PACK_AWARDS_PG_RUNTIME` as needed. Read the runner before invoking; do not substitute a production database URL. Use the project's actual guarded build/release workflow for production, with Node/package requirements from the repository.

## Production target and last read-only baseline

- Domain: https://docked.com.au
- Vercel team: `team_tf6xweKKyVCj9bTppUKttJ4l`.
- Production project: `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`.
- Last verified live deployment: `dpl_2k3nw6ZuhxCT5SyAdBwbCiiq4JyU`, READY, source `83794e9ac31c54960bfc76b9a07b36047f20486b`.
- Separate Preview project: `docked-preview`, `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`. No separate Docked Preview database was found; do not point synthetic mutation tests at production.
- Production Supabase: `pojoymtniryarxxunyvz`, Sydney.
- Read-only check on November 22 around 1:53 pm AEDT: commercial environment; sales and issuance enabled; transfers and gameplay disabled. Preserve actual current controls and unrelated authentication/email-branding changes.
- Integrity: 6,540 definitions; 933 lifetime issued = 888 legacy + 30 beta allocations + 15 commercial cards; three commercial packs; one credit lot with 400 remaining. Zero duplicates, incomplete packs, unbalanced journals or supply discrepancies when beta allocations are included. These values are a historical baseline, not fixed expected counts for a later deployment.

Re-read production state and verify backup/recovery readiness. `PRE_MIGRATION_SCHEMA.json` contains selected function definitions, ACLs and constraints only; it is not a full backup.

## Database sequence

Apply these additive migrations, in order, before the compatible app serves live traffic, inspecting migration history and current schema first:

1. `20261122005246_owner_pack_awards.sql` — SHA256 `fe31894908c1db27a0f79bff8f9ae8283234a1531f778c6e043e80e85d083236`.
2. `20261122011302_commercial_player_roster.sql` — SHA256 `4fdab8010fa79a3f01febcb0ac8454bd7f7f42bfbdbec6cca5c4dcd3e1ef2e39`.

Use legitimate migration credentials. Preserve RLS, narrow grants, restricted runtime roles, immutable audit and request receipts. Verify schema/permissions and ordinary paid paths after the migration. Defer applying roster exclusions until the compatible application and release sequencing are ready.

## Application deployment

Production runtime configuration includes important per-deployment overrides absent from project-level variables. A plain Git deployment with only project environment variables may fail or have the wrong runtime posture. Recover the actual current configuration through the authorized CLI/release workflow without printing secrets. Do not invent values or use stale scripts unchanged.

Inspect `scripts/guard-hosted-build.mjs`, `src/core/hosted-production.mjs`, `src/core/hosting-identity.mjs` and relevant release docs. Preserve guard checks for exact project/team, production environment, restricted database role, origin, approvals/runtime flags and source provenance. Historical scripts may contain old Windows paths, hashes, deployment IDs and authority timestamps; adapt them legitimately.

The established approach is to publish the reviewed candidate, export the complete Git tree and assets, then stage with `vercel deploy --prod --skip-domain`, supplying the real current runtime/build values through the established `--env KEY` and `--build-env KEY` process. Keep values out of shell output, logs and Git. Set `VERCEL_GIT_COMMIT_SHA` and any `DOCKED_CODE_COMMIT` to the exact new candidate commit; verify deployed provenance independently. Do not substitute a guessed staging target or weaken the guard.

Keep the public domain on its existing deployment while checking the protected candidate. Once READY and verified, promote that exact candidate with the normal Vercel promotion mechanism. Inspect ambiguous deployment requests by ID/source before retrying. No Vercel project settings were changed by this handover session.

After promotion, verify the canonical domain, correct source and environment, authenticated Owner award/roster routes, CSV and member views, ordinary purchase/opening behavior through safe nonmutating or approved fixture checks, workers and database integrity. Apply refreshed reviewed roster batches in the compatible release sequence and inspect immutable receipts and expected totals. Do not mint real packs as smoke tests. New dormant definitions remain unapproved and unissued.

## Rollback and final report

Preserve the previous deployment as the known rollback reference. If reverting to roster-unaware code after roster exclusions have been applied, pause issuance first: otherwise old allocation code may select an excluded player and the database guard will reject it. Preserve additive schema, immutable receipts and decisions, cards, ownership and lifetime serials; never reset supply or delete issued assets as rollback.

Report exactly what is implemented, tested, published, migrated, data-applied, staged and promoted. Provide production URL, final commit, deployment ID, migration results, roster receipt/results, integrity outcome and any remaining physical-device check. Do not report the release as live based solely on a successful push/build or an old page response.
