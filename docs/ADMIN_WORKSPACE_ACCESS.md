# Owner reference dashboard: navigation and search

The exact thirteen-item navigation reuses the existing `owner`, `admin`, `analyst`, `editor` and `auditor` roles. No new authority system or generic super-admin permission was added. Every workspace checks the current server role and AAL2 before rendering; the sidebar is a convenience, not the access boundary.

Current live beta admission allows the owner and explicitly approved named administrators. Barry now has an audited named admin grant; all privileged operations still require MFA and current role checks. The matrix describes service permissions after admission and does not itself grant access. See [Barry access and MFA status](BARRY_ADMIN_ACCESS.md) and the [completion handover](ADMIN_COMPLETION_HANDOVER.md).

## Permissions matrix

| Workspace / search category | Owner | Admin | Auditor | Editor | Analyst |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Owner report | Staff portal | Staff portal | Staff portal | Staff portal |
| Users / members | Yes | Yes | Read/review | — | — |
| Cards & Inventory / cards | Yes | Read/review | Read/review | — | — |
| Packs / packs | Yes | Read/review | Read/review | — | — |
| Marketplace | Yes | Read/review | Read/review | — | — |
| Competitions / competitions | Yes | Read/review | Read/review | Read/review | Read/review |
| Content & News | Draft | Draft | Read/review | Draft | — |
| Moderation / reports | Existing actions | Existing actions | Read only | Existing target-specific actions | — |
| Payments & Wallets / transactions | Read/review | — | — | — | — |
| Rewards & Credits | Request/review; issuance disabled | — | — | — | — |
| Analytics | Owner + existing reports | Existing reports | Existing reports | — | — |
| Communications | Draft + delivery inspection | Draft + delivery inspection | Delivery inspection | Draft only | — |
| Settings | Existing account/admission tools | Existing account/admission tools | — | — | — |

Each linked operational service retains its own authorisation and activation rules. Auditors do not receive mutation controls. Staff account settings are personal settings, not arbitrary role editing.

## Functional navigation audit

The Dashboard link resolves to `/admin/operations` for the owner and `/admin` for other staff. The remaining twelve destinations resolve to `/admin/workspace/{section}`. Their existing-tool links use actual application routes:

- Invitations: `/admin/preview-testers`.
- Moderation/integrity: `/admin/community/reports`, `/admin/community/integrity`.
- Inventory/export: owner reporting and its existing CSV endpoint.
- Pack catalogue: `/fantasy/test-wallet?view=packs`.
- Market: `/fantasy/market`.
- Standings/scoring: `/fantasy/results`, `/fantasy/scoring`.
- Community publishing: `/fantasy/social`.
- Analytics: `/admin/analytics`, `/admin/community/analytics`.
- Notification inspection: `/admin/community/notifications`.
- Withdrawal operations: `/admin/redemptions` (existing restrictions retained).
- Personal security: `/dashboard`.

Missing support-case, appeal-intake, CMS approval, configuration editor and financial correction workflows are explicitly described as unavailable in the relevant workspace. Links do not imply that these systems have been implemented.

## Quick actions

- **Issue Credits** opens recipient/amount/reason/confirmation requests with auditable review, approval, decline and cancellation. Approval does not issue credits: the current policy remains PROPOSED_SANDBOX_ONLY. No arbitrary balance edit or hosted issuance is enabled.
- **Send Announcement** opens persisted drafts, audience preview, submission/review, archive/restore and immutable history. Conflict and exact-retry handling are enforced by the server. External email, push and bulk in-app delivery remain unavailable pending their existing approvals.
- **Manage Packs** opens pack record/configuration lookup, the existing catalogue and owner issuance reporting. Pricing, odds and availability remain controlled configuration releases.
- **View Reports** opens permitted authoritative reporting workspaces.

## Global search

`GET /api/admin/search?q=…&category=…&page=…` returns twenty results and a `hasMore` flag. Search requires two characters, caps input at 120 characters and pages at 100, matches literal substrings, and rate-limits forty requests per member per minute. Queries have a four-second timeout. Responses are `private, no-store`.

The existing identity pipeline verifies email, live session, admission and enabled account; `requireRole` enforces AAL2/current database role. The reporting transaction rechecks the role and retains the admission guard’s row locks; it performs no domain writes. The new narrowly projected `beta_private.admin_search` function independently checks active session, AAL2 and category permission, with execute granted only to the existing application runtime role. No new table privileges or broad RLS bypass are granted. `anon`, `authenticated`, ordinary members and inactive/AAL1 sessions cannot invoke the search projection successfully.

Sources: existing profile/social identity tables; legacy and current issued cards; current card editions; legacy purchases, current purchases and configurations, Weekly Core entitlements; current credit journal references; fantasy competition definitions; moderation report classifications. Search excludes member emails, raw journal lines, card owners, private lineups, provider credentials and raw JSON state. Transactions are owner-only, explicitly test-credit records. Current competition names use Traditional/All-Star only when their saved rule context identifies those modes; immutable records remain unchanged.

The migration is additive and read-only: `20261016125231_admin_search_projection.sql`. It was applied to the approved live beta during the preceding release; the six subsequent workflow migrations add scoped, audited administrative records without changing member assets.

## Evidence and limits

`tests/database/admin-search.test.ts` executes the actual migration against isolated SQL fixtures and checks real records, role categories, AAL1/inactive denial, direct table denial, anonymous execute denial, safe field projection, literal-injection strings and deterministic pagination. Its active-session adapter is isolated; the existing full authentication/RLS suites remain required for actual session semantics. `tests/platform/admin-navigation.test.ts` covers exact navigation order, permission routing, bounded inputs and activation boundaries. Browser interaction evidence is recorded separately by the owner-reference acceptance harness. No hosted member record was changed or announcement delivered.

