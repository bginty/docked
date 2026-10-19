# Signed-in loading failure — corrected live

20 October 2026, Sydney. The owner reported the branded failure screen following the weekly continuity release.

## Confirmed cause

PostgreSQL logs at 23:31 UTC reported SQLSTATE 42883, `operator does not exist: text = uuid`, for the newly filtered jersey query in `src/server/fantasy.ts`. The live `credits_sandbox.current_player_jerseys.id` column is text. The previous release incorrectly compared it to a UUID array. This failed the signed-in fantasy request, including Play and Profile. The earlier signed-out deployment checks did not exercise this query and were insufficient to establish authenticated availability.

The query now binds a text array, retains filtering to owned player IDs, and supports canonical UUID-shaped and legacy text IDs. No schema, balance, ownership, scoring, entry or MFA change was needed. Weekly continuity and Week 7 remain in place.

## Verification and release

- Regression test executes the actual shared query in PostgreSQL-compatible PGlite: it reproduces the old type error, then verifies canonical IDs, legacy text IDs, missing IDs, empty input and exclusion of unrequested players with the fix.
- The corrected text-array query also executed successfully against the actual hosted view (read-only, two matches).
- Typecheck and focused lint passed. Vercel Production build passed.
- Source `5444866442f674195860d5334a1e3266238136da`; deployment `dpl_5D5ixunTWgMxS9qpNU2DNWX38rtJ`.
- Staged without custom-domain reassignment, checked READY/project/source/region, then promoted. Both live domains returned the exact new release identity. Health and signed-out private API boundaries passed.
- Actual existing signed-in browser session: hard reload of Play displayed the saved Week 6 lineup and established-team controls; navigation to Profile displayed the account, collection counts, balance and weekly-pack countdown. No team save, purchase or entry was submitted.
- A Vercel MCP status transport failure was handled using the existing authenticated CLI; no access protections were changed.

Safe deployment receipts are in `docs/qa/jersey-loading-hotfix/`. This verifies the desktop browser session, not a physical Samsung device. On the phone, reload the page or use Retry to fetch the corrected release.
