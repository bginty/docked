# Docked pre-launch acceptance — 16 October 2026

## Decision

This is a local implementation and evidence package for owner review. Docked is **not yet accepted for commercial launch or Google Play submission**. The current invited free beta remains the appropriate operating mode. No Production deployment, hosted migration, member-asset mutation, payment activation, trading activation or paid infrastructure was performed by this programme.

The largest implemented change is the Owner Command Centre: a responsive operational overview using the existing authoritative stores, with separate test-wallet reporting, recorded exceptions, activity, supply, competitions and feed operations. The underlying wallet, scoring, ownership and six rarity rules remain intact.

Read alongside:

- [Experience audit and browser evidence](prelaunch-experience-audit.md).
- [Backend security and provider fixes](PRELAUNCH_BACKEND_SECURITY_AUDIT.md).
- [Licensed provider trial readiness](FANTASY_PROVIDER_LAUNCH_READINESS.md).
- [Android, payments and Play checklist](PRELAUNCH_ANDROID_PAYMENTS.md).
- [Visual review index and owner before/after](qa/prelaunch-store-assets/index.html).
- [Final owner desktop](qa/prelaunch-owner/browser-1792154014484/owner-1440.png) and [mobile](qa/prelaunch-owner/browser-1792154014484/owner-412.png).

## Confirmed defects corrected

| Area | Finding and correction |
| --- | --- |
| Social modal lifecycle | A nested dialog's React cancel event propagated to its parent, closing both the card picker and composer. The active sheet now stops propagation. Repeated cancel, back, failure, retry and unmount paths are exercised locally. |
| Native lifecycle | Parallel native listener acquisition could orphan successful listeners if another registration failed. Each registration now owns its cleanup; late resolutions are removed after unmount. |
| Moderation | Client action options included unsupported target/action combinations. UI and server now share the supported-action map. Submission is synchronously guarded, and successful actions refresh the view. Failed or abandoned admin reads clear stale records. |
| Card consistency | Weekly Core reveal/detail suppressed verified numbers while the canonical collectible showed them. They now use the same verified-number projection; missing numbers remain absent. No card identities or awards change. |
| Dark surfaces | Authenticated moderation panels inherited light styles, making text unreadable. Shared dark surfaces and restrained borders now apply. |
| Owner reporting | The old overview relied on legacy pack counts, missed the current credit economy and foregrounded obsolete product copy. The new read-only projection includes current, weekly and legacy pack openings; matches date/sport/member definitions; excludes expired pending offers; and displays canonical competition names without rewriting records. |
| Provider rights | Isolated-beta permission was incorrectly projected as commercial fantasy rights. Scope is preserved, and new raw-record retention cannot exceed permission expiry. |
| Provider identity/time | Provider mappings now reject incomplete/non-bijective identities and nonexistent local DST timestamps instead of accepting ambiguous data. |
| Credential boundary | Escaped credentials in parsed provider JSON are detected before persistence. |
| PayPal sandbox | Floating-point currency formatting could lose a cent at large safe-integer amounts. Exact integer formatting and pre-transport validation replace it; redirects are rejected. No live checkout added. |

## Owner and staff operations

The owner page at `/admin/operations` has four leading indicators, a compact attention queue, an accessible daily activity chart/table, wallet reconciliation and issuance categories, six rarity supply summaries, feed job/worker history, competition deadlines and links to existing controlled workspaces. Staff workspaces remain separate at `/admin` and `/admin/community/*`.

All report queries remain behind verified server role/MFA checks and the established database active-session/owner/AAL2 guard. Wallet calculations run in the same repeatable-read, read-only transaction as the report and expose aggregates, not private member ledger records. This is not an alternative wallet or an administrative ownership-edit path.

Metrics have deliberately narrow definitions:

- Active members means admitted, non-disabled members with a saved-entry update, opened pack or non-deleted social post in the selected interval. It is not DAU, login activity or retention.
- Entries use their latest saved timestamp. There is no invented submission-event history.
- Activity dates use Sydney boundaries; database timestamps and reporting instants remain authoritative.
- Pack openings include current economy, Weekly Core and legacy packs. Unknown historical sport is included only in all-sport reporting.
- Invitation counts use unexpired reserved invitations; staff exclusion also checks role records.
- Wallet totals are lifetime account-wide test credits, unaffected by date/sport/staff filters. Reserved and pending amounts are not spendable. Test spending and fees are not cash revenue.
- Supply is recorded edition capacity, not a promise of stock. Core's existing unlimited rules remain unchanged.
- Feed warnings derive from recorded blocked/expired jobs; a missing provider is not fabricated as an outage. Worker history is the latest ten records; failure views are bounded and labelled.
- Unavailable cash receipts, retention cohorts and complete service uptime are explicitly unavailable.

The moderation follow-up adds a compact, filterable loaded queue and protected evidence/history inspection using existing tables. Existing roles and target-specific permissions remain authoritative. It does not invent severity, assignment or appeal records where none exist.

### Migration and rollback

`supabase/migrations/20261016115553_owner_command_centre.sql` is additive and read-only. It introduces the `beta_private.owner_command_centre` reporting function, reuses the existing guard, denies public/anonymous/member/service-role execution, and grants only the existing beta application role. It performs no reward issuance, ownership change, credit adjustment or feature activation.

Apply only through the established migration pipeline after confirming target identity, earlier migrations and a usable recovery backup. The application's established beta schema mapping resolves the runtime `private` name. Local fixture tests cover that mapping and permissions. **No hosted migration was applied.** Roll back the application to its prior report caller if required; the unused additive function can remain. Never restore or reset a live ledger as an application rollback.

## Acceptance evidence and limits

The local browser suites render actual shared React components and CSS with isolated fixtures. They are useful UI and interaction evidence, not hosted authentication or physical-device acceptance. Synthetic records are labelled. No real purchases, posts, entries or account edits were made for screenshots.

- Owner, Social/moderation, Profile/weekly pack: 1440, 1024, 412 and 360px screenshots; keyboard/focus checks and serious/critical automated accessibility checks.
- Canonical cards: same owned fixture card across seven contexts; all six rarities; verified/missing numbers; long names; responsive proportions; controls outside artwork; reduced motion and replay safety.
- Social: attach/remove/cancel, nested Escape/Back, retries, uncertain response using the same idempotency key, navigation/unmount and synthetic touch scrolling.
- Database and native PostgreSQL checks separately cover authority, privacy, transaction and feed concurrency. SQL fixtures do not prove the hosted identity provider works.
- The local genuine-auth avatar upload/persistence journey could not run because the Docker/GoTrue stack was unavailable. Prior evidence is not promoted to a fresh pass.

Final check counts and screenshot paths are recorded in the companion `qa/prelaunch/acceptance.json`. The full platform suite passed 425/425; final owner/moderation checks passed 5/5. The initial full database run encountered local process-memory exhaustion after 79 passes and 17 file failures. All interrupted files passed separately in sequential groups (4 and 79 tests), and the later moderation query passed its 20-test community database suite plus two platform tests. Failed attempts are retained rather than overwritten as passes.

Final typecheck, full lint, clean-environment production build and canary scan passed. The latter found no server credential markers in 59 browser assets. The final known-secret source scan inspected 516 deployable files with zero findings/errors. Both production-only and full-lockfile npm advisory audits returned zero reported vulnerabilities on this review date; this is not a future security guarantee.

## Protected Preview and APK capability

Read-only inspection on 16 October confirmed Vercel project `docked-preview` has SSO deployment protection for all deployments and no Production domains. Its intended Supabase project is `bckkllmndoxzpzdqrevb`, separate from the live beta project. Environment-key metadata inspection does not attest to every deployed runtime value.

The isolated Preview owner identity `support@docked.com.au` has not completed email/password/MFA setup there. Admission is disabled; there are no admitted members or credit-state records in that project. Existing live-beta authentication is a different project's state. Therefore this branch has **not been deployed** or represented as usable Preview acceptance. Existing Production remains untouched.

The old v20 APK capability note remains untracked and excluded from delivery. Read-only verification matched the prior relocation receipt: the old object path returns 404, the archive is private and replacement v22 exists. This withdraws the origin object; it is not cryptographic token revocation or proof about previously cached copies. Token expiry is 18 October. No unnecessary signing-key or Auth-key rotation was performed.

The broad secret scanner still reports nine findings. Eight are hash-reviewed fixture/generated strings; one is the genuine local capability above. **The broad scan is not clean.** Separate deployable-source and built-browser canary checks are reported with their own scope.

The selected delivery-file scan found no exact known-secret matches, but flagged one deliberate build-canary assignment in the existing clean-build helper. Its raw FAIL result is retained beside a hash-bound manual review (`qa/prelaunch/staged-secret-review.json`); no scanner exclusion or credential-hiding edit was made.

## Launch register

P0 means do not activate the affected public/commercial capability. P1 means required evidence or work before public launch. This table does not block the existing invited free beta solely because future payments are incomplete.

| Priority | Outstanding requirement | Next action / owner |
| --- | --- | --- |
| P0 commercial data | No verified production fantasy-use, storage or redistribution licence | Owner obtains written provider scope; engineering runs adapter semantics, corrections and finalisation acceptance before enabling a feed. |
| P0 paid products | No complete Play Billing/token/RTDN/refund pipeline; PayPal buttons do not establish permission | Approve product classification and provider route, pricing/refund/dispute policy and Australian legal review. Implement and test against the existing ledger before any activation. |
| P0 release gate | Protected Preview owner/admission setup incomplete | Owner completes setup in the isolated project. Recheck credentials/protection/runtime isolation, apply reviewed migrations, then run consented hosted owner/tester journeys. Do not substitute the live database. |
| P1 identity/device evidence | Fresh hosted owner MFA, staff denial, avatar upload/persistence and physical Samsung acceptance incomplete | Restore local Auth test services; then run authorised isolated-hosted QA. Test Chrome, Samsung Internet and the native shell on S24. |
| P1 recovery | Actual-environment restore drill and Auth/media/ledger recovery not demonstrated | Define RPO/RTO and retention, produce encrypted backup, restore to an isolated target and reconcile ownership/serials/ledger/snapshots. |
| P1 moderation operations | Complete assignment, severity, appeals and retention policies/workflows not established | Approve staff responsibilities and evidence retention; use controlled reversible actions and immutable attribution. Existing removal paths may erase original body/media; audit events alone are not a full content-evidence archive. |
| P1 store acceptance | Data safety, account-deletion journey, audience/content rating, review credentials, closed-testing eligibility and signing ownership need Console/owner evidence | Complete the official checklist and truthful native screenshots; do not label repository scaffolding as store compliance. |
| P1 data operations | Persistent vendor mapping revisions/semantic coverage and exceptional correction sign-off need licensed trial evidence | Use the provider trial checklist and isolated fixtures; keep absent results pending. |
| P1 performance | Component/browser checks are not a physical memory/startup/network benchmark | Record production-build route timings, large inventories/feed scroll and native startup/crash recovery on representative hardware. |
| P1 security evidence | Broad scanner still flags local capability; hosted configuration needs acceptance beyond key metadata | Retain explicit classification, exclude the capability, recheck expiry/origin withdrawal and complete hosted permission review. Current npm advisory checks passed. |

## Product roadmap after acceptance

| Priority | Improvement | Benefit / effort / dependency |
| --- | --- | --- |
| P2 | Clear weekly hub and personal finalised-week summaries | Faster return to gameplay; medium effort; licensed complete statistics and current competition rules. |
| P2 | Consent-based retention and onboarding funnel | Measures first-pack/first-entry completion without invented activity; medium effort; event/retention consent policy. |
| P2 | Operational case assignment and service-level queues | Less duplicated staff work; medium effort; role/appeal/retention policy. |
| P2 | Contextual invitation and notification preferences | Relevant reminders and genuine social growth; medium effort; delivery permissions and anti-spam controls. |
| P3 | Additional sports, richer discovery and advanced analytics | Broader audience; high effort; explicit sport economy/rules/licensing approval. |
| P3 | Alternative billing programme | Payment choice if eligible; high operational effort; enrolment, regional APIs, fees and reconciled receipts. |

## Owner acceptance checklist

1. Review the new owner, moderation, card and weekly-pack screenshots and metric definitions.
2. Complete the **isolated Preview** owner identity and MFA if Preview acceptance is desired; this does not reset live-beta credentials.
3. Provide written provider trial permissions and commercial questions from the data checklist. Do not paste keys into chat; use existing secret configuration.
4. Confirm free beta credits remain the current mode. Treat payments, redemption, external banking, live trading and weekly reward activation as separate gated decisions.
5. Review moderation evidence retention/appeals and the data-safety/deletion disclosures.
6. On S24, test login/MFA, background/restore, Android Back, keyboard, rotation, card composer cancel/failure/retry, repeated scroll/navigation, pack interruption/replay and avatar replacement/removal. Physical acceptance remains pending until performed.

Only after these gates and the final hosted checks should a release be considered for Play closed testing or public customers.
