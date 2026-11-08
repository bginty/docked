SPORT SCORING / HISTORY CHANGE — 2026-11-08

Root cause
The general /fantasy/scoring/how-it-works route loaded fantasyRequest().state.review.rounds and built a Competition dropdown from those records. Those are published fantasy competitions, not the complete historical statistics archive. The existing NFL history importer separately publishes real player-game observations into nfl_history. The rules screen never queried that publication. Its fallback card-player-history SQL also joins registered member competitions. Therefore the three visible selections could not describe all imported rounds.

Production read-only evidence
The current real NFL publication contains rounds 1–9. Round 8 has 980 player-game records across 14 games, of which 272 have reviewed offensive-player mappings. Round 9 has 71 records across one game, 21 mapped. See production-readonly.json. These counts are not claims of round finality, complete field coverage or competition eligibility. AFL and NRL archives explicitly contain match results only (zero player-game statistics); no fictional scoring history was added.

Implementation
- General scoring now uses the existing sport navigation and current sport scoring reference. No competition selector or default practice round appears.
- Authenticated no-store scoring-history API enforces the existing sport/session/capability gates. NFL reads one consistent published generation through the existing restricted history reader role, with 40-row pagination and player search. No new role, grant, migration, ownership or wallet access.
- NFL uses the same nflPlayerHistory calculation as player cards: reviewed identity mapping, current corrected revision, missing-vs-zero semantics, synthetic/tombstone exclusion and once-only base scoring. It does not apply card rarity to history scores.
- The UI explicitly identifies history points as base points calculated using the displayed sport reference version. Historical competition entry scores still use their saved rules; exact ?competition= and ?version= routes remain available and unchanged in their calculations.
- AFL and NRL use existing approved event coefficients and disclose that player statistics are not available, with access to their separate match-results archive.
- A scoped wrapping fix removes inherited table nowrap overflow at 320px.

Safety / deployment
No database migration or Android binary change is required. No competitions created or opened. NBA and all economic/feature gates unchanged. No paid/statistics-source licence or importer activation implied. Production deployment is owned by the parent release task.

Validation
- Four platform tests passed: authoritative coefficients/historical preservation, independent rounds, downward correction/dedup/missing/zero/tombstone/synthetic handling, conflicting revision rejection.
- One PGlite PostgreSQL integration test passed using the actual historical schema and restricted reader role: Round 8 without any competition tables, 42-player pagination/search, protected wallet SELECT and history UPDATE denied, publication lease fail-closed, sentinel balance preserved.
- Scoped ESLint passed for all changed TypeScript/TSX, route and tests. git diff --check passed. Parent release task owns final combined typecheck/build.
- Final Playwright run: 3/3 passed in 40.5 seconds at 320, 412 and 1366px. Each checks NFL rounds 1–9, explicit Round 8, no competition dropdown, correction revision, valid zero versus missing, independent AFL/NRL unavailable states, returning to NFL, no NBA, no horizontal overflow and NFL axe accessibility checks. Initial inherited table nowrap and contrast defects were corrected before this passing run.
- Browser screenshots are isolated real-component fixtures with synthetic player rows and the application's actual stylesheet cascade. They are not authenticated hosted acceptance or Android device evidence. Before screenshots reproduce the former general rules markup/dropdown. NFL/AFL/NRL after screenshots exist at all three widths in this directory.
