# Play and standings review

## Implementation

- Traditional / All-Star are presentation labels from `src/core/competition-display.ts`. Persisted SALARY_CAP / OPEN identifiers, rules and original stored names are unchanged. Current labels are projected into Play, collection selectors/history, rules, member team tabs, pack/help copy and marketplace competition context. Descriptive “salary cap” remains.
- `src/core/lineup-picker.ts` applies ownership, sport/competition pool and configured slot positions before search, rarity, canonical team, FLEX-position filtering, sorting and pagination. Fixed slots have no position filter. FLEX excludes QB/K/defence. Every opening resets incompatible filter state; disabled matching cards retain reasons. Existing server entry validation is unchanged.
- Existing replacement budget logic is retained: remaining plus outgoing salary. All-Star remains uncapped. Fantasy salary copy is concise. Team-name editing calls the existing `name_team` command. Wallet stays in shell navigation; Legacy rounds move to standings Archive.
- `src/components/competition-results.tsx` supplies weekly/season controls, safe URL selection, search, paging, Find My Team, highlighted owner row, weekly lineup and season-week drilldowns. `src/core/standings.ts` keeps stored centipoints, 1/1/3 shared ranks, compatible mode/season/rules series, and excludes provisional/missing/reopened weeks. Weeks entered and finalised weeks included are separate.
- `sports_feed.play_standings()` checks active admitted sessions and is available only to the server runtime. It exposes opaque stable member references, team names, scores and gated snapshot projections, not Auth account IDs. Other members’ selections require the existing explicit publication policy, entry deadline, every rolling slot lock, admission and bilateral profile/block checks. Own confirmed snapshots remain visible; private drafts never enter this read model. Under-review scores are redacted.
- Fixture deduplication already existed by ID; it is now a tested helper that prefers the selected competition’s authoritative snapshot and retains distinct fixture IDs even with identical display details.
- Original team-colour jersey artwork remains. Number artwork is suppressed only on the updated Play/picker/lineup detail surfaces, as requested. Existing collection/reveal artwork configuration is preserved.

## Read-only migrations

1. `20261016040851_play_standings_read_model.sql`: adds protected standings projection; keeps the original standings API compatible.
2. `20261016043013_competition_display_context.sql`: adds current-mode display metadata to the existing guarded marketplace context. No ownership, balances, entries, scoring rules, historical receipts or publication approvals are changed.

Both created with the installed Supabase migration CLI. Applied only to isolated local test databases. Production deployment and hosted migrations were not run.

## Visual evidence

`docs/qa/play-standings/` contains Play, QB picker, FLEX picker, weekly standings and season standings at 1440, 1024, 412 and 360 pixels. These are interactive production React components with clearly labelled nonpersistent fixture scores and members. The attached mockup guided navy panels, blue segmented controls, summary hierarchy, readable table rows and rounded actions; no stadium imagery, logos, portraits or sample production scores were introduced.

`node node_modules/tsx/dist/cli.mjs scripts/play-standings-browser.ts --serve` starts the isolated preview at http://127.0.0.1:3025/fantasy/play?scenario=entered. Standings is at /fantasy/results. This is not a hosted release or physical Samsung test.

## Verification and limitations

Final results are recorded in `docs/qa/play-standings/verification.json` and associated logs. Browser checks cover all fixed slots/FLEX, intersection and pagination, clear/reset filters, empty inventory, disabled listed cards, long names, no number artwork, modal Escape, URL refresh, competition switching, Find My Team across pages, drilldown, page overflow and axe checks at four viewports. Database checks exercise protected reads, blocks, publication gates, immutable snapshot history and reopened scoring journals, alongside the existing ownership/salary/lock regressions.

Initial visual checks exposed white table headers from global CSS and compact-card name overlap; corrected and rerun. Expanded SQL test setup needed valid beta consent and explicit UUID parameter types; three failed setup runs are retained. The initial authenticated browser read clicked before hydration; the corrected harness waits for the component’s ready state. A subsequent authenticated attempt exceeded the 30-second cold development-server timeout while the full build and suites were running; the retry allows 120 seconds for compilation. These failed attempts are not counted as uninterrupted passes.

Physical Samsung S24 acceptance is pending. Hosted deployment is intentionally not performed. Opposing lineups remain private for competitions without an approved publication policy; this change does not enable one. No real entries or production account data were created or modified.
