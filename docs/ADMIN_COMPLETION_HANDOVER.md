# Docked remaining-work follow-up — 17 October 2026

This report supplements the historical pre-launch and exact-dashboard handovers. The user's subsequent instruction makes the existing invited live beta the release destination. The unused Preview projects remain intact; their setup is no longer a prerequisite for this live-beta workflow. This does not authorise commercial payments, public registration, unrestricted trading, or changes to existing member assets.

## Verified live release

Application commit `64c3463528fab5ff23885beb000e06eb0c5dd42e` is live at https://docked.com.au and https://www.docked.com.au, deployment `dpl_A1YNTWaqYY2dca9aJinRjPWko4bK`. It supersedes the earlier c72dd83f reporting release. The protected production candidate passed 18 access/configuration/asset checks before promotion; the same 18 checks passed on the live domain and both aliases point to this exact deployment. Evidence: `qa/admin-completion/live-release/`.

Six additive workflow migrations were applied to the approved existing beta database after a targeted private backup. Before/after fingerprints of credits, cards, entries, revisions, locks and reward stores matched. Twelve function grants and nine RLS-protected tables were independently checked. No reward activation, hosted QA transaction, member-asset change or announcement delivery occurred. A targeted migration backup is not a full restore drill.

The immutable web-only export passed its secret scan: 562 files, no findings. Existing hosted build/runtime guards and restricted database connection remain intact. Unnecessary integration-injected privileged variables are empty in this deployment. Broader local secret-scan findings remain separately tracked. No source was pushed to the public GitHub repository.

These hosted checks prove release identity and anonymous boundaries. Genuine owner MFA and mutation acceptance were performed against isolated local GoTrue and native PostgreSQL, not the live owner account. Physical Samsung acceptance remains pending.

## Completed implementation deployed to live beta

- Persisted announcement drafts, preview, review status, optimistic concurrency, exact retry receipts, archive/restore and immutable staff history. Delivery remains separately disabled. See `ADMIN_ANNOUNCEMENT_DRAFTS.md`.
- Read-only administrative record drilldowns for members, cards, packs, credit journals, competitions and moderation, with bounded history and role-specific projections. See `ADMIN_RECORD_REVIEW.md`.
- Owner-triggered API/web health evidence with fixed targets, bounded requests, current role/MFA checks, database timestamps and expiry. Missing/stale checks remain unknown. See `OWNER_HEALTH_OBSERVATIONS.md`.
- Moderation case assignment, severity, review, escalation, resolution and reversible holds, with optimistic concurrency and immutable events. Removed evidence remains protected for review under the existing 90-day policy; author deletion still takes precedence. See `MODERATION_CASE_WORKFLOW.md`.
- Beta credit request, recipient selection, amount/reason/confirmation and auditable approval/decline/cancellation. Approval does not issue credits or change a balance. See `BETA_CREDIT_REQUEST_REVIEW.md`.
- Genuine local Auth, avatar and Social acceptance completed with isolated fixtures. Failed and incomplete attempts remain recorded rather than counted as passes.

The genuine native-PostgreSQL owner check found an integration defect that isolated SQL-engine tests missed: reporting transactions marked SQL `READ ONLY` called the existing admission guard, whose `SELECT FOR SHARE` locks PostgreSQL correctly rejects in that mode. The affected reporting wrappers now retain the guard and its locks in ordinary transactions; the owner report retains a repeatable-read snapshot. The queries still perform no domain writes, and no role, grant or RLS rule was relaxed. Actual local owner MFA then successfully loaded reporting, search and record APIs while ordinary members and owner AAL1 sessions remained denied. Live authenticated acceptance remains separate.

Native request testing also found JSONB parameters being double encoded by postgres.js. Mutation wrappers now use `tx.json` for structured values; JWT claims passed to `set_config` intentionally remain text. The genuine local credit workflow verifies concurrent duplicate requests return one record, exact retries match, competing approvals produce one success and one conflict, ordinary members are denied, and the entire credit/commerce state hash remains unchanged. Announcement creation, retry, submission and owner approval also passed through actual GoTrue MFA and the restricted PostgreSQL runtime. No announcement was delivered.

The final combined authenticated run passed on 16 October at 22:45 UTC (17 October Sydney). It also verifies health recording and same-key retry, member denial, moderation assignment/hide/release, removal with retained evidence, and retention review/restoration. Evidence: `qa/auth-recovery-20261017/admin-authenticated.json` and `admin-authenticated-attempt16.log`. The health test required an explicit nondeployable local-admin harness profile: development mode, exact loopback ports, restricted database role, closed feature flags and no hosted credentials. Its boundary tests passed; the production origin guard was unchanged. Earlier failed attempts, including stale-server and local-profile configuration failures, remain recorded.

## Verification evidence

- Dashboard: five reference viewports, including 1536 desktop and 360 mobile, inspected browser screenshots in `qa/owner-reference/final/`.
- Announcement controls: 1440/412px; moderation controls: 1440/1024/412/360px. No horizontal overflow, browser exceptions or serious/critical Axe findings in these fixture checks.
- Real local authenticated Social, Cards, communities, offers and packs: desktop, portrait and landscape checks in `qa/auth-recovery-20261017/visual7/`. Genuine owner dashboard screenshots use the isolated database, rather than fabricated production statistics.
- Platform verification covers **444 tests**: the final full run passed 441 and failed three release-tool tests because the filesystem sandbox denied temporary Git-fixture creation. All three passed when rerun with the required filesystem permission (`platform-release-tools-retry.txt`). Earlier, a stale communications-copy assertion was corrected by preserving the explicit “not activated” description; its affected group passed. No test failure is suppressed or described as an uninterrupted pass.
- The final database run passed **172/172**, with no skipped tests. The earlier interrupted run remains recorded as incomplete.
- Final full lint and typecheck passed (`lint-final.txt`, `typecheck-final.txt`). The clean isolated production build passed, and server-credential canaries were absent from all **63 browser assets** (`build.txt`, `client-boundary.txt`).

These browser widths are emulation, not physical Samsung acceptance. Fixture interfaces and genuine local Auth acceptance are labelled separately throughout the evidence.

## Boundaries still requiring external evidence or decisions

| Requirement | Remaining dependency |
| --- | --- |
| Licensed NFL/EPL feeds | Written provider permissions, credentials and provider-specific trial semantics; synthetic adapters do not establish commercial rights. |
| Real payments and financial activation | Approved products, provider eligibility, Play programme route, pricing/refund/dispute rules and legal review. No live checkout, redemption, bank settlement or transferable cash value is enabled. |
| Hosted member-to-member settlement | Explicit transaction/policy/security activation review. Local atomic tests do not authorise live settlement. |
| Weekly Core rollout | Separate feature activation/enrolment decision; this release does not grant packs or modify tester inventories. |
| Physical Android acceptance | An attached physical device and tester evidence for Samsung Internet, Chrome/native Back, keyboard, orientation, background/restore, large text and interrupted reveals. |
| Play submission | Console signing/ownership, testing eligibility, data-safety and audience declarations, reviewer access and accepted privacy/deletion disclosures. |
| Recovery acceptance | Approved recovery objectives and an isolated restore target covering Auth, media, ledger and entries. A targeted migration backup is not a full recovery drill. |
| Hosted owner journey | Owner's real MFA browser session; do not fabricate tokens or replace live authentication to generate acceptance evidence. |
| Non-owner privileged staff activation | Current invited-beta admission deliberately excludes non-owner privileged roles. Permitted future staff workspaces and SQL role checks do not authorise bypassing that admission policy. Positive hosted staff acceptance requires the approved staff-admission rollout. |

The application is an invited free beta, not a certified commercial launch. Unsupported metrics and administrative actions must stay explicitly unavailable. The broad local secret scan still has classified unresolved findings, including the excluded old APK capability note; narrower deployable-source/client-boundary checks must not be described as a clean full scan.

Genuine local role-revocation acceptance also passed: changing the isolated owner fixture to auditor immediately denied reads and mutations with the same AAL2 session; restoring owner admission restored access. This verifies revocation, not positive staff activation. Evidence: `qa/auth-recovery-20261017/admin-staff-role.json`.


## Screenshots and operational documentation

- [Authenticated local desktop dashboard](qa/auth-recovery-20261017/owner-1792189419697/owner-1536.png) and [mobile dashboard](qa/auth-recovery-20261017/owner-1792189419697/owner-412.png).
- [Tablet](qa/owner-reference/final/owner-1024-full.png) and [reference comparison](qa/owner-reference/final/comparison.html).
- [Persisted announcement review](qa/admin-announcements/announcement-412.png), [record drilldown](qa/admin-record/record-412.png), and the moderation/credit screenshots in their matching QA folders.
- [Permission matrix and functional destinations](ADMIN_WORKSPACE_ACCESS.md).
- [Android/payments readiness](PRELAUNCH_ANDROID_PAYMENTS.md), [provider readiness](PROVIDER_READINESS.md), and [security audit](PRELAUNCH_BACKEND_SECURITY_AUDIT.md).

Unavailable broader workspaces remain explicitly labelled: separate support-case and appeal-intake systems, a general CMS approval system, arbitrary configuration editing and financial correction execution. These are not represented as implemented features. Financial execution, broadcast delivery and non-owner staff activation require their approved policies; physical and hosted-user acceptance require external access/evidence.
