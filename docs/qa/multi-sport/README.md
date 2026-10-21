# Multi-sport expansion — continuation and evidence

Later checkpoints: [protected deployment](deployment-2026-10-22.md) and
[owner-managed feed/scoring implementation](owner-feed-2026-10-22.md).
The historical status below predates those checkpoints. A paid provider is not
required; the owner's scraper can supply the documented event contract.

Production remains unchanged. No new live competitions, cards, packs, balances,
provider subscriptions or pricing have been created. Work is in the existing
`fixed-market-live/Docked.com.au` worktree, branch `codex/member-platform-updates`.

## AFL checkpoint

- Approved 22 slots: BACK1–6 (DEF), MID1–8, FWD1–6, RUCK1–2 (RUC).
- Existing SQL entry/draft, revision, idempotency, snapshot, lock and rollover
  implementations extended with isolated inventory/fixture adapters.
- Same canonical card renderer; original sleeveless guernsey; unknown numbers blank.
- Existing exact Auto Select now collapses equivalent-slot permutations; first
  confirmation disables subsequent automatic selection. No rarity-based ranking
  is invented; absent performance evidence remains unranked.
- `/admin/sports` and `/api/admin/sports-sandbox` require staff MFA, explicit
  sandbox allowlisting and an isolated Preview database/environment. Production
  fails closed. No automatic fixture seeding or activation.
- New migration `20261021120641_multi_sport_lineup_adapters.sql` is **local only**.
- Browser evidence in `afl/`: 360, 412, 1024, 1440, 1536; SQL-backed preview,
  apply, save, confirmation, rollover, replacement, history and community viewing.
- Database test exercises 22 selections, over-cap/incomplete/cross-sport rejection,
  original slots after transfer/removal, independent modes, revision conflicts,
  pre-lock privacy and post-lock eligible competitor visibility.
- Existing NFL seven-slot and continuity database regression passes.

## Known decisions to preserve

The repository already contains AFL scoring v1 and an owner-labelled v2 (kick 2,
handball 1, other v1 event weights retained). The 22-slot sandbox uses v2 weights
in a new version. Existing v1/v2 snapshots are unchanged. No live scoring is
enabled. The old eight-slot configuration remains available only as historical
rules data, not the new AFL lineup.

## Pending owner / provider decisions

1. Licensed provider, intended commercial use, retention/redistribution rights,
   reliable fantasy-position evidence, and credentials. Recommendation: require
   actual sample payloads and written scope before enabling ingestion. A trial
   is not permission to publish a catalogue or production scores.
2. Sport-specific Traditional salary models/caps. Test fixtures use explicitly
   artificial units; these are not prices or recommended live values.
3. New-sport scarcity allocations, nine-card paid-pack prices/probabilities and
   starter entitlement policy. Retain existing NFL products unchanged.
4. NRL proposed 13-slot format, NBA weekly-window boundaries, and each new scoring
   ruleset. Do not infer weights from a provider's fantasy-total field.
5. Protected Preview configuration and public activation. No Production deploy
   is authorised by the overnight request.

## Source readiness

Public research is reference material, not a rights grant:
- AFL position definitions and current-season reference:
  https://www.afl.com.au/news/1456989/fantasy-2026-every-player-every-position
- Provider coverage and identifiers:
  https://developer.sportradar.com/aussie-rules-football/reference/aussie-rules-overview
- Provider season-player endpoint change log:
  https://developer.sportradar.com/aussie-rules-football/reference/aussie-rules-change-log

No real player catalogue imported. No claims of real-device iOS/Android testing;
browser evidence uses Chromium at the specified dimensions.

## Additional sport checkpoint

- NRL proposal: WFB1–2, CTR1–2, HLF1–2, EDG1–3, MID1–3, FLEX1.
- NBA proposal uses the existing `basketball` identifier: PG1, SG1, SF1, PF1,
  C1, FLEX1–3. Verified multi-position eligibility is supported.
- EPL retains `football` for catalogue/lineups and `epl` for the existing
  scoring engine, and the existing GK1, DEF1–4, MID1–4, FWD1–2 formation.
- Migration `20261021122246_additional_sport_sandbox_formats.sql` extends the
  same isolated fixture/inventory adapters. NBA/EPL snapshots freeze every
  applicable fixture ID, rather than rejecting a player with two games.
- NBA scoring requires explicit UTC start/end instants and a named timezone.
  Windows are start-inclusive/end-exclusive; fixtures outside them are rejected.
  EPL uses explicit confirmed blank-player membership; missing fixtures are not
  automatically labelled byes. Finalisation waits for the window to close and
  the existing correction/completion requirements.
- NRL/NBA strict event schemas require a complete explicit weight map. There
  are **no default approved weights**. Tests use artificial one-centipoint event
  coefficients to verify arithmetic, not a proposed commercial scoring system.
- The existing isolated scoring journal accepts NRL/NBA identifiers; its
  immutable append chain, simulated-only scope and restricted grants remain
  enforced. Round-trip persistence and write denial are covered by database tests.
- Existing stored scoring result/journal shape is unchanged. Completion counts
  use a separate read projection so adding them does not rewrite replay hashes.
- Canonical jersey renderer gains original NRL, NBA and EPL silhouettes. No
  league, team, sponsor or manufacturer marks were added.
- Staff competitions workspace links to `/admin/sports`. Authorised staff see
  activation requirements when the laboratory is disabled, not a generic error.
- Public sport switching still leaves new sports disabled. NRL/NBA labels are
  present; enabling a new sport is not an incidental side effect of this release.

## Defects found and corrected during acceptance

1. The old optimiser explored equivalent AFL slots separately. Collapsing only
   equivalent eligibility masks retains exact optimisation and avoids that
   permutation explosion. Unknown performance is still not treated as zero.
2. The save engine assumed one fixture per player. Its shared mapping helper now
   permits multiple distinct frozen fixtures for NBA/EPL; AFL/NFL remain single
   fixture formats. No current NFL competition rule was changed.
3. A saved draft could be hidden by a previously confirmed sandbox entry. The
   view now compares authoritative save times; a newer private draft is visible
   before lock, while locked views always show the submitted snapshot.
4. Retried sandbox requests now retain their idempotency key for the same payload.
   Mode/week switching is disabled during a request. Refresh is bounded and
   preserves the screen on failure. A server-relative clock updates lock state.
5. Historical slots absent from a later visual format remain visible under
   “Saved positions”; they are never silently dropped or reassigned.
6. Both sandbox reads and writes now require MFA at the SQL boundary, in addition
   to the existing staff route, isolated environment and explicit account scope.

## Roster evidence and import readiness

`src/core/sport-roster-review.ts` supplies a strict provider-neutral evidence
contract. Each candidate carries sport/season, internal and provider identity,
team, registration, availability, verified positions, optional verified number,
source URL/hash and observation time. A reviewed rights policy and complete team
fetch are required. Duplicate identities, conflicting scope, stale observations,
unverified positions/numbers and incomplete fetches enter a quarantined report.
Injury/suspension alone does not exclude a contracted player; reserve/loan/
temporary registration policy must be specified. Existing assets are never edited.

Run offline, without database writes or fetching provider data:

```
node node_modules/tsx/dist/cli.mjs scripts/review-sport-roster.ts evidence.json new-report.json
```

Input contains `policy`, `completeTeamIds`, and `candidates` matching the exported
schemas. The command refuses to overwrite a report. Output is an owner-review
queue artifact, **not a published catalogue** or approval to issue cards. No real
candidate file was available, so real player totals, excluded-player counts and
jersey coverage cannot honestly be reported. A hosted review/import workflow
still requires the selected provider and its approved evidence/registration policy.

Additional primary provider references inspected (coverage is not a rights grant):
- [NBA player profile](https://developer.sportradar.com/basketball/reference/nba-player-profile)
  documents provider player IDs and profile/statistics access.
- [Rugby competitions](https://developer.sportradar.com/rugby/reference/rugby-competitions)
  distinguishes Rugby League from Rugby Union; NRL competition and per-player
  category coverage still need verification against the selected subscription.
- [EPL squad endpoint](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-squads/get-team-squad-by-team-id)
  exposes player/team/position identifiers; it does not by itself establish all
  required contractual or Docked fantasy-position rights.

## Protected Preview and deployment status

**Production unchanged. No hosted migrations, settings, issuance or competitions
were changed. No deployment was performed.**

Read-only checks on 21 October 2026:
- Vercel project `docked-production` / `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`
  belongs to team `team_tf6xweKKyVCj9bTppUKttJ4l`. SSO protection is enabled
  for deployments except custom domains; password protection is present.
- Supabase connector access to the configured isolated Preview project
  `bckkllmndoxzpzdqrevb` was denied. Its current state, schema and credentials
  therefore could not be verified. No alternate access path was used to bypass
  that denial. A protected hosted acceptance URL has not been created.

Reviewable Preview steps once access is available:
1. Confirm the intended isolated Supabase project and restricted app role; never
   substitute `pojoymtniryarxxunyvz` (Production).
2. Inspect its migration baseline and apply the two multi-sport migrations in
   order, including the final MFA/draft-projection amendments in the first file.
3. Install only explicitly labelled fictional sandbox fixtures, allowlist the
   intended staff test identities, and retain existing MFA/admission controls.
   The disposable test fixture is `tests/fixtures/multi-sport-db.ts`; it never
   writes to a hosted database or real inventory.
4. Configure Preview-only `FANTASY_CARDS_PREVIEW=true`, `APP_ENV=preview`,
   `SUPABASE_ENV=preview`, `DOCKED_MULTI_SPORT_SANDBOX=true`, and verified isolated
   Auth/database bindings. Keep all issuance, real-money and public activation
   controls closed.
5. Build the exact committed revision as a protected Preview, verify both
   unauthorised denial and staff-MFA acceptance, then repeat the browser journeys.
   Production release needs a separate explicit approval.

## Exact owner decisions and recommended options

| Decision | Recommendation and reason |
| --- | --- |
| Provider, credentials and licensed uses per sport | Obtain sample rosters, fixtures, player statistics and corrections plus written fantasy/storage/publication rights before binding an adapter. Published docs and trials are not enough. |
| Active registration policy | Keep active contracted injured/suspended players; separately approve reserves, loans and temporary assignments for each league. Quarantine ambiguous evidence. |
| NRL/NBA format and scoring | Review proposed 13/8-slot formats with verified position coverage. Approve versioned event definitions/weights only after coverage is proven. No numeric scoring proposal has been activated. |
| AFL scoring release | Review the existing repository v2 event model applied to 22 slots; retain all older versions unchanged. Confirm rights before official scoring. |
| NBA weekly window / postponed games | Freeze an explicit timezone and UTC interval per round; use all mapped games. Leave unresolved postponed/cancelled games pending until the owner-approved exception policy resolves them. |
| Traditional salaries/caps | Calibrate from licensed performance distributions for each roster size, test feasible owned-card combinations, then approve the versioned salary table and cap. Do not reuse NFL’s cap or QA units. |
| New packs and editions | Approve new-sport nine-card product prices, odds, allocations and starter entitlements together. Preserve NFL’s existing 1/3/9 products and supply history. |
| Preview access | Restore connector access to the existing isolated project, or explicitly designate another isolated project and review its binding before deployment. |
| Public release | Separate approval after protected acceptance and catalogue/rules validation. Keep new sport and issuance gates off until then. |
| Swap wording in expansion brief | Retain the current fixed-price marketplace. Do not resurrect retired swaps/card-plus-credit offers without an explicit economy decision. |

## Verification limits

The implemented, testable foundation covers lineup persistence/rendering and
scoring contracts. Live new-sport game-day feeds, production catalogues, scored
rounds, paid packs, sport-wide marketplace/Social publication and hosted owner
review are not claimed complete. They depend on approved data/configuration and
the remaining integration/hosted acceptance described above. Existing NFL economy,
wallet, ownership, marketplace, Social and historical scoring are regression tested.
Chromium viewport emulation is not proof on physical Samsung/iOS devices.

## Final local verification

| Check | Result |
| --- | --- |
| Full platform suite | 539 passed, 0 failed, 0 skipped |
| Full database suite | 194 passed, 0 failed, 0 skipped |
| Final scoring-window / existing AFL/NFL/EPL scoring run | 15 passed |
| New journal persistence and shared additional-sport command run | 3 passed |
| Restricted web role / SQL MFA / history / privacy | AFL and additional-sport tests passed |
| Typecheck | Passed |
| Full lint (`src scripts tests`, zero-warning policy) | Passed |
| Clean build and canary credential boundary | Passed; see `build.txt` and `client-boundary.txt` |
| Four sport browser journeys | All passed at 360, 412, 1024, 1440 and 1536px; no horizontal overflow or page exceptions |
| Rarity gallery | Six canonical frames per sport at 360, 412 and 1440px; original silhouettes, blank unknown numbers, no overflow |
| Own versus community/history slots | Exact card IDs and slot IDs compared: AFL22, NRL13, NBA8, EPL11 |
| Git whitespace validation | Passed for task files |

Browser acceptance includes initial Auto Select preview/Apply, Save draft,
Confirm entry, independent future rollover, manual replacement, unchanged prior
entry, saved draft after submission surviving reload, explicit re-confirmation,
locked history and another member's locked slots. Read-only SQL inspection and
mutations used disposable fictional fixtures only. Real HTTP Auth/MFA transport
was not exercised against a hosted Preview; restricted database role/MFA checks
and existing auth regression tests were exercised locally.

Actual inspected screenshots:
- [AFL mobile field](afl/field-412.png) and [desktop list](afl/list-1440.png).
- [NRL mobile field](nrl/field-412.png).
- [NBA desktop court](basketball/field-1440.png).
- [EPL mobile pitch](football/field-412.png).
- [AFL rarities](afl/rarities-412.png), [NRL narrow rarities](nrl/rarities-360.png),
  [NBA desktop rarities](basketball/rarities-1440.png), [EPL rarities](football/rarities-412.png).

Reproduce locally from the worktree:

```
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=2 tests/platform/*.test.ts
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=2 tests/database/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src scripts tests --max-warnings=0
node scripts/marketplace-build-local.mjs --multi-sport
node node_modules/tsx/dist/cli.mjs scripts/afl-acceptance-browser.ts afl
node node_modules/tsx/dist/cli.mjs scripts/afl-acceptance-browser.ts nrl
node node_modules/tsx/dist/cli.mjs scripts/afl-acceptance-browser.ts basketball
node node_modules/tsx/dist/cli.mjs scripts/afl-acceptance-browser.ts football
```

The build helper uses a new isolated temporary source copy, a clean environment
and fake server-secret canaries. It does not deploy. Existing unrelated dirty QA
artifacts in this shared worktree were preserved and are excluded from the commits.
