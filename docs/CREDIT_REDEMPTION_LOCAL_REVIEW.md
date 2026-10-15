# Credit redemption — local review, activation disabled

15 October 2026. Based on `e72dd10a24c9ac8d600eb3ef1e363ae18a39e662`; changes are in the working tree for review. Nothing was deployed or applied to a hosted database. Existing members, balances, cards, competitions and histories were not used for QA. No real identity evidence, real redeemable issuance, EFT, email, invitation or member post was created.

## Preview and screens

Start with `node --import tsx scripts/redemption-local.ts`, then visit **http://127.0.0.1:3024/qa**. Select Alex Example for the customer or the staff fixture for reviews/payment processing. These deliberately labelled fixture sessions are not production authentication. The preview state is isolated, in memory and resets when the process restarts. Enter synthetic bank data only; the ready customer fixture already has an encrypted destination. The other customer fixture starts without identity approval.

Application routes: `/profile/withdrawals`, `/admin/redemptions`, `/api/redemptions`. Both existing Profile entry points link to Withdrawals. Staff access requires an explicit permission grant and MFA; being an ordinary member or supplying `admin=true` does not grant permission.

- [Customer desktop](qa/redemption/customer-desktop.png), [customer mobile](qa/redemption/customer-mobile.png)
- [Mobile review](qa/redemption/review-mobile.png), [request received](qa/redemption/requested-mobile.png)
- [Staff desktop](qa/redemption/admin-desktop.png), [staff mobile](qa/redemption/admin-mobile.png)
- [Identity review](qa/redemption/identity-admin-mobile.png), [enlarged text](qa/redemption/customer-enlarged.png)

## Implemented behaviour

One whole credit equals one AUD cent. The parser uses BigInt arithmetic, then a bounded integer accepted by the existing ledger. `100` credits is exactly `$1.00 AUD`; `10,000` is `$100.00 AUD`. The existing technical transaction ceiling of 1,000,000,000 credits is retained; it is not a proposed commercial limit. Commercial minimum/maximum settings are explicitly null in the fixture. No fee is invented.

The existing `credits_sandbox` aggregate, funding lots, available/reserved buckets, append-only journals, withdrawal records, transactional store and shared advisory lock are extended. There is no separate cash wallet. Legacy `redeemable` flags are sandbox accounting flags and do **not** confer cash eligibility. Only newly seeded isolated QA lots with an explicit `cashEligibility` marker and accepted issuance-policy reference can exercise the local redemption flow. Existing lots are not reclassified.

Total credits include pending redemption. Available-to-redeem is a subset of spendable credits, not another wallet balance. Test/other credits are displayed separately. Restrictions or held funds fail closed. Marketplace FIFO consumption is unchanged, and reserved credits are unavailable to marketplace spending. Descendant seller-proceeds lots do not automatically inherit the new cash-eligibility marker: the commercial source/proceeds policy remains an activation decision.

Submission atomically reserves the eligible source lots and snapshots the rate, amount, authorised encrypted destination and policy. Rejection or customer cancellation before payment is claimed releases those same lots exactly once. Approval does not send money. Staff must claim an approved request, then record the manual EFT with a unique bank reference and explicit confirmation. Sent consumes the reservation, without another available-balance debit. An uncertain/abandoned claim remains reserved until reconciliation. A confirmed unpaid outcome releases it; a confirmed returned EFT restores the original lots using one compensating journal. No operation initiates a bank transfer.

The allowed lifecycle is Requested → Under review/Approved → Payment in progress → Sent, with Rejected/Cancelled before claim, Reconciliation required after a claim, and Returned after Sent. Claimed requests cannot be cancelled by customers or claimed normally by another staff member. The original claimant records Sent; authorised payment staff can record reconciliation and returns. No automatic claim expiry or re-payment exists. A later identity revocation prevents claiming/revealing a destination, but does not prevent recording an EFT that was already sent: the accounting record must reflect the bank outcome.

Identity evidence submission never grants approval. The manual adapter supports submission, review, additional information, verification, rejection, revocation and later resubmission, with policy/version/timestamps/reviewer history. Identity names and evidence are synthetic fixtures. Real-document upload is deliberately absent/disabled, rather than presenting an insecure upload as ready. The fixture's seeded approval expires after one day; the staff preview's approval action uses a labelled development duration of 30 days. Neither is an approved commercial KYC policy.

Bank details use AES-256-GCM with a unique IV and member/destination-bound authenticated data. Account strings preserve leading zeroes. Full details are absent from normal API projections, ledger notices and general staff views. A payment claimant can reveal them through an audited action with current identity and recent authentication; the screen hides them after 30 seconds. A changed destination cannot rewrite an earlier request. Exact normalised-name matching is the fixture policy; mismatches are stored encrypted, flagged for review and blocked, without a staff override or assumed joint-account approval. Format checks do not establish account existence or ownership.

Recent authentication is derived from signed AMR claims **after** the existing Auth token verification. Token refresh/`iat` alone is insufficient. Fixture recent-auth duration is 15 minutes. Existing account admission/session checks and owner MFA remain. Production code does not accept an actor, approval, eligibility flag, conversion rate or unencrypted destination snapshot from the client.

Staff permissions are separately granted for identity review, request review and payment processing. Private staff notes are retained separately from customer-facing reasons. In-app account notices use the existing social notification table with generic titles and dedupe keys in the same transaction; no bank/evidence content is included and no email or push sending was added. Full customer history retains request, ledger and payment references.

## Activation gates — unresolved and intentionally closed

| Decision/setup | Current implementation / required action |
| --- | --- |
| Redeemable issuance and backing | Only synthetic local markers exist. Approve eligible issuance sources, cash backing/reconciliation, promotion exclusions, reversals and responsibility before any genuine issuance. Never mark historical test credits eligible. |
| Marketplace proceeds/source policy | FIFO spending is preserved. Decide how genuine eligible value propagates through fees, sales, swaps, disputes and refunds. No automatic cash eligibility for seller proceeds. |
| Identity policy | Approve evidence requirements, legal/privacy notice, reviewer authority, matching/joint-account rules, validity/re-verification/revocation criteria and any verification required earlier than first redemption. No compliance claim is made. |
| Real-document security | Configure private encrypted storage, authorised short-lived upload/access, size/type/content validation, quarantine, malware scanning, restricted document reviewers, access audit, retention and verified deletion. Real uploads must stay disabled until all are operationally tested. No storage/scanner subscription was added. |
| Bank encryption | Provision a per-environment 32-byte key through approved secret management, with key versioning/rotation/recovery and audited staff access. The deterministic test key exists only in the fixture module; never use it outside fixtures. |
| Limits and fees | Approve commercial minimum/maximum and any future fees. Current fixture limits are null and there is no fee. A future fee must be separately disclosed without changing the conversion rate. |
| Staff payment operations | Approve review/payment assignments, whether separate people are mandatory, unique bank-reference conventions, claim/reconciliation/return evidence, escalation and bank-statement reconciliation. Staff pay externally; Docked never initiates EFT. |
| Calendar and target | Configure Sydney business calendar coverage, holidays, cutoff and dispatch time. Fixture default has no cutoff/dispatch time, so no invented due timestamp is shown. Calendar tests use explicit synthetic settings. The copy is an aim for dispatch within one business day after approval, not a guaranteed bank receipt time. |
| Authentication acceptance | New pages/routes use existing verified-session auth, but this task's HTTP tests use isolated fixture sessions. Full Supabase session/AMR/MFA integration for redemption needs a dedicated admitted QA deployment before activation. No live account test was performed. |
| Activation release | Current scope is hard-locked to local fixtures in code and database. Setting a production flag alone cannot activate it. A separately reviewed issuance/security configuration and code/migration release is required. |

## Local database setup and migration

Migration: `supabase/migrations/20261015055109_manual_credit_redemption.sql` (created with the existing Supabase CLI). It adds a default-disabled staff permission table with RLS and revokes member/public/service-role access. It adds a guard preventing nonlocal activation, retroactive lot eligibility edits, or changes to saved request amount/rate/destination/source parts/member/policy/time. It makes no grants of credits, balance updates or modifications to prior requests.

Run the supported isolated PostgreSQL harness:

```text
node scripts/fantasy-production-local-postgres.mjs --redemption
```

It uses the already installed pinned PostgreSQL 17.10 runtime, a fresh `docked_redemption_local_<timestamp>` database on loopback, random credentials kept out of output, separate connections, and stops the server afterward. The new migration is applied only there. No Docker or hosted workaround is needed.

For integrating the actual Next routes into an existing **local** QA Auth/database setup, use its existing least-privilege runtime, admission, verified sessions and social profiles, apply the reviewed migration locally, and explicitly configure matching staff grants in the permission table and fixture program. `DOCKED_REDEMPTION_LOCAL=true` requires a loopback local database and refuses production/VERCEL environments. `DOCKED_REDEMPTION_BANK_KEY` must be a private base64 32-byte local key. Do not place keys in source, browser configuration or logs. Do not seed fixture data into hosting.

Rollback: turn off the local feature/remove navigation if necessary, while preserving all journals, history, requests and encryption keys needed for receipts. Do not restore an older aggregate over completed transactions or delete a reservation to release it. Resolve reservations through audited lifecycle commands. The new trigger/function and staff table may be removed only after confirming no manual-redemption records depend on them; otherwise retain the additive schema. No hosted rollback was needed.

## Verification evidence and limits

- `focused-tests.txt`: 17 focused arithmetic, eligibility, identity/auth, encryption, privacy, lifecycle, replay, historical-policy and calendar tests passed.
- `final-wallet-regressions.txt`: 43 final wallet/redemption/auth tests passed after the last ledger/reporting changes. PostgreSQL relational journal balances also reconcile exactly with the wallet aggregate.
- `platform-tests.txt`: 361 platform regression tests passed. Later focused tests cover the final redemption changes.
- `database-tests.txt`: 151 tests passed; one test process (`preview-auth-gate.test.ts`) crashed on Windows with exit 3221225477. `database-auth-retry.txt` retains the isolated rerun: both tests passed. The original failure is not relabelled as a clean full-suite run.
- `postgres.json`: nine acceptance groups passed using actual separate PostgreSQL connections, including duplicate submission, over-redemption, competing staff claims, cancellation/claim race, finalisation/return idempotency, injected transaction rollback, immutable snapshots/classification, real marketplace spending race and notification deduplication. One HTTP → fixture-session → actual PostgreSQL journey verifies reservation/retry/receipt/privacy. It is **not** Supabase authentication acceptance.
- `browser.json`: five browser acceptance groups passed using the actual components and local HTTP/domain adapter, covering desktop/mobile, review confirmation, invalid input retention, staff processing, private notes, account switching, response loss/recovery, Escape/focus, reduced motion and enlarged text. This browser preview uses in-memory state and fixture sessions, separately from the PostgreSQL evidence.
- `typecheck.txt`, `lint.txt`, `build.txt`, `client-boundary.txt`: repository checks; the clean build uses synthetic credential canaries, including the new bank-key canary, and performs no deployment.
- Raw secret scan still reports the same nine existing repository finding paths. `secret-scan-raw.json` preserves FAIL; `secret-review.json` distinguishes prior fixture/generated matches and the untouched untracked APK capability. No scanner suppression/exclusions were introduced, and no matched value was printed. The modified local PostgreSQL runner still interpolates a freshly generated local password, not a stored credential.

No physical S24, real identity-provider/storage/scanning workflow, actual bank payment, production Auth redemption journey or hosted transactional acceptance is claimed. The full-page screenshots are responsive browser evidence, not device evidence.

## Changed components

- Shared ledger extension and state machine: `src/core/credits-sandbox.ts`, `redemption.ts`, `redemption-money.ts`, `redemption-view.ts`; recent-auth data in `commerce-sandbox.ts`, `auth-policy.ts` and server auth.
- Server transaction/vault/API/notifications: `credits-sandbox-store.ts`, `redemption-adapter.ts`, `redemption-vault.ts`, `redemption-notifications.ts`, `redemptions.ts`, `/api/redemptions`; existing notification read filter extended narrowly to redemption account notices.
- UI: `withdrawals.tsx`, `redemption.css`, Profile/Admin route pages, both Profile navigation entry points and root stylesheet import. Existing Docked logo/components are reused.
- Migration, isolated fixture/browser/PostgreSQL runners, focused tests, build canary and evidence under `docs/qa/redemption`.

The pre-existing `docs/qa/nfl-member/migration-test.json` change and unrelated untracked artifacts were left alone. No commit, push, deployment, APK build or hosted migration is part of this review delivery.

**Decision: ready for local product/code review; not approved or configured for live cash redemption.**
