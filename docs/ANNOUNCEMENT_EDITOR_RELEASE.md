# Announcement editor clarification — 19 October 2026

Live commit `29dbb5dee0af0d8a0ba573c8510db8061cde4075`, deployment `dpl_9go1ksqtWrtHJQLEVfaP9fQqQjt8`. Canonical docked.com.au release identity verified at 06:42:57 UTC.

The owner reported seeing Preview without approval/publication actions. Read-only inspection found two existing owner drafts, each version 1, with only create events. Runtime execute privileges for list/history/mutate were intact. The owner confirmed saved draft titles were visible. No permission outage was established: review/publication actions depend on selecting a saved draft and moving it through review. Previously the editor did not explain that sequence clearly.

The editor now explains the next action for new, saved, changed, in-review, approved and published drafts. Approval is labelled “Approve for publication”; publication remains a separate explicit action. The audit-reason requirement is visible. Failed staff-access loading now shows its error and a retry control instead of leaving a misleading preview-only interface. Retry preserves entered content. Owner/MFA, independent admin review, publication permissions and database functions are unchanged.

Verification: isolated browser journey passed failed-load recovery, preview without persistence, uncertain save exact retry, reload, discard, submit, approval without publication, explicit publication and archive. 412px/1440px checks passed no overflow and no serious/critical accessibility violations. SQL authorization/replay/audit and publication tests passed (3 tests total including request validation). ESLint passed. Typecheck initially found test-only control-flow narrowing after a null assertion; corrected the snapshot assertion and typecheck passed. Hosted build reached READY; candidate identity matched; anonymous announcement administration remained 403; member archive returned 200. Authenticated live publication was not performed by the agent.

No announcements were created, edited, approved or published by this release. No database migrations, member asset changes or push notifications were performed. Existing unrelated work remains untouched.

Owner workflow: select a saved title → enter reason → Submit for review → enter reason → Approve for publication → enter reason → Publish on Docked. Unsaved changes must first be saved or discarded.
