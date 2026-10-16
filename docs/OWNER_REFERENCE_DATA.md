# Owner reference dashboard: reporting definitions

The reference dashboard uses the existing beta owner report transaction. It remains read-only and never grants packs, changes a balance, transfers a card or activates a feature. Real-money reporting is unavailable because there is no approved settled-AUD source in this environment.

| Surface | Authoritative source and definition |
| --- | --- |
| Total Users | Retained `beta_public.profiles` joined to admissions; profiles created before the selected period end. Includes subsequently restricted profiles. Staff are excluded unless explicitly selected. This is completed profile registration, not all Supabase Auth attempts. |
| Total Users change | Period-end retained profile count versus period-start retained profile count. |
| Packs Sold | Existing `credits_sandbox.state.economy.packs` immutable purchase/configuration snapshots, using `createdAt`. Counts purchases even if unopened; opening/replay and weekly/onboarding rewards do not add a sale. Current nine-card test economy only. |
| Revenue (AUD) | Unavailable. Sandbox provider captures, test credits, fees and promotional issuance are never substituted for cash. No fake revenue bars are generated. |
| Marketplace Trades | `SOLD` listings with a settlement receipt, plus `ACCEPTED` swaps with an immutable `accept` event. Credit-only private offers already settle through listing receipts; combined offers through swaps, so they are not counted twice. Both participants must be in the selected reporting member scope. Current credit economy only. |
| Cards in Circulation | Actual `beta_fantasy.cards` rows plus permanent `credits_sandbox.card_instances`; timestamp before selected period end. Includes every owner, regardless of staff inclusion, and follows sport. Approved maximum supply is never used as circulation. |
| New Users | Daily profile registrations, grouped in `Australia/Sydney`, within the selected half-open reporting interval. |
| User Growth | Retained profile count before the reporting interval plus the running sum of daily registrations. |
| Pack Sales | Group purchases by their original product configuration version. Name, category, card count, sport and price come from the purchase snapshot. Credit totals are explicitly test credits; AUD remains unavailable. |
| Top Cards | Actual completed credit-sale receipts grouped by permanent card definition. Counts and credit values are not invented for swaps or combined offers. Unknown catalogue metadata is not fabricated. Maximum five rows. |
| Recent Activity | Redacted registrations, reports, recorded moderation actions, competition opening timestamps, current pack purchases and completed current trades. No emails, ledger lines, report evidence or account balance is projected. Latest 20 rows, refreshed on report load. |
| Moderation | Actual open/escalated post/comment/media and profile report counts. A dedicated listing-case adapter does not exist, so that category is unavailable, not a false zero. |
| Database health | Successful execution of this authorised reporting query only. It does not attest to backup/restore or all application operations. |
| Other health | API, web and Android have no independent probe and remain unknown. Recorded blocked/expired worker leases or email outbox failures are warnings; absence of failures does not imply health. |

Dates are half-open `[start, end)` intervals. The server report timestamp caps the current period. Previous flow comparison uses the immediately preceding equal elapsed-time window. Zero prior values have no meaningful percentage denominator and display no fabricated percentage. New-member metrics are account-wide; sport-specific filtering applies only to sport-bearing economy and circulation data.

Older single-card payment experiments and retired legacy marketplace activity are not silently mixed with current pack/trade flows. Their original records and operational workspaces remain intact. Cumulative charts are based on retained profiles, not a separate historical identity warehouse. Deleted-account reconstruction and retention analytics are not implied.

## Security and deployment

`20261016124504_owner_reference_reporting.sql` adds one function in `beta_private`; it grants no table writes and changes no member data. The function requires the existing active session, owner role, owner-gameplay identity and AAL2 checks. Execute access is revoked from public, anonymous, authenticated, service-role and production application roles and granted only to the beta server role. No public Data API route is introduced.

`readOwnerReferenceData` runs inside `ownerOperations`' existing authenticated repeatable-read, read-only transaction. The existing economy JSON document is reused rather than independently read or cached per dashboard panel. The internal member-ID set is discarded by the aggregate projection. There is no cross-account browser cache.

The migration is additive and has not been applied to a hosted database in this workstream. Roll back the application to stop calling the function; leaving an unused guarded read-only function does not mutate historical records. A later reviewed migration can revoke/drop the unused function if required.

## Validation evidence

- `tests/platform/owner-reference-data.test.ts`: actual isolated purchase, open/replay, sale, swap and idempotency commands; date/sport/member scopes; no state mutation; cash-unavailable states; growth arithmetic.
- `tests/database/owner-reference-reporting.test.ts`: all migrations applied to isolated PGlite; owner AAL1/member denial, grants, independently queried registration counts, Sydney date boundaries, actual card issuance versus maximum supply, sport isolation, redacted activity and no reward/ledger writes. Authentication fixture adapters are isolated; this is not a hosted MFA acceptance claim.
- Existing full auth/RLS/wallet suites remain necessary as integration regression evidence.

The current beta economy is a shared JSON aggregate. This implementation reads it once and performs linear projection, with bounded UI output. A separate production analytics warehouse, persistent cache or retention event system is not introduced. Commercial-scale query/load acceptance remains separate from these functional checks.
