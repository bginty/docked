# Store operations and incident procedure — 5 November 2026

Prepared for the existing services; no new paid service, payment activation, retention cleanup, support email or customer mutation occurred. Existing owner/admin MFA remains required. Assign named operational and recovery owners before commercial activation; this runbook does not create staff permissions.

## Support and refund handling

1. Receive a case at `support@docked.com.au`. Ask for the Docked account identifier and provider order reference through the normal private support channel. Never ask for passwords, MFA codes, raw purchase tokens, payment-card details or ID attachments. Do not include private records in public issue trackers.
2. Read the authenticated owner billing report and the provider order. Confirm provider, TEST/commercial environment, account binding, product, current provider state, receipt event, wallet fulfilment and pack entitlements. A screenshot alone does not authorise a credit. Keep the case reference, operator and evidence timestamps.
3. A missing fulfilment is reconciled through the existing verifier/idempotent worker, not a second purchase or manual wallet edit. Pending/declined purchases never imply settled credits. Check the durable job and lease before retrying; do not reset deduplication records.
4. Provider-approved refunds/revocations are verified server-side. Before spending, remove eligible credited value once. After spending, retain the immutable ledger and use the existing recovery hold. Do not confiscate unrelated customers' cards, replay an opened pack, double-charge a customer or make a bank debit.
5. Explain the specific held amount and affected spending restriction privately, offer support review, and preserve applicable Australian consumer remedies. An opened pack is not automatically excluded from a lawful remedy. A hold is not a new debt-collection authority. Release/adjustment requires an authorised, audited recovery action; preserve the original purchase/refund events.
6. Escalate disputed ownership, account replay, refund reversal, unsupported provider evidence or inconsistent balances. Freeze only the affected payment admission if necessary. Do not delete the original record or extend a hold to unrelated wallets.

Google case **4-5905000041947** concerns offer eligibility, not a failed customer charge. Both current products remain inactive. Preserve the submitted evidence and await a specific correction; no repeated activation/cache/device cycles while the cause is unknown.

## Financial reconciliation

Reuse the existing `CommercialLedger.financialReport` and MFA-protected `/admin/commercial-billing`. Do not build a parallel accounting ledger. Before activation and after an incident/reconciliation run, record:

- Provider/environment and reporting interval; verified gross credit fulfilment, refunds/revocations, outstanding credits, recovery holds and queue states.
- Order-to-receipt-to-wallet linkage, duplicate/replay rejections, pending/leased/attention jobs and oldest unprocessed item. No raw tokens in exports.
- Credit sale fees, pack purchase/issuance linkage and serial ownership separately from store credit purchases. No rewriting historical commission.
- Google/Apple settlement reports, taxes and fees as a separate finance review. The current report explicitly says provider payout is **not reconciled** and leaves fee/revenue amounts unavailable. Do not label gross credit transactions as cash revenue or invent provider settlement totals.

Read-only Production snapshot `qa/dual-store-20261105/production-operations.json`: commercial receipt/lot/outstanding/recovery counts were zero, with no negative commercial balance. This is a census, not a new real-payment acceptance or a claim that all historical beta wallets are zero. Production was not mutated.

## Monitoring and escalation

The nine existing scheduled jobs reported successful database invocations in the inspected preceding 24 hours. This does **not** prove downstream HTTP, email, ingestion reconciliation or alert delivery. No Vercel log drain was configured. Existing server logs/queue health remain available; no new crash SDK or paid monitoring was installed.

Before public launch, name the primary/on-call substitute and verify an alert delivery drill with an authorised test recipient. Use existing tools to alert on billing queue backlog/attention, authenticated verification failures, negative-balance invariant failures, authentication/mail failures and stale ingestion. Measure backend response status and actual downstream outcomes; do not monitor secrets or document payloads. No test support notification was sent in this task.

Operational response:

1. Capture release ID, route, timestamp and sanitised error/queue reference. Classify auth, payment, ownership, data-feed or outage scope.
2. Disable the narrow affected admission gate if approved/necessary; keep the read-only ledger and reconciliation evidence. Stop new commercial purchases before investigating incorrect settlement; do not assume hiding a button stops server purchases.
3. Preserve completed receipt/pack IDs. A worker crash is recovered through lease expiry and idempotent retry, not reissuance. Failed statistics remain awaiting data, not confirmed zero.
4. For a code regression, promote the verified compatible rollback deployment after checking current database compatibility. Current Production is `da24e69d`; recorded prior `f0eb28e7` lacks the native login refresh fix, so treat that regression explicitly. Never roll back by deleting paid receipts, ownership or historical migrations.
5. Validate the affected path read-only first; use isolated mutations for acceptance. Record remediation, remaining restrictions and next review. Do not announce resolution from a passing build alone.

## Retention and custody

Existing approved dormant schema remains applied. Retention is disabled; archives count zero. No new worker credential, archive key, schedule or irreversible cleanup was activated.

Keep the category-specific rules in [retention operations](COMMERCIAL_RETENTION_OPERATIONS_20261102.md): covered company financial records at least seven years; proposed completed-job minimisation after 90 days and encrypted archive expiry after 30 additional days; account deletion and support/security targets as documented. Seven years is not a universal licence to retain every personal field. Unresolved provider copies/purchase-reference retirement require explicit treatment.

Activation checklist:

- Owner approves the category schedule and names operational custodian plus independent recovery custodian.
- Provision a dedicated versioned 32-byte archive key in approved server secrets, with a separate encrypted recovery copy. Record key ID, custody and recovery proof, never key material in Git/reports. Do not reuse Supabase/service-role/purchase binding secrets.
- Document Vercel/Supabase/mailbox backup and log retention from actual account settings. Current provider backup expiry and independent key recovery were not verified here.
- Rehearse decrypt/restore in isolation and record audit. A restore must preserve deletion suppression, legal holds, completed receipt IDs and deduplication tombstones; it must not requeue paid fulfilment or reopen erased accounts.
- Use the already tested least-privilege retention role and bounded dry-run first. Review legal holds, unreconciled refunds and expiry. A passed hold review date does not release a hold.
- Enable apply/cleanup only after recorded operational approval. Stop by setting apply off, then service off; retain schema/audit/archives. Do not issue destructive cleanup as a rollback.

Published policies remain the approved v2: `/privacy`, `/refund-policy`, `/commercial-policy`, `/retention`, `/account-deletion`. The present Google-focused wording was not expanded to claim active Apple processing. Apple production data flows and any material policy changes require review before an Apple release.
