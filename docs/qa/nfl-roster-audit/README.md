# NFL roster audit and isolated test cleanup — 17 October 2026

Production was read only to create a consistent local snapshot. No hosted rows, balances, roles, feature flags or deployments were changed. Cleanup was committed atomically in an isolated PGlite audit mirror and exported as a separate local prepared state. This is **not** a claim that Barry's live collection has changed or that a full production-schema cleanup migration has run.

## Coverage and decisions

All 32 official team roster pages were retrieved and parsed; their player tables, sections, source URLs, retrieval dates and SHA-256 hashes were retained. Transaction tables were retrieved for 31 teams. Dallas's transaction endpoint returned HTTP 404; its roster was available. Pages are labelled parsed-review-required because unresolved identities remain, not because teams were skipped.

986 existing permanent NFL identities were reconciled. Decisions: eligible: **489**; unsupported: **35**; practice-squad: **154**; quarantine: **208**; reserve: **99**; released: **1**. Verified active positions: QB: 86, RB: 112, WR: 169, TE: 122. The active Standard and Premium acquisition pools each changed **490 → 489** at the audit timestamp. These are fresh, supported product pools, not the total 986-identity historical catalogue.

49 supported-position official-roster rows need identity/catalogue reconciliation. They include unresolved matches as well as possible missing identities; they are **not 49 proven new players**. No new player IDs, definitions, cards or credits were created. A missing definition does not by itself prove a player is unreleased. The existing test product has no distinct first-year/release-approval field; this audit cannot certify a separate rookie release plan. It retains existing product/version, supply and issuance gates.

Full per-player evidence: [JSON](catalogue-audit.json), [CSV](catalogue-audit.csv). Team counts below list eligible QB/RB/WR/TE, excluding reserve/practice-squad/quarantined players.

| Team | Official source | Checked UTC | Roster rows | QB/RB/WR/TE | Transactions |
|---|---|---|---:|---|---|
| ARI | [Roster](https://www.azcardinals.com/team/players-roster/) | 2026-10-17T05:22:05.204Z | 82 | 3/3/6/4 | [retrieved](https://www.azcardinals.com/team/transactions/index) |
| ATL | [Roster](https://www.atlantafalcons.com/team/players-roster/) | 2026-10-17T05:22:06.149Z | 79 | 4/2/5/4 | [retrieved](https://www.atlantafalcons.com/team/transactions/) |
| BAL | [Roster](https://www.baltimoreravens.com/team/players-roster/) | 2026-10-17T05:22:06.768Z | 77 | 3/3/5/4 | [retrieved](https://www.baltimoreravens.com/team/transactions/) |
| BUF | [Roster](https://www.buffalobills.com/team/players-roster/) | 2026-10-17T05:22:07.406Z | 74 | 2/3/6/4 | [retrieved](https://www.buffalobills.com/team/transactions) |
| CAR | [Roster](https://www.panthers.com/team/players-roster/) | 2026-10-17T05:22:07.930Z | 80 | 3/2/5/5 | [retrieved](https://www.panthers.com/team/transactions/) |
| CHI | [Roster](https://www.chicagobears.com/team/players-roster/) | 2026-10-17T05:22:08.915Z | 79 | 3/3/5/3 | [retrieved](https://www.chicagobears.com/team/transactions) |
| CIN | [Roster](https://www.bengals.com/team/players-roster/) | 2026-10-17T05:22:09.333Z | 74 | 2/3/5/5 | [retrieved](https://www.bengals.com/team/transactions/) |
| CLE | [Roster](https://www.clevelandbrowns.com/team/players-roster/) | 2026-10-17T05:22:09.753Z | 79 | 3/3/6/3 | [retrieved](https://www.clevelandbrowns.com/team/transactions/) |
| DAL | [Roster](https://www.dallascowboys.com/team/players-roster/) | 2026-10-17T05:22:10.131Z | 79 | 2/4/6/3 | [unavailable](https://www.dallascowboys.com/team/transactions/) |
| DEN | [Roster](https://www.denverbroncos.com/team/players-roster/) | 2026-10-17T05:22:10.495Z | 79 | 3/4/5/4 | [retrieved](https://www.denverbroncos.com/team/transactions/index) |
| DET | [Roster](https://www.detroitlions.com/team/players-roster/) | 2026-10-17T05:22:10.860Z | 80 | 2/3/4/4 | [retrieved](https://www.detroitlions.com/team/transactions/index) |
| GB | [Roster](https://www.packers.com/team/players-roster/) | 2026-10-17T05:22:11.217Z | 80 | 2/3/5/4 | [retrieved](https://www.packers.com/team/transactions/index) |
| HOU | [Roster](https://www.houstontexans.com/team/players-roster/) | 2026-10-17T05:22:11.597Z | 86 | 2/3/5/5 | [retrieved](https://www.houstontexans.com/team/transactions/index) |
| IND | [Roster](https://www.colts.com/team/players-roster/) | 2026-10-17T05:22:12.109Z | 76 | 3/3/6/3 | [retrieved](https://www.colts.com/team/transactions/index) |
| JAX | [Roster](https://www.jaguars.com/team/players-roster/) | 2026-10-17T05:22:12.595Z | 78 | 2/4/6/4 | [retrieved](https://www.jaguars.com/team/transactions) |
| KC | [Roster](https://www.chiefs.com/team/players-roster/) | 2026-10-17T05:22:13.080Z | 77 | 3/4/5/4 | [retrieved](https://www.chiefs.com/team/transactions/) |
| LAC | [Roster](https://www.chargers.com/team/players-roster/) | 2026-10-17T05:22:13.511Z | 80 | 2/4/7/3 | [retrieved](https://www.chargers.com/team/transactions/) |
| LAR | [Roster](https://www.therams.com/team/players-roster/) | 2026-10-17T05:22:13.991Z | 77 | 3/3/7/5 | [retrieved](https://www.therams.com/team/transactions/index) |
| LV | [Roster](https://www.raiders.com/team/players-roster/) | 2026-10-17T05:22:14.403Z | 80 | 3/4/5/3 | [retrieved](https://www.raiders.com/team/transactions) |
| MIA | [Roster](https://www.miamidolphins.com/team/players-roster/) | 2026-10-17T05:22:14.802Z | 77 | 2/4/5/4 | [retrieved](https://www.miamidolphins.com/team/transactions/) |
| MIN | [Roster](https://www.vikings.com/team/players-roster/) | 2026-10-17T05:22:15.211Z | 76 | 3/4/5/3 | [retrieved](https://www.vikings.com/team/transactions/) |
| NE | [Roster](https://www.patriots.com/team/players-roster/) | 2026-10-17T05:22:15.635Z | 83 | 3/3/4/4 | [retrieved](https://www.patriots.com/team/transactions/) |
| NO | [Roster](https://www.neworleanssaints.com/team/players-roster/) | 2026-10-17T05:22:16.064Z | 81 | 3/3/4/4 | [retrieved](https://www.neworleanssaints.com/team/transactions/) |
| NYG | [Roster](https://www.giants.com/team/players-roster/) | 2026-10-17T05:22:16.488Z | 81 | 3/5/4/4 | [retrieved](https://www.giants.com/team/transactions/) |
| NYJ | [Roster](https://www.newyorkjets.com/team/players-roster/) | 2026-10-17T05:22:16.920Z | 80 | 2/5/5/4 | [retrieved](https://www.newyorkjets.com/team/transactions/) |
| PHI | [Roster](https://www.philadelphiaeagles.com/team/players-roster/) | 2026-10-17T05:22:17.295Z | 79 | 3/3/6/3 | [retrieved](https://www.philadelphiaeagles.com/team/transactions) |
| PIT | [Roster](https://www.steelers.com/team/players-roster/) | 2026-10-17T05:22:17.675Z | 78 | 4/5/5/3 | [retrieved](https://www.steelers.com/team/transactions/) |
| SEA | [Roster](https://www.seahawks.com/team/players-roster/) | 2026-10-17T05:22:18.043Z | 80 | 3/4/6/4 | [retrieved](https://www.seahawks.com/team/transactions/index) |
| SF | [Roster](https://www.49ers.com/team/players-roster/) | 2026-10-17T05:22:18.440Z | 89 | 3/4/5/3 | [retrieved](https://www.49ers.com/team/transactions) |
| TB | [Roster](https://www.buccaneers.com/team/players-roster/) | 2026-10-17T05:22:19.280Z | 74 | 2/3/5/4 | [retrieved](https://www.buccaneers.com/team/transactions/index) |
| TEN | [Roster](https://www.tennesseetitans.com/team/players-roster/) | 2026-10-17T05:22:19.882Z | 79 | 2/5/5/4 | [retrieved](https://www.tennesseetitans.com/team/transactions/index) |
| WAS | [Roster](https://www.commanders.com/team/players-roster/) | 2026-10-17T05:22:20.324Z | 80 | 3/3/6/4 | [retrieved](https://www.commanders.com/team/transactions/) |

## Exact local removals

Eight active test card instances, eight current ownership records and eight active ownership-history projections were removed for seven players. Original history and approvals were archived, not erased. Six players are verified kickers; Docked's seven-player rules support QB/RB/WR/TE only. Ryan Miller has an explicit Miami release on 13 October and no match across all 32 current official roster pages. [Miami announcement](https://www.miamidolphins.com/news/dolphins-make-roster-moves-x9196).

| Player | Removed card ID | Evidence/reason |
|---|---|---|
| Wil Lutz | 7c92289b-72a5-4d31-a28f-cbf9e8b40be7 | Official position K |
| Ka'imi Fairbairn | f1577764-b6e7-4dd0-b058-388530fb83af | Official position K |
| Eddy Pineiro | 4e9c092d-43f7-4b97-b225-6c95dc588fa3 | Official position K |
| Chase McLaughlin | 02ada864-39a5-4935-b271-3a09359579bf | Official position K |
| Chase McLaughlin | dea83257-2efe-43b5-afd4-5ac0366d6b1d | Official position K |
| Ryan Miller | 01227a90-2deb-41d7-959d-856b2dbf2ad2 | Miami official 13 October release; absent across all 32 current official roster pages |
| Jake Bates | 6adfb683-728c-4fb0-842a-20de80d808c2 | Official position K |
| Harrison Mevis | 5fdf6268-8607-45eb-81c9-9f03934ef2c1 | Official position K |

Exact player IDs and dependencies: [pre-execution removal manifest](removal-manifest.json), [result](cleanup-result.json), [CSV](removals.csv).

Zero listings, swaps, private offers, unopened packs, test lineups or drafts referenced these eight cards. No lineup recalculation was needed; no selections were invented. Six already-opened saved pack views now show seven or eight remaining cards and an audit notice. Their original nine-card issuance receipts remain immutable historical records. Eight retired allocation tombstones permanently consume their serials; scarcity and approved maximum supply are unchanged.

The cleanup checks active ownership, card instances, pack sources, listing and offer references, plus captured relational dependencies. There are zero active orphan references. Audit tombstones and immutable receipts intentionally reference removed allocations. Wallet journals/lots, accounts, unrelated cards and every other captured table compare unchanged. Historical player statistics were not written or recalculated.

## Recovery and execution evidence

The repeatable-read, read-only snapshot is stored privately at 'private-data/nfl-roster-audit/snapshot-1792214552985.json' (not committed). SHA-256: '7f79214ed0ae8a2db426ff7cdcec5688264d97d4803400de3de53aea2c47fb69'.

The pre-execution manifest was written before the local transaction. Reruns preserve its original timestamp and validate source, manifest and post-state hashes. The local PGlite transaction locks the copy, records the manifest/archive and changes the copy atomically. A second execution is a no-op. Local outputs: 'private-data/nfl-roster-audit/cleaned-local-copy.json' and 'verified-local-state.json'; audit database: 'tmp/nfl-roster-cleanup-7f79214ed0ae'.

The local runner fails closed if a new relational lineup/pack/trading dependency appears. It does not pretend to support arbitrary historical lineup rewrites. The captured removal set has none. Restore locally by verifying the snapshot hash, loading its preimage into a new isolated store and retaining the removal audit; never overwrite a hosted database with this export.

## Feed mapping review and remaining identities

All 56 missing feed identities and nine position conflicts were revisited. Current roster classification: eligible: 58, practice-squad: 3, quarantine: 2, reserve: 2. See [65-record review](feed-mapping-review.json). A roster match does not establish a historical feed identity; no fuzzy-name mappings or historical score rewrites were applied.

208 catalogue records remain quarantined from new issuance. Their owned cards remain unless separately verified for removal. Examples include Audric Estimé appearing on both Cleveland and Minnesota official rosters; that conflict does not justify deleting his card. Justin Jefferson and Michael Carter name collisions are disambiguated using the existing GSIS identity, official profile, team, jersey and position. Three explicit corroborated aliases are retained in the reconciliation command. IR, PUP/NFI, suspended and practice-squad identities are retained. Absence from a statistics feed never proves release.

## Implemented enforcement

The shared acquisition policy derives positions from 'config/nfl-seven-v1.json'. It requires a verified official identity, supported position, active status and evidence at most 72 hours old when the versioned roster policy is enabled. FB/HB labels preserve an existing fantasy RB classification; dual-role labels do not introduce IDP. The same gate is used in pack preview and secure allocation. Unopened pre-generated packs with newly ineligible players are held for review without charge, reroll or loss of entitlement. Existing saved results remain viewable.

The prepared SQL migration adds private append-only evidence, least-privilege runtime reads and direct mint guards on both card stores. Official evidence is explicitly disabled in the migration until reviewed activation; unsupported NFL positions are always denied by its mint guard. Historical lineup/scoring rules are unchanged. The schema is tested locally; it has not been installed remotely.

See [central policy and rollout plan](../../NFL_ROSTER_POLICY.md) for refresh, outage, activation and rollback details. Hosted cleanup requires a separate reviewed archive/projection-guard transition: the current production immutable aggregate guard must not be bypassed to install the cleaned JSON. The second prepared migration applies the same gate before starter and Weekly Core SQL selection. The full-schema weekly test verifies insufficient-pool rollback, entitlement preservation and successful opening after a verified roster update. Hosted acceptance remains pending.

## Verification

- Platform regressions: 454 cases; initial run passed 451, with three disposable Git-fixture failures caused by sandbox permissions. Those same three passed outside the sandbox. Both logs retained.
- Database regressions: 177/177 passed in isolated PostgreSQL-compatible tests.
- Focused eligibility/cleanup/catalogue and SQL tests: 7/7 passed, including stale evidence, reserve/PS, upstream failure, trades, conflicting IDs, direct mint denial, rollback, private evidence, entitlement preservation, retry identity validation and replay notices.
- Clean production build and client-boundary canary scan passed; initial build attempt was blocked by Windows junction permissions and was retried outside the sandbox. No credentials were used by the build.
- Typecheck and lint passed. Final logs are retained beside this report.
- Actual shared pack viewer rendered at 1440, 1024, 412 and 360px with a real cleaned local saved receipt. Removal notice and controls were inspected. Reveal All showed only retained cards; Escape closed the dialog and released the body scroll lock at all four widths. No horizontal overflow. These are local component/browser checks, not authenticated hosted or physical Samsung acceptance.

[Desktop replay](replay-1440.png) · [Tablet replay](replay-1024.png) · [412px replay](replay-412.png) · [360px replay](replay-360.png).

No Preview or production deployment was performed. Production cleanup, unresolved identity approval, hosted evidence refresh and physical-device checks remain pending.
