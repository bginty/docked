# Administrative record drilldowns

Workspace search results now open an exact record rather than repeating a search summary. A single read-only projection supplies the workspace detail panel and `GET /api/admin/record`. This adds inspection capability; it grants no ability to change accounts, assets, pack configuration, competition results or balances.

## Sources and permitted fields

| Category | Authoritative source | Projection |
| --- | --- | --- |
| Members | `beta_public.profiles`, social profiles, admissions, roles, admission/moderation events | Display identity, account/social/admission status, relevant timestamps and staff role; bounded admission/enforcement history. No email, invitation token, authentication factor or free-form evidence payload. |
| Cards | Legacy fantasy cards/editions/players and ownership events; current credit-state card economy and ownership history | Identity, rarity, serial, edition supply, owner reference and transfer provenance. No sale valuation or private lineup state. Edition-only records remain distinct from issued cards. |
| Packs | Legacy issuance, Weekly Core entitlements, current purchased-pack snapshots and product configurations | Member reference, issuance/opening status, saved configuration and card count; credit prices explicitly labelled test credits. No unrevealed draw, private receipt payload or provider token. |
| Transactions | Existing credit-state journal | Owner only: exact journal policy/time, explicit test-credit unit, line count, signed ledger lines and their sum. No independent wallet, ledger mutation, cash revenue inference or payment credentials. |
| Competitions | Existing competition definitions, entries and results | Saved competition schedule, current Traditional/All-Star display names where applicable, scoring identifier and aggregate counts. No entry snapshot, selected card, draft or slot information, even for staff. `scored_at` is shown as a recorded scoring timestamp, not falsely labelled finalisation. |
| Moderation | Existing report and moderation event stores | Classification, status and decision chronology with navigation to the existing investigation workflow. No duplicate enforcement implementation. |

Roles match the existing search matrix: owner can inspect all categories; admin/auditor exclude transactions; editor can inspect competitions/moderation; analyst can inspect competitions. Ordinary members cannot inspect any administrative record.

## Security and operational limits

The server verifies the existing live account/session/admission controls, current role and AAL2, rate-limits requests and rechecks the role within the database transaction. The projection performs no domain writes. The transaction permits the existing admission guard's `SELECT FOR SHARE` locks, which PostgreSQL forbids in a SQL `READ ONLY` transaction. The private SQL function separately verifies the active member session, AAL2 and persisted category permission. Execute is granted only to `docked_beta_app`; no table privileges are added. The projection uses explicit columns and JSON keys, never whole private rows or state documents in responses. API responses are `private, no-store` and database errors are not exposed.

IDs are exact, bounded to 160 characters; control characters are rejected. History contains at most 20 events per page, with one lookahead row; page bounds are 1–100. Ordering is deterministic. Statement timeout remains four seconds. Current economy records retain the existing singleton JSON store; this work does not create a parallel ledger or ownership store. At substantially larger state sizes, a separately reviewed indexed projection may be needed.

Migration: `20261016214339_admin_record_details.sql`. Additive function only; no account, balance or ownership mutations. Deploy the migration before the route, otherwise the page fails closed with an unavailable message. This workstream did not apply it to hosted systems or deploy it. Disabling the route or revoking the function's runtime execute privilege is the safe rollback; no data restoration is necessary for this read-only function.

Support case management, appeals, discretionary credit issuance, financial corrections and configuration editing remain subject to the existing unavailable/approval states. A record detail view does not complete those workflows.

## Verification

- `tests/database/admin-record.test.ts` executes the actual migration against isolated fixture tables. It verifies every category, exact IDs, safe projection, no lineup/unrevealed-card leaks, debit/credit arithmetic, pagination, ordinary-member and cross-role denial, AAL1/inactive denial, and revoked direct execute/table access. First run failed because the fixture used a text profile ID against a UUID role ID; fixture types were corrected and the rerun passed.
- `tests/platform/admin-record.test.ts` verifies input/category boundaries.
- Existing `tests/database/owner-reference-reporting.test.ts` passed after installing the complete local migration sequence, including this function.
- Focused lint and project typecheck passed again after the final browser additions and visual corrections. Workspace diff whitespace validation passed.
- `scripts/admin-record-browser.ts` renders the actual components using clearly labelled synthetic local data at 1440, 412 and 360 pixels, exercises next/previous history navigation, checks overflow and Axe accessibility, and captures screenshots under `docs/qa/admin-record/`.
- Browser inspection found and corrected low-contrast eyebrow text and collapsed event spacing. Final screenshots were inspected at desktop and narrow mobile; all three viewports report no horizontal overflow, no serious/critical Axe findings and no runtime errors. Initial browser harness attempts failed due sandbox browser discovery and Axe requiring an explicit browser context; the fixture was rerun successfully using the installed browser and a proper context.

These are local SQL and rendered-component results, not hosted-account or physical Samsung acceptance. Actual authentication and release verification are handled separately.
