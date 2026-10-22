# Source-verified private-beta roster snapshot

This is an operator-run, reviewable import preparation workflow, not a scheduled roster feed. It uses the documented Wikimedia Action API with a descriptive User-Agent, sequential requests and maxlag. Wikipedia content is reused under CC BY-SA 4.0; Wikidata identifiers are CC0. See `/roster-sources` for attribution and the downloadable derivative dataset. These permissions do not establish commercial collectible, publicity, logo or statistics rights.

Install the pinned Python parser dependencies in `private-data/roster-parser` using `python -m pip install --target private-data/roster-parser -r scripts/wikimedia-rosters/requirements.txt`.

Run from the application root, in order:

1. `node scripts/wikimedia-rosters/fetch-nba-east.mjs`
2. `node scripts/wikimedia-rosters/fetch-rosters.mjs`
3. `python scripts/wikimedia-rosters/discover.py`
4. `node scripts/wikimedia-rosters/discover-nrl-templates.mjs`
5. `node scripts/wikimedia-rosters/fetch-nrl-history.mjs`
6. `python scripts/wikimedia-rosters/discover-nrl-history.py`
7. `node scripts/wikimedia-rosters/fetch-profiles.mjs`
8. `node scripts/wikimedia-rosters/fetch-extra-profiles.mjs`
9. `python scripts/wikimedia-rosters/review.py`
10. `npx tsx scripts/build-roster-beta-catalogue.mts`

Keep the dated raw source cache in `private-data/roster-source-review`. A new season requires a new reviewed snapshot/version and explicit season changes; do not overwrite the published 2026-10-23 dataset. Root revisions and expanded roster payload hashes are retained because transcluded templates may change independently of the root page. Profile revision, retrieval timestamp and source URLs accompany every accepted identity.

The 2026 NRL snapshot replaces three already-2027 squad templates with their latest pre-October 2026 revision and still requires agreement with the fetched player profile. Records with conflicting clubs, missing QIDs or unsupported positions are excluded. Hooker-only NRL players are excluded because the existing provisional lineup has no hooker slot; they are never relabelled as middles. Unknown jersey numbers and contract status remain unknown. Injured/suspended roster members are not removed solely for missing a match.

Review `docs/qa/real-rosters/roster-review.json` and the public dataset before release. Scripts do not write to hosted databases. `scripts/roster-beta-release.mts` separately provides inspect, rollback rehearsal, apply and verification for the exact existing private-beta environment. Live application compatibility must be deployed before activating new product IDs. Permanent player registries, limited issuance and live statistics remain separate and disabled for this dataset.
