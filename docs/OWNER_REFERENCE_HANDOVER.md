# Docked Owner/Admin reference implementation

> Historical implementation baseline. Deployment, completed workflows, current test results and remaining blockers are superseded by [ADMIN_COMPLETION_HANDOVER.md](ADMIN_COMPLETION_HANDOVER.md). The owner subsequently approved the existing live beta as the release destination; separate Preview setup is no longer required.

## Outcome

The owner dashboard is implemented against `1000050648.jpg`, using its measured desktop composition, sampled navy surfaces, electric-blue navigation, five KPI cards, three chart panels, three activity panels and three operational panels. The exact thirteen-item sidebar is shared by the owner and permitted staff workspaces. Existing member screens and fantasy rules were not redesigned by this change.

This is a local implementation and review release. It is **not deployed** and does not claim complete commercial operations or pixel-perfect acceptance. Genuine authenticated hosted and physical Samsung acceptance remain pending.

## Visual evidence

Final screenshots and the unmodified supplied reference are in `docs/qa/owner-reference/final/`; `comparison.html` displays reference and implementation side by side. The test harness uses the actual production components and isolated synthetic data, visibly labelled as such in the records. These screenshots are not screenshots of member accounts.

- Desktop: `owner-1536.png`, `owner-1440.png`.
- Tablet: `owner-1024.png`.
- Mobile: `owner-412-full.png`, `owner-360-full.png`.
- Browser assertions and measurements: `acceptance.json`.

The original branded-professional-athlete photographs were replaced with newly generated fictional adult athletes in unbranded American-football, soccer and Australian-football clothing. Their placement, lighting and proportions follow the reference. The existing Docked logo remains unchanged. Responsive WebP assets are under `public/brand/docked/admin/`; original generated PNGs are retained locally in the ignored `source-assets/owner-reference-v1/` directory.

Other intentional differences: unavailable settled-AUD revenue has no invented bars/line; unverified services are grey/unknown; listing-case moderation is unavailable; actual numbers of packs, cards and events determine row density. No reference numbers, sample emails, team logos or fabricated activity enter the application. Charts share one URL-persisted reporting period rather than pretending to use different datasets.

## Implementation and data sources

`AdminShell` owns the sidebar, responsive navigation, header, account controls and authorized global search. `OwnerDashboard` renders aggregate reporting; `OwnerOperationsDetail` preserves the previous operational reports, controls and audit links. Hash links automatically open that disclosure. `owner-reference.css` is scoped to administration and uses the sampled reference tokens. Top Cards reuses `CollectibleFace` and actual most-recent-sale metadata; pack thumbnails reuse `PackArtwork`.

`ownerOperations` retains owner/session/MFA checks and one repeatable-read transaction. The additional SQL aggregate and pure economy projection do not mutate accounts or assets. Sources and definitions are documented in [OWNER_REFERENCE_DATA.md](OWNER_REFERENCE_DATA.md):

| Display | Source and meaning |
| --- | --- |
| Total Users / registration charts | Admitted beta profile registration timestamps, account-wide; staff inclusion follows the filter |
| Packs Sold / Pack Sales | Completed purchases in the existing nine-card test economy, using purchase-time configuration snapshots; not openings or free rewards |
| Revenue (AUD) / Revenue Overview | Unavailable until an approved settled-cash source exists; test credits are excluded |
| Marketplace Trades | Deduplicated completed sale receipts and accepted swap events; pending/cancelled offers excluded |
| Cards in Circulation | Actual issued legacy and permanent card instances, not configured maximum supply |
| Top Cards | Completed credit-sale count and test credits; swapped cards receive no invented value |
| Recent Activity | Redacted registration, purchase, transaction, competition and moderation records |
| Platform Health | Successful reporting query for database; other services remain unknown or warning without independent evidence |
| Moderation | Actual open/escalated content and member report counts; category filtering occurs before queue pagination |

Two additive read-only reporting/search migrations are prepared, in this order:

1. `20261016124504_owner_reference_reporting.sql`
2. `20261016125231_admin_search_projection.sql`

They grant execution only to the existing application role after server/database authorization. No broad table grants, new owner role, new wallet or RLS bypass were added. Before hosted application, verify the isolated target and encrypted backup/recovery process, apply the reviewed migrations in order, and run denial/read tests. A rollback can revert the application while leaving these unused read-only functions; do not reset member databases or remove historical data.

## Permissions, navigation and actions

[ADMIN_WORKSPACE_ACCESS.md](ADMIN_WORKSPACE_ACCESS.md) contains the complete role matrix and destination audit. Owner reports remain owner-only. Other staff see permitted workspaces and are reauthorized server-side; sidebar hiding is not the security boundary. Search rechecks active session, MFA, current role and category permission, uses bounded queries and pagination, and excludes emails, credentials, raw journals, owners and private lineups.

- **Issue Credits:** opens an explicit restricted activation review. No hosted arbitrary-issuance workflow is exposed.
- **Send Announcement:** functional in-memory draft, audience preview and clear action. Saving and delivery are unavailable; no emails, push or bulk messages were sent.
- **Manage Packs:** actual pack lookup, catalogue and issuance reporting. Price, odds and availability changes remain reviewed configuration releases.
- **View Reports:** opens permitted reporting tools.

Unavailable support cases, appeal intake, CMS approval, financial corrections and unrestricted configuration editing are described in the relevant workspace. Those are outstanding capabilities, not completed workflows.

## Verification

- Full platform regression: **436 passed**, zero failed.
- Full isolated PostgreSQL regression: **166 passed**, zero failed.
- Focused reporting, search and moderation checks additionally cover actual circulation versus capacity, independent registration counts, inactive/null sessions, MFA/role denial, literal search escaping, pagination, future transactions and category-before-limit filtering.
- TypeScript and full ESLint passed.
- Isolated production build passed. Canary client-secret boundary check passed across **63 browser assets**.
- Five-width browser and visual evidence is documented in [OWNER_REFERENCE_ACCEPTANCE.md](OWNER_REFERENCE_ACCEPTANCE.md). It includes keyboard search, failures/empty states, periods, responsive navigation, announcements, moderation grouping and disclosure links.

Failed or retried checks are retained: initial SQL alias/fixture setup failures were corrected; a date-test TypeScript generic was corrected; an overly quoted formatter path failed without changing source; browser IPC restrictions required the isolated browser outside the process sandbox; screenshot review found and fixed tiny SVG charts, cropped/overlapping banner imagery and wrapping unavailable states. A screenshot harness waiting indefinitely for off-screen lazy-image decoding was corrected to eagerly load only within the test document and use a bounded asset wait. None of these failed/interrupted attempts is counted as a pass.

The fresh broad heuristic secret scan inspected 3,972 text files and still returned the same nine existing findings (eight previously reviewed fixture findings and the local signed APK capability). The capability note remains untracked and excluded from this commit. Prior withdrawal evidence and remaining expiry/revocation limits remain described in the prelaunch security report. This task's client-boundary pass is not a clean broad-secret-scan claim.

## Protected Preview and remaining acceptance gates

Fresh Vercel inspection confirms project `docked-preview` (`prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`) has SSO protection for **all deployments**, no attached public domains and `live: false`. The existing URL is not this revision. Production was not changed.

The previously inspected isolated Supabase target is `bckkllmndoxzpzdqrevb`, distinct from live beta `pojoymtniryarxxunyvz`. The last successful owner check found `support@docked.com.au` without completed email/password/MFA setup in that isolated target. A fresh read-only Supabase connector check during this task was denied permission, so current owner readiness and database isolation could not be reverified. No hosted migration or deployment was attempted.

Owner actions required for hosted acceptance:

1. Restore authorized read access to the isolated Preview project and verify its current environment mapping.
2. Complete normal owner authentication/MFA in that isolated project if still pending; existing live-account setup does not establish isolated-project credentials.
3. Review the two read-only migrations and backup evidence, then complete protected Preview release and authenticated owner/staff acceptance. Keep all existing admission and financial activation gates.
4. Review the visual comparison, then test Samsung S24 browser/app navigation, large text, landscape, keyboard, search, drawer Back/Escape and scrolling. No physical-device result is claimed.

Real payments, redemption, identity-document collection and hosted trading settlement remain disabled. Hosted discretionary credits and announcement delivery need their approved auditable workflows before activation.
