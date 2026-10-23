# Reviewed historical match publications

These files are exports from Docked's separate statistics service, not a second scraper or a fantasy competition backfill. They contain real, source-referenced league results and **zero player-game statistics**. They do not create entries, award prizes or change scores.

`afl-2026.json`: 218 matches from [Squiggle](https://api.squiggle.com.au/), whose documented terms explicitly permit commercial API use. 18 teams; all kickoff times present.

`nrl-2026.json`: 213 matches adapted from Wikipedia contributors' [2026 NRL season results](https://en.wikipedia.org/wiki/2026_NRL_season_results) and [finals series](https://en.wikipedia.org/wiki/2026_NRL_finals_series). Revision/attribution links are embedded. **The derived NRL data is licensed CC BY-SA 4.0**: https://creativecommons.org/licenses/by-sa/4.0/ . Changes: structured extraction, UTC conversion, duplicate reconciliation, shared venue expansion, conflicting semifinal time withheld. This licence applies to the derived data, not unrelated application source. 17 teams, 10,167 total points, one unresolved kickoff.

Counts reconcile to the published 2026 season summaries. Grand-final scores were spot-checked against official AFL/NRL articles. Not every match was independently cross-checked.

The server parses/validates these publications once, enforces existing beta authorization, and returns 20 filtered matches per request. Entire seasons are not bundled into card components or returned to browsers. Corrected imports require review and an application release. No automatic historical fantasy recalculation is enabled.

Rebuild with `node scripts/import-historical-fixtures.mjs` after reviewing statistics-service exports. Source-only ingestion can be rerun idempotently; player identity reconciliation and player scoring remain blocked until licensed, complete player records are supplied.
