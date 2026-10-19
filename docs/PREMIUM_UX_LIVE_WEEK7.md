# Live release and Week 7 activation

Owner authority: “deploy to live so barry can see and activate week 7 for Traditional and All-Star” (19 October 2026).

- Live source: `e5c93ec1a3c18f346c0ae63bddb3ece9a15e8814`.
- Deployment: `dpl_BNjrWEQkRxhVs2HHu9EWdSyUh5zN`, READY, Production target, Sydney deployment region.
- Live domains verified: https://docked.com.au and https://www.docked.com.au.
- Previous deployment retained: `dpl_2b8acxWRhttZuXnLGvyZJZcAkEFE`.
- The tested production candidate was built without changing domains, checked, then promoted. Existing beta admission, MFA, weekly packs and trading configuration were preserved.

## Week 7

| Competition | ID | State |
| --- | --- | --- |
| Traditional | `9286cca8-c7a3-487e-b687-f9614a2b87b5` | Entries open |
| All-Star | `d3da95b4-a72a-4b40-87d9-09b562d92277` | Entries open |

Both are NFL 2026 Week 7, beta channel, 14 verified fixtures and 435 eligible current-roster players. Registration reused `registerNflRound` with an exact, hashed Week 7 plan; canonical player IDs and fresh roster mappings were rechecked immediately before activation. Both use `docked-nfl-seven-full-ppr-v2`, the approved game-log-aligned rules, existing rarity multipliers, salary table and individual permanent slot locks.

Entry deadline: **Friday 23 October 2026, 11:15 am Australia/Sydney** (`2026-10-23T00:15:00Z`). New entries close at that first kickoff; submitted slots retain the existing individual kickoff locks. Both rounds had zero entries immediately after registration: activation did not enter anyone automatically.

Week 6 competition rules, scoring references, opening/deadline values and all existing entry records matched their pre-activation digest. No Week 6 migration, wallet posting, card transfer or reward issuance was performed.

The tested future-draft predicate migration was applied and verified. Hosted migration receipt: `20261019121014_future_week_private_drafts`; repository source: `supabase/migrations/20261019113000_future_week_private_drafts.sql`. The original function definition is retained privately for recovery. No grants or RLS policies changed.

## Live checks

- Both live domains return the expected source commit and deployment ID from `/api/beta-release`.
- `/api/status` returns 200 with registration closed.
- `/api/fantasy`, `/api/fantasy/auto-select` and `/api/fantasy/lineup-history` return 401 with sign-in guidance and non-cacheable responses without a member session.
- The signed statistics status receiver returns 405 to GET, as designed (POST-only); the retired statistics preview returns 404.
- Runtime error/fatal scan at 12:13 UTC found only two expected authentication diagnostics from the signed-out Play/Cards probes, and no other error/fatal records in the checked 15-minute window. This is a short release check, not ongoing monitoring.
- The pre-release evidence remains 502 passing platform tests, 187 passing database tests, lint/typecheck/build/canary checks and isolated browser acceptance. No real member purchase, draft or entry was submitted during deployment checks. Authenticated member UI acceptance and native Android timing are not claimed by the HTTP probes.

The previous report's “not live / Week 7 unregistered” status is superseded by this receipt. Protected Preview configuration was not modified: the owner explicitly authorised this live release instead.

## Recovery

If a web regression appears, restore the retained previous deployment through the existing promotion/rollback workflow. Do not delete the new rounds or drafts/entries to undo a web release. Any later round closure or scoring change needs explicit review, especially after entries are submitted. Function recovery uses the privately retained exact pre-migration definition without deleting member data.

Safe public deployment and activation receipts are in `docs/qa/premium-ux-live-release/`. Credentials, raw environment configuration, function backup and the detailed registration plan remain in ignored private storage.
