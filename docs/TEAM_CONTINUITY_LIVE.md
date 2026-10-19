# Weekly team continuity — live release

20 October 2026, Australia/Sydney. Owner instruction: “deploy”. This receipt supersedes the not-deployed status in `TARGETED_UX_TEAM_CONTINUITY.md`.

- Source: `8ed1687b6cb5454b4a486932d36379deab07a158`.
- Deployment: `dpl_FJpWaQrYuhojGA4iCQiGiKqJEYyk`, READY, Production, Sydney region.
- Both https://docked.com.au and https://www.docked.com.au return the exact source and deployment identity.
- Previous deployment retained for recovery: `dpl_BNjrWEQkRxhVs2HHu9EWdSyUh5zN`.
- Exact committed web source was exported, built without moving custom domains, checked and promoted. Existing beta, authentication/MFA, weekly-pack and trading settings were retained.

## Database and Week 7

Applied source `supabase/migrations/20261019213437_weekly_team_continuity.sql`; hosted receipt `20261019230756_weekly_team_continuity`. The pre-migration read-function definition is retained in ignored private storage and its digest matches the renamed function.

Immediately after migration, all 10 existing entries and 3 drafts matched their before-migration checksums. No rollover rows were created by deployment. The runtime read wrapper is executable by the restricted application role; direct rollover table access, the helper and old read function remain denied. RLS is enabled. The advisor's new “RLS enabled, no policies” notice is expected for this private, deny-by-default table; access is exclusively through the authenticated security-definer workflow.

Future eligible team continuity runs on the member's authenticated account load. It creates private drafts, never automatic competition entries, card transfers or credit postings. Existing future drafts remain unchanged. Auto Select remains available until first entry confirmation for that sport/mode.

NFL 2026 Week 7 remains active for Traditional (`9286cca8-c7a3-487e-b687-f9614a2b87b5`) and All-Star (`d3da95b4-a72a-4b40-87d9-09b562d92277`). Both retain their entry deadline of Friday 23 October, 11:15 am Sydney (`2026-10-23T00:15:00Z`). No rounds were recreated or scored.

## Checks and limits

- Production build completed successfully. Pre-release automated and browser evidence is documented in `TARGETED_UX_TEAM_CONTINUITY.md`.
- Candidate identity returned 200 and matched the intended project, database and source.
- Protected candidate API inspection was inconclusive: MCP classified the 401 as deployment authentication; CLI fallback rejected `--global-config`. Neither protection nor MFA was disabled. After promotion, direct live API checks conclusively returned 401 with sign-in guidance and no-store headers for fantasy state, Auto Select and historical lineups.
- Both live domains verified. Health returned 200; the POST-only statistics receiver returned expected 405 to GET; retired statistics Preview returned expected 404.
- Error/fatal runtime scan at 23:11 UTC found only the expected authentication diagnostic from the signed-out Cards probe. This was a short release check, not ongoing monitoring.
- No member account was impersonated, and no live purchase, team edit or entry was submitted during release checks. Authenticated member acceptance and physical Android verification are not claimed.

Safe receipts: `docs/qa/team-continuity-live-release/`. Recovery: restore the previous web deployment and exact backed-up read-function definition if needed; retain additive tables, member drafts and audits. Do not delete member data to roll back presentation changes.
