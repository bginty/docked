# Owner pack awards and current player rosters

## Release status

Prepared and verified locally. Neither feature is published or deployed.
`PRODUCTION_READONLY.json` records a fresh read-only check: the live website is
still source `83794e9ac31c54960bfc76b9a07b36047f20486b`, both new feature tables
are absent, and Marketplace transfers remain disabled. No production migration,
roster update, customer award, payment or customer communication was performed.

The combined branch is `codex/current-rosters-20261122`. It includes the
completed Owner pack-award candidate as its parent and preserves the live
Commercial operations, Owner customer-view and default landing improvements.
The remote review base is `58841a60b4e4c57d9c410c4f1c2e315ee8bf20d2`, which adds
only deployment evidence after the live source.

## Owner pack awards

Commercial operations and customer records link to `/admin/pack-awards`.
An Owner can select a member, mix Standard and Premium 1-, 3- and 9-card packs,
set quantities, choose Promotion or Prize, and review the exact award before
issuing it. The maximum is 20 packs per request for one member.

One Premium 1-card pack and one Standard 9-card pack produces two sealed packs
and ten allocated cards in the member's My Packs. Awards do not issue or debit
wallet credits, create Google purchases, or change monetary journals.
The customer sees Free and Promotion/Prize provenance. The internal reference
and issuing Owner remain in the private Owner audit.

The award uses the same allocation, odds, supply and new roster rules as paid
packs. Retries recover the same immutable receipt and pack IDs. Existing Owner
MFA, recipient eligibility, account restrictions and recovery holds still apply.
The earlier award-only evidence is retained under
`../owner-pack-awards-20261122/`; the combined results here supersede its
verification for this branch.

## Player lifecycle

| Reviewed registration | Future paid and free pack allocation | Previously issued cards |
| --- | --- | --- |
| Active | Eligible subject to approved remaining supply and normal commercial checks | Retained |
| Delisted, retired, unsigned, pending re-list or unknown | Excluded | Retained, with existing ownership and trading rules |
| Verified return after an exclusion | Same player identity and existing definition/supply history resume, if approved | Retained |
| New verified draftee | Five canonical definitions can be registered dormant, then explicitly activated under current approval | No cards are minted by roster registration |

Injury and suspension are separate availability facts; they do not automatically
become a delisting. A partial source, failed fetch or missing row cannot delete
players or reverse a negative decision. An existing held definition stays held
when a player becomes ACTIVE.

**Packs allocate their contents when purchased or awarded.** A pack already
issued before a roster decision keeps those allocations when opened later.
The new rule controls future allocation, not the replacement of owned cards.
Opening a pack does not draw again. Card IDs, serials, original edition clubs,
ownership receipts and lifetime supply are not rewritten.

Existing definitions without a reviewed roster event retain their approved-pool
behavior and are explicitly labelled **Unreviewed legacy**. This release does
not claim every current player in every sport has been independently re-audited.

## Owner roster and export

`/admin/rosters` is linked from Commercial operations and the Cards workspace.
It provides one row per canonical player, including verified prospects that do
not yet have definitions. The view and full CSV show player name, sport,
current registration and club, saved card clubs, roster/supply eligibility and
reason, source and review dates, provider identity, current commercial copies,
and lifetime issued/supply by rarity.

Sort order is sport, reviewed current club (or labelled legacy saved club),
then player name and canonical ID. Filters cover sport, club, name/ID,
registration, eligibility and review state. Legacy saved-club choices are
clearly labelled as unverified current-club facts. Current commercial copies
and lifetime issuance including historical supply are separate counts.

The view shows 100 rows per page. CSV downloads every matching row across all
pages from one consistent database snapshot and refuses incomplete or duplicate
canonical results. Spreadsheet formula characters are neutralised.

`AFL_OWNER_AUDIT.csv` is an immediate snapshot of the 542 captured AFL records,
sorted by saved club/name. Its proposed changes are labelled **not applied**;
saved card clubs and statuses are not asserted to be current registrations.

## AFL findings as at 22 November 2026

The production census contains 542 canonical AFL players, 2,690 definitions,
2,680 approved definitions and 342 lifetime-issued copies, including 308
historical copies. `AFL_CENSUS.json` preserves the exact captured records.

The official outgoing register contains 158 events. Five match existing
commercial identities by exact name and saved club, corroborated with official
individual player profiles. The remaining 153 do not cause guessed removals.

| Existing player | Proposed registration | Approved definitions | Lifetime issued |
| --- | --- | ---: | ---: |
| Riley Garcia | Pending re-list | 5 | 0 |
| Ryan Byrnes | Pending re-list | 0 | 1 |
| Jack Carroll | Delisted | 0 | 1 |
| Dougal Howard | Retired | 0 | 1 |
| Dane Rampe | Retired | 0 | 1 |

Riley Garcia is the currently drawable player identified for exclusion by this
exact reconciliation. The other four already have no approved definitions.
Completed national-draft returns for Elliott Himmelberg and Jamarra Ugle-Hagan
produce ACTIVE proposals under their existing identities. Ugle-Hagan's held
definition remains held; an ACTIVE record does not approve it or add rarities.

`AFL_REVIEWED_EXISTING_BATCH.json` is the exact prepared seven-player payload.
It contains no definition registration, new alias or financial mutation. It
has a persistent request ID for safe retry and expected empty roster revisions
for the first application. Before applying, refresh sources and current
revisions; later decisions must not be overwritten using an obsolete batch.

The completed national-draft table has 65 distinct selections, including the
two existing Suns identities. The initial review retained the other 63 as
unresolved candidates. Subsequent official-profile and club-source research
established nine additional identities: Gus Kennedy, Ethan Drever, Archie
Elliott, Lachlan Hicks, Cooper Hodge, Arki Butler, Caylen Murray, Mitch Knevitt
(Mitchell in the selection table), and Jack Riding. The two supplemental
`DRAFT_IDENTITY_REVIEW_*.json` records preserve the factual evidence and its
capture limits; they do not claim activation authority.

`AFL_REVIEWED_NEW_BATCH.json` prepares those nine as ACTIVE roster candidates
with five dormant definitions each. `AFL_NEW_PLAYER_PLAN.json` explains the
canonical identity choices, source hashes, position mappings, current-club
identities and remaining 54 selections. `AFL_NEW_DORMANT_DEFINITIONS.json`
contains the exact 45 unapproved, zero-issuance rows generated by the existing
definition factory. These are **prepared data, not active Docked players**.
The live 542-player CSV remains a separate current-census snapshot.

The numeric IDs are explicitly namespaced as `afl-public-profile`; they are
observed public AFL profile-path IDs, not asserted Champion Data IDs or
Wikimedia QIDs. Docked's existing hash-based UUID recipe assigns an internal
canonical ID from this namespace. Known historical identity registries and
name variants are checked before this proposed new binding. Later provider
aliases must bind to the same canonical player, not create another player.

The new snapshots retain the current catalogue's 2026 edition label and
Docked's existing club palette. This label does not assert a 2026 senior match
appearance. Jersey numbers remain unknown. No player image or biography is
copied and no licence to the source pages is asserted. Definition activation
still requires the existing current rights-approval boundary.

**54 national selections still need resolved identity or position evidence.**
Conflicting official DOB records for Xavier Ladbrook, Harvie Cooke and Brady
Wright remain unresolved. This group includes returning players, not only
first-time draftees. No stable provider IDs or positions have been invented.
The public site's JSON endpoint returned 401 and no authenticated workaround
was attempted. Missing or conflicting evidence is not a deletion instruction.

The rookie/pre-season draft is scheduled for Monday 23 November at 3 pm AEDT.
An intention to re-draft a player is not a completed return. Refresh the review
after actual selections. `AFL_REVIEW.json` records the official source URLs,
capture hashes, timestamp discrepancies and the 65-versus-63 article counting
ambiguity. It is the detailed review record; the source capture script creates
an initial evidence collection, not an automatically approved roster import.

Primary references:

- https://www.afl.com.au/news/retirements-and-delistings
- https://www.afl.com.au/news/1642221/who-did-you-pick-the-rundown-on-every-clubs-2026-draft-haul/
- https://www.afl.com.au/news/1642929/rookie-draft-preview-take-a-look-at-the-players-who-could-be-drafted-in-the-2026-pre-season-and-rookie-drafts
- https://www.afl.com.au/news/1636335/luckless-western-bulldog-riley-garcia-delisted-set-to-get-rookie-lifeline
- https://www.goldcoastfc.com.au/news/2167089/suns-re-select-ugle-hagan-and-himmelberg

## Verification and remaining acceptance

- 55 focused platform tests passed on Node 22.23.5, zero failures or skips.
  Six data tests validate both exact roster batches, the 45 dormant definitions,
  independent source captures, club mappings and the nine/54 candidate split.
- All 24 native PostgreSQL 17.10 checks passed: the 15 prior paid/free award
  regressions and nine roster checks, including simultaneous draws/removals,
  actual retired-card trading, old sealed-pack opening, same-ID serial
  continuation, staged prospect updates and direct-runtime input rejection.
- Zero lifetime-supply mismatches, duplicate serials or incomplete packs.
- Supabase CLI security advisor returned no issues against the disposable
  local fixture. This is not a hosted-production advisor claim.
- Full TypeScript, full lint and the optimized production build passed.
- Real component SSR and CSS checks passed. No browser, hosted flow or installed
  Android acceptance is represented as executed.

`DATABASE.json` records the hash of the actual migration loaded during the
successful native run. `ADVISORS.json` contains the local advisor result.
`PLATFORM.tap` records the final 55-test run; `BUILD.log` preserves the successful
production build. No application runtime source changed after that build.
`VERIFICATION.json` records the exact source and evidence checksums.
Older standalone billing/supply scripts with historical migration bootstraps
were not rerun or represented as passing.

The independent review found and fixed stale repeatable-read write snapshots,
malformed permanent candidate data through direct SQL, an alias-binding race,
and a staged prospect that could otherwise become stranded by newer evidence.
Write boundaries require READ COMMITTED; read-only reports retain a consistent
repeatable-read snapshot. Existing immutable asset and financial guards remain.

## Publication and rollout

Automatic approval review rejected two external actions: uploading source to a
temporary Vercel Sandbox for browser tests, and publishing the implementation
to the public `bginty/docked` GitHub repository. Neither upload happened. The
unused non-persistent Sandbox was stopped. Explicit source-publication and
test-upload permission is needed before retrying those exact destinations.

The reviewable release contains these additive migrations, in order:

1. `supabase/migrations/20261122005246_owner_pack_awards.sql`
2. `supabase/migrations/20261122011302_commercial_player_roster.sql`

After publication is authorised, run the prepared award browser fixture plus
Owner roster/filter/CSV/mobile acceptance in an authorised test environment.
Retain the existing shared Preview's limited mutation scope. Recheck production
source/schema drift, backup/recovery readiness and current roster evidence.
Apply migrations before deploying the compatible web application, verify the
new routes and normal paid purchase behavior, then apply the reviewed roster
decisions. No real customer pack is to be issued as a test.

The checkout used for local work is sparse. Deployment must use the complete
repository tree and assets, not a bare upload of this sparse filesystem.
There are no Android binary or billing-product changes in this candidate;
installed-app navigation and export handoff still require acceptance.

If issuance must stop, use the existing issuance pause. Retain committed
awards, roster decisions, cards and receipts. Never delete owned cards or reset
serials as a rollback. Old web code can attempt to select a roster-excluded
player and be rejected by the database guard, so pause issuance when reverting
to a web version without roster-aware allocation.

## Local reproduction

Use Node 22 and the pinned repository lockfile. The native runner creates and
removes an isolated loopback-only PostgreSQL fixture with fictional members.

```bash
node --import tsx --test --test-concurrency=2 tests/platform/owner-pack-awards.test.ts tests/platform/owner-pack-awards-route.test.ts tests/platform/owner-rosters.test.ts tests/platform/owner-rosters-ui.test.ts tests/platform/commercial-player-roster.test.ts tests/platform/afl-reviewed-roster-data.test.ts tests/platform/post-beta-owner.test.ts tests/platform/post-beta-owner-routes.test.ts tests/platform/commercial-pack-supply.test.ts tests/platform/pack-shopping.test.ts tests/platform/commercial-pool-plan.test.ts
OWNER_PACK_AWARDS_PG_RUNTIME=/absolute/runtime/node_modules/embedded-postgres DOCKED_DB_TEST_REPORT_DIR=docs/qa/current-rosters-20261122 node scripts/owner-pack-awards-local-postgres.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src scripts tests --max-warnings=0
node node_modules/next/dist/bin/next build
```

The separate embedded runtime is `embedded-postgres@17.10.0-beta.17`. No
production connection string is accepted by the native acceptance runner.
