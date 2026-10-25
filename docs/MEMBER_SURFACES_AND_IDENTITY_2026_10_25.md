# Docked member surfaces and identity verification review

## Approved deployment — 25 October 2026

Following the owner's explicit **deploy** instruction, the application is live at **https://docked.com.au**, commit **`b9f390f787abb425e18bdae1fbc9860761053390`**, deployment **`dpl_1zNzJKGBTFN9z6vYsJKUAuwo3ffA`**. This includes implementation `ccc4fbef` and a hosted-check correction for signed-out identity pages. The first candidate was not promoted after its customer identity page returned HTTP 500; the corrected page uses existing sign-in/MFA recovery, and the staff page denies unauthorised access with 404.

The corrected candidate and live domain each passed **57 HTTP checks**. Release identity, closed registration, private API denials and delivery of the new root stylesheets were verified. These were signed-out checks: no authenticated browser session was available, and no signed-in or installed-app acceptance is claimed. The additional authentication regression suite passed **14 tests**; lint and the production build passed again.

Migration `20261025015440` was applied transactionally after its reviewed hash and private recovery snapshot were verified. Existing records were unchanged within that migration. Across the whole release, **31 of 32 protected table fingerprints remained identical**. The remaining table, `sports_feed.nfl_rounds`, changed only `last_checked` and `next_check` for one round through the existing scheduler. Wallets, inventory, transactions, entries, results, cron configuration and activation controls remained unchanged. All four prize templates remain inactive.

The prior live deployment `dpl_AZdRYXmTYKsdUZHCJH4JZWLnHnir` remains the application rollback target. Real KYC intake, payment activation, prize awards and NBA visibility were not enabled. No real documents, emails, purchases or account approvals were used during verification. The recovery snapshot is an application-data/function-definition snapshot with verified readback, not a complete disaster-recovery drill.

Post-release logs contained ten expected authentication-denial messages from the signed-out tests and no unexpected runtime failures in the sampled window. No log drains are configured. Supabase's existing leaked-password-protection warning remains unchanged; see [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Release evidence is in `docs/qa/member-surfaces/release/`.

The implementation and limitations recorded below are retained as the pre-deployment handover. This addendum supersedes only its not-deployed statements.

This release candidate improves NFL, AFL and NRL Rankings, Prizes, Market and pack presentation. It adds a locally executable synthetic identity-verification workflow to the existing withdrawal service. It has not been deployed. No production accounts, balances, inventory, permissions, prizes or email deliveries were changed.

## Changes and status

| Requirement | Implementation | Release constraint |
| --- | --- | --- |
| Rankings and Prizes layout | Heading, navigation and competition controls occupy separate normal-flow rows; responsive wrapping, bounded controls and safe-area padding | Hosted and installed-app acceptance remains required after an approved deployment |
| Marketplace | The actual root layout now imports marketplace CSS; bounded portrait cards, blue/navy controls, readable listing fields, compact activity and proceeds labels | Existing credit-sale permissions and settlement remain authoritative |
| Selling fees | Exact requested copy; server fee-estimate endpoint uses the same `sellerQuote` as settlement; no minimum, 5%, 2,000 cap, whole-credit rounding | Historical fees unchanged |
| Upcoming AFL and NRL prizes | Approved schedule preview appears for both modes when the selected historical test round has no published prizes; historical no-prize notice remains separate | No awards or competition activation; tie policy still required |
| Future inheritance | Additive before-insert trigger saves the existing approved inactive reward template only for new future AFL/NRL rounds using the approved salary version | Migration unapplied to hosted infrastructure; activation remains false |
| Pack artwork | One layered, lightweight shared component: platinum Starter, blue Standard, obsidian/gold Premium; actual Docked logo, sport and count labels, reduced-motion support | Prices, contents, supply and probabilities unchanged |
| Entry wording | Closed rounds without a confirmed entry say Not entered; closed-entry status is separate; empty rankings avoid “— of 0” | No historical scoring or entry changes |
| Identity verification | Profile/withdrawal entry points, synthetic details/documents/review flow, queue, changes, rejection, approval/revocation, version checks and audit | **Synthetic local workflow only. Real document collection and production reviews remain disabled** |
| Identity document security | Provider-independent encrypted quarantine, signature/size checks, fail-closed scanner/raster-preview contract and retention candidate selection | Concrete private storage, malware scanning, safe rendering and approved retention configuration are not connected |
| Identity support email | Submission-version outbox is persisted with the case in the existing transactional state; lease/retry worker contracts and minimal authenticated-review message | Concrete durable dispatch adapter, approved transport and scheduled delivery are not enabled; tests use a mock transport |

## Why previous UI changes were invisible or broken

The marketplace stylesheet existed but was absent from `src/app/layout.tsx`. Some older browser fixtures imported it separately, so they displayed a styled market that the application did not receive. The new browser harness reads the actual root-layout CSS import list. Its baseline screenshot reproduces large cards, merged metadata and purple controls; the updated screenshot shows bounded cards and separate fields.

Rankings used explicit grid rows/columns for the old individual links. Shared navigation tiles and the competition switch did not fit that contract. A second desktop media query also reassigned those positions. Those placements were removed; actions now have their own wrapping navigation row and competition options share one coherent two-column container. This is a structural change, not a z-index or arbitrary-offset patch.

The AFL/NRL approved prize rules were saved as inactive future templates. The customer page rendered only published competition-specific schedules, while the default selected PRIVATE-TEST-2026 round correctly had no prizes. The page now shows the authoritative upcoming template separately from that historical selection. Neither a template nor its preview enables payouts.

## Identity workflow and its limits

The existing withdrawal engine already enforces verified identity, eligible balances, holds and bank-destination rules. The new case decisions update that same account-level identity state. Approval creates no withdrawal or payment. Deposit services and endpoints were not changed.

The local synthetic policy accepts exactly two different test document types, including at least one test photo ID. Licence front/back count as one form. Required sides, duplicate file hashes, scan state and file size are validated. Fixed fictional details and generated evidence prevent real IDs entering the test-only route. No document data is stored in browser localStorage. Submitted snapshots remain versioned through changes and resubmission.

Review requires the existing identity-review permission and MFA. Payment-only/support access is insufficient. Self-review, stale case revisions and stale document versions are rejected. Internal notes are omitted from customer projections. Document access is audited. Case submission and its outbox item persist together; email failure does not roll back the case. The message contains only case reference, timestamp and an admin URL requiring an authenticated session, with no attachments or bearer download URL.

**This is not a completed real-document upload service.** Before accepting real ID, the following are required:

1. An administrator-approved accepted-ID policy, including allowed combinations, photo requirements, required sides, applicant eligibility and reverification rules. The synthetic test policy is not a legal-compliance determination.
2. Approved collection notice, privacy handling, retention periods, deletion/hold rules and review procedures. No statutory period has been invented. Null retention disables cleanup.
3. A concrete private storage adapter and server-owned file metadata/repository, quarantine permissions, encryption-key lifecycle and verified backup/recovery. No public bucket or signed bearer-document URL is created by this work.
4. A configured malware scanner and safe image/PDF renderer with real-file acceptance tests. The file-signature and active-PDF checks are preliminary gates, not a substitute for a scanner. HEIC is unsupported.
5. A production upload/session and safe-preview integration against those approved services. The visible test form generates synthetic evidence; it does not advertise working real-file uploads, camera capture or upload progress.
6. Explicit production reviewer permission grants and authenticated hosted cross-account/MFA tests. Current production review permissions remain unchanged.
7. A durable dispatch adapter for the outbox worker, approved email transport, retry monitoring and scheduled execution. No actual support notification was sent during testing.

Do not enable `DOCKED_REDEMPTION_LOCAL` on Vercel/Production. The existing runtime guard rejects hosted/non-local use. Customer and owner pages explain that real collection is disabled.

## Prize configuration and migration

`supabase/migrations/20261025015440_upcoming_australian_prize_inheritance.sql` adds one private trigger function and a before-insert trigger. It does not update existing competitions, snapshots, drafts, entries, cards, wallets or reward schedules. New rounds qualify only if their sport is AFL/NRL, lockout is in the future, they are unscored, they use the approved October 24 salary version, and they do not already carry a saved reward policy. Inherited rules are inactive and have a null tie policy.

The existing authoritative schedules remain:

| Mode | First | Second | Third |
| --- | --- | --- | --- |
| Traditional | 25,000 Docked Credits | 10,000 Docked Credits and five Standard 9 Packs | Five Standard 9 Packs |
| All-Star | 100,000 Docked Credits | 25,000 Docked Credits and five Premium 9 Packs | Five Premium 9 Packs |

Packs match the competition sport. Season prizes remain to be announced. NFL prizes are unchanged. The existing award engine and ledger/idempotency mechanisms are reused; no prize-award command was executed against hosted data. A saved approved tie policy is still required before automatic awarding. Historical no-prize rounds are not eligible for retrospective awards.

## Verification evidence

Executed results: **627 platform tests passed; 222 database tests passed; lint and the optimized production build passed; 63 browser route/width checks passed**, including 200% text sizing. See `docs/qa/member-surfaces/verification.json` and `browser.json` for the evidence summary. Browser tests serve actual React components and root CSS at the customer route paths through an isolated HTTP harness. Authentication and accounts are simulated, and all purchases/reviews use synthetic fixture state. These are not authenticated Production tests or native-device acceptance.

The full platform and database suites cover existing NFL scoring, inventory, ownership, wallets, RLS, packs and redemption. New tests cover two distinct IDs, required sides, duplicate hashes, quarantine, wrong-owner decryption, reviewer permission, self-review rejection, optimistic revisions, resubmission, audit, withdrawal holds and non-redeemable credits, and mocked email failure/retry. The migration test compares existing rounds before/after and verifies inactive future inheritance with no published prize schedule.

Rendered checks include Rankings/Prizes/Market for NFL/AFL/NRL at 320, 360, 375, 390, 430, 768 and 1440 CSS pixels; enlarged text; both Australian prize modes; listing management; fee estimates at low, half-credit and capped prices; purchase review and isolated settlement; activity; synthetic identity submission/review; and 21 labelled pack variants.

Screenshots:

- [Baseline marketplace](qa/member-surfaces/before/market-1440.png)
- [Updated marketplace](qa/member-surfaces/market-nrl-1440.png)
- [Mobile Rankings](qa/member-surfaces/results-afl-390.png)
- [Mobile Prizes](qa/member-surfaces/prizes-nrl-390.png)
- [Listing management](qa/member-surfaces/market-manage-nrl-390.png)
- [Purchase review](qa/member-surfaces/market-review-nrl-390.png)
- [Market activity](qa/member-surfaces/market-activity-nrl-390.png)
- [Pack families](qa/member-surfaces/pack-families-1440.png)
- [Synthetic documents form](qa/member-surfaces/identity-documents-390.png)
- [Synthetic submitted status](qa/member-surfaces/identity-submitted-390.png)
- [Synthetic staff review](qa/member-surfaces/identity-review-390.png)

## Dependency security

The registry audit reported affected Next.js and Zod versions. The candidate pins Next.js 16.4.3 and Zod 4.6.7. The post-update production-dependency audit reports zero vulnerabilities. Relevant published advisories: [Next.js image optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw) and [Zod oversized collection validation](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A clean audit does not replace application security testing.

## Deployment actions for review

1. Review this candidate commit and its additive migration. Preserve the current live release as rollback target. Confirm a current database backup/recovery point at deployment time; this task did not claim a new hosted backup.
2. Build and deploy to the existing protected environment using the repository's deployment runbook and existing Vercel project. Use the pinned lockfile. Keep NBA hidden, registration closed, payments/prizes and real KYC collection disabled.
3. Apply only the new migration through the existing reviewed migration process after checking the target project and schema version. Use `supabase db push --dry-run` only against that verified project to inspect pending migrations; do not perform a generic push or replay older migration timestamps. Rehearse the one reviewed file transactionally against an isolated clone, then install it through the restricted release process, recording its hash. A UI-only rollout can show upcoming prize previews without activating or rewriting rounds.
4. Perform authenticated hosted acceptance with authorised testers: sport context, rendered Rankings/Prizes, owned collections, read-only wallet/market views, pack navigation and disabled real-KYC state. Continue to use isolated fixtures for purchases, identity review and awards.
5. Enable neither prize-bearing competitions nor real identity intake as part of this UI release. Each needs its separate policies, integrations and approval above.

Application rollback restores the previous reviewed deployment. To disable the new future-inheritance behaviour, drop trigger `australian_future_prize_rules` on `beta_fantasy.competitions`, then drop function `sports_feed.inherit_australian_prize_rules()`. Do not rewrite saved snapshots of rounds created during the candidate release. No destructive cleanup, account changes or financial rollback is part of this migration.
