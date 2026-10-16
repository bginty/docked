# Persisted administrative announcement drafts

This follow-up replaces the temporary in-memory announcement preview with persisted staff drafts. It does not publish, send email/push/in-app messages, add outbox records, or enable financial activity.

## Workflow and authority

The Communications workspace supports create, edit, preview, submit for review, approve/request changes, archive and restore as draft. Approval is a draft status only. Content edits invalidate the prior review and must be submitted again. Archived drafts cannot be edited until restored. An owner/administrator may manage all drafts; editors manage their own. Auditors can read drafts and the latest 50 history events. Analysts and ordinary members have no access. The current stored role, active member session and AAL2 are checked inside every database function as well as the existing server identity layer.

The owner can approve their own saved draft with an explicit reason and confirmation action. An administrator can review content they neither created nor last edited. Editors cannot approve. This permits the existing owner to complete the draft workflow without inventing a second privileged-staff requirement. No approval sends or publishes content.

Drafts are bounded to 120-character titles and 3,000-character messages. The only proposed audience is admitted members. Changes require a 3–500-character reason. Lists paginate at 25. Each actor can have at most 100 unarchived drafts. API reads are private/no-store, mutations are same-origin and rate limited, and the API accepts no supplied actor or delivery action.

## Persistence and safety

Migration `20261016214135_admin_announcement_drafts.sql` adds private drafts and append-only events. RLS is enabled; direct table privileges are revoked from public/anonymous/member/service/runtime roles. Three narrowly scoped private functions provide list/history/mutation access to the existing beta runtime role. Definer access is limited to these objects and verifies the current session, MFA and role before any operation. No extra administrative role or public RPC is introduced.

Mutations use an expected version, row lock and a unique actor/request UUID. Retrying an uncertain response returns the original receipt. Reusing a key with another payload fails. The event and draft commit atomically. Immutable events retain the authorized change request and resulting revision; ordinary staff cannot update/delete them. The browser freezes editing after an uncertain save until the same request is retried. Unsaved edits must be saved/discarded before another draft is selected. No credentials, member emails or recipient lists enter this feature.

The migration was created by the installed Supabase CLI. It is prepared locally only. Apply through the reviewed release workflow after backup and target verification. Application rollback may leave these inert private tables/functions in place; do not discard audit records as a rollback. This feature does not change an approved data-retention policy or implement a new purge job. The beta-rc3 privacy policy still applies to account-deletion and staff-audit retention reviews; immutable history is not permission for indefinite retention or arbitrary erasure. Draft bodies should contain no unnecessary personal information. Explicit revokes also exclude the separate docked_app runtime.

## Evidence

- Actual migration executed in isolated PGlite: staff/member/AAL1/inactive denial, direct table denial, read-only auditor, optimistic version conflict, exact retry receipts, owner self-approval, independent administrator review, archive/restore and immutable history passed.
- Bounded request schema: rejects delivery, actor injection, wrong audience, invalid versions/IDs and oversize/blank content.
- Actual React component in local browser with explicitly synthetic transport: preview performs no write; lost response retries one request; reload reads saved draft; unsaved edit discard; submit review; owner approval requires a reason; archive. Desktop 1440px and mobile 412px have no horizontal overflow, runtime errors or serious/critical Axe violations.
- Screenshots and machine-readable browser evidence: `docs/qa/admin-announcements/`.
- Focused TypeScript/ESLint checks recorded by the integration run. No hosted/physical-device acceptance or delivery is claimed.

Failed attempts retained in task logs: initial SQL local-variable qualification failed and was corrected; browser selectors were corrected to accessible textbox names; Axe required an explicit browser context; using the full application styles exposed dark-button/hover contrast defects which were fixed with scoped shared-form tokens before the final passing run. These earlier attempts are not counted as passes.

Supabase's changelog Markdown fetch was attempted but the web reader rejected its content type and the sandbox fallback could not resolve the host. Current official RLS guidance was read; the implementation uses existing stable PostgreSQL primitives and the repository's session/role conventions. No hosted advisor result is claimed.

## Remaining activation

Sending, recipient expansion, delivery scheduling, retries, preference/consent checks and delivery receipts remain unavailable. The existing user approval boundaries still apply to any future bulk in-app, email or push delivery.
