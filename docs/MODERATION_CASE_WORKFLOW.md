# Moderation cases and evidence review

This bounded follow-up extends the existing report queue. It adds no parallel staff role, asset correction, financial operation, external notification or public moderation API.

## Case workflow

Open a report's **Case workflow** to assign a permitted reviewer, set severity (untriaged/low/medium/high/urgent), record investigation/escalation/resolution and inspect the latest 50 immutable staff events. The owner/administrator can assign staff; an editor can claim an unassigned case or manage their own assignment. An auditor can inspect without writing. Current stored role, active admission/session and AAL2 are enforced in SQL and the existing server identity layer, not merely by hiding controls.

Each update has an expected version and unique actor/request key. Row/advisory locks prevent conflicting case updates and exact retries return the original receipt. Changed payloads cannot reuse a receipt. Every change and its audit event commit together. No raw evidence copy is placed in the audit event. Case assignment and resolution do not modify ownership, wallet balances or competition scoring.

For posts/comments, **Hide while under review** uses the existing non-public `review` state. It preserves the source body and attachments. Releasing one case cannot override another hold. Releasing a hold after a separate moderation removal or author deletion clears the operational hold without restoring that removed/deleted content. This permits case resolution without trapping evidence in an unresolvable state. Held cases cannot resolve until released. Each hold has an explicit review deadline within 90 days; a reasoned review can renew it.

## Corrected destructive removal

Previously, staff Remove blanked a post/comment immediately and deleted post attachment links; media Reject nulled its bytes. Those paths now retain the existing source behind its `removed`/`rejected` status and atomically record a reasoned retention entry. The original author-delete and account-erasure flows remain unchanged and take precedence. Already-destroyed historical evidence cannot be reconstructed.

The existing public visibility checks, feed/detail projections, hidden-body masking, comment filtering and notification visibility remain intact. Ordinary members cannot retrieve rejected media bytes, including by a direct media URL. AAL2-authorized staff use the existing review-media access. An approved image independently attached to another permitted visible post/avatar remains visible in that separate context; hiding a post does not claim global removal of every reuse of its image. Owner-scoped exports remain scoped to the requesting account.

The retention queue lists 25 records per page ordered by review deadline. Owner/admin review actions are:

- Continue the hold with a reason and another review within 90 days.
- Restore visibility only when source content remains, no author deletion occurred and no applicable case/parent evidence hold remains.
- Explicit permanent erasure with a reason and typed `ERASE` confirmation.

Linked media/comment actions lock parent posts before their own source. A held parent post prevents erasing or restoring its evidence. All successful actions, including repeat-retain no-ops, record an immutable receipt; uncertain browser outcomes retry the same request. Direct table access is denied to anonymous, member, service, the separate `docked_app` runtime and the beta runtime; the latter receives only the scoped functions.

## Policy and operations

The approved baseline is `docs/policies/2026-10-11-beta-rc3/privacy.md`. Routine diagnostic/security log targets remain 30/90 days; exceptional incident/dispute evidence requires a reason and review at least every 90 days. These migrations create no new indefinite-retention entitlement and no automatic deletion job. Staff must use the due-review queue. Account-erasure source cleanup is not bypassed. Audit-record retention and any legally required preservation exceptions must follow the approved policy through the existing controlled administrative process; staff cannot arbitrarily edit/delete audit events.

Structured appeals, customer-facing case correspondence and formal warning/appeal templates are not implemented by this bounded change. They require an approved operational procedure and communication policy. Existing reporting, suspension/restriction and support routes remain available. No suspension or enforcement was performed on hosted members.

## Migrations and verification

- `20261016215755_moderation_case_workflow.sql`: private case metadata, immutable events, current-session authority and narrow commands.
- `20261016220848_moderation_evidence_retention.sql`: private retention review/audit and the case hold-release correction. Created with the installed Supabase CLI; no hosted application is claimed here.
- Database tests execute the actual SQL in isolated PGlite: role/AAL1/ordinary-member denial, direct table denial, assignment rules, stale versions, exact retries, multiple holds, preserved body, parent-media/comment holds, owner-only erasure, typed confirmation, release after removal/deletion, refusal to restore erased content and immutable events.
- Browser acceptance runs the actual React components with explicitly synthetic local transport. It is not genuine hosted MFA acceptance and not physical Samsung acceptance. Evidence is under `docs/qa/moderation-workflow/`.
- Source/API inputs are strict, bounded, same-origin for mutations, rate limited and private/no-store. Network timeouts do not cause automatic mutation retries.

Focused SQL/input suites passed 6/6 across announcements, cases and retention. TypeScript and focused ESLint passed. Moderation browser checks passed at 360, 412, 1024 and 1440 pixels without horizontal overflow, runtime exceptions or serious/critical Axe findings. Actual mobile/desktop screenshots were inspected and secondary controls/fieldset styling refined. Earlier failed attempts included PL/pgSQL CASE-expression parsing/variable qualification, an accessible-selector mismatch and dark-theme contrast; these were corrected and rerun, not reported as passes. Native integration subsequently found that admission checks use row locks (so read transactions cannot be SQL READ ONLY) and postgres.js requires `tx.json` for object arguments to JSONB commands. Those server paths were corrected without changing SQL authority checks. Browser transport here is synthetic; genuinely authenticated database/browser acceptance is tracked separately by the integration run.

Apply both migrations before the updated moderation handler. If unavailable, the transaction fails atomically rather than partially removing evidence. Roll back application code only through a reviewed release; preserve private case/audit records. No production content was retained, erased or restored during development.
