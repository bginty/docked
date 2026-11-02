# Commercial retention — implementation and activation record

2 November 2026. Source: `20261102011703_commercial_retention_controls.sql`, `CommercialRetention`, and the authenticated `/api/internal/billing-retention` worker. New migration; not one of the three previously approved/applied Production migrations. No Production application or destructive cleanup is authorised by this document.

| Category | Trigger / period | Actual handling |
|---|---|---|
| Company financial journal, receipts and sale/pack accounting | At least seven years after covered transactions complete; longer for a recorded applicable obligation/hold | Preserve immutable journals and printable/exportable records. [ASIC](https://www.asic.gov.au/for-business-and-companies/companies/company-building-blocks/company-record-keeping), Corporations Act s286. No automatic seven-year deletion and no extension of this rule to unrelated personal data. |
| Completed commercial notification/retry jobs | 90 days after completion; no lease, unresolved recovery, related pending job or legal hold | New bounded worker encrypts the source row, clears receipt link/attempts/error/retry metadata, preserves completed job ID/type/timestamps and a deduplication tombstone. |
| Encrypted minimisation archive | 30 additional days from archive creation | AES-256-GCM with random nonce, key version, job-bound authenticated context and digest. Delete only after expiry and a fresh no-hold/no-recovery check. No expiry of legal holds simply because their review date passed. |
| Minimal notification IDs | While needed to reject provider replay and evidence processing | Tombstones retained; provider references are pseudonymous, not automatically anonymous. The final retirement rule needs the provider/replay and legal-window decision before erasure. |
| Purchase-token references | While required for verification, refunds, disputes and anti-replay | Encrypted, narrow access; new worker cannot read or delete them. Google requires token verification/deduplication but does not establish a universal seven-year token period. Document the final event-based erasure rule before enabling it. |
| Account/contact and eligible personal content | Existing target: within 30 days of verified closure; identity links after relevant rounds/disputes close | Existing account deletion revokes access first; Auth/content workers complete or retain pending evidence. Financial holds preserve only necessary linkages. Shared beta Auth erasure requires operator review. |
| Routine support / logs | Existing service targets: support 12 months after closure; routine logs 30 days; security logs 90 days | These are operational targets, not statutory periods or proof that Exchange/Vercel/Supabase backup policies implement them. Verify each provider setting and record exceptions. |
| Incident/dispute/legal hold | Until authorised resolution with documented review date | New private holds support all/job/receipt/member scope. Operators record case reference, reason, authority and review. Overdue holds remain active and are reported. |

[OAIC APP 11 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) requires consideration of destruction/de-identification when information is no longer needed, subject to applicable exceptions. Indefinite retention is not justified merely by card scarcity. Provider copies, legal obligations and linkability need explicit treatment.

## Controls tested

Twelve real PostgreSQL scenario groups: dormant/dry-run; stale policy; concurrent workers; encrypted archive and replay rejection; overdue holds; archive expiry; financial and encrypted receipt preservation; RLS/role denial; least-privilege worker execution; fault rollback; concurrent hold serialization; expiry/global-hold fail closed. Evidence: `qa/launch-resolution-20261102/retention-postgres.json`.

An archive failure rolls back minimisation and audit together. Workers and hold/policy mutations share a transaction-scoped advisory lock. No wallet, card, token, Auth, activation or audit-delete grants are given to the worker. Archive inspection does not requeue completed fulfilment or resurrect an opening.

## Activation / recovery sequence

1. Review and separately approve the new additive migration for the intended environment. Capture backup and source fingerprints. Apply once; policy is disabled and private RLS is enabled.
2. Create a restricted LOGIN member of `docked_retention_worker`, with no superuser/bypass-RLS/ownership privileges. Store its URL and a dedicated random 32-byte archive key in server-side secrets; protect recovery copies and key-version rotation. Do not reuse a client key.
3. Configure `DOCKED_RETENTION_SERVICE=true`, policy version `operational-retention-2026-11-02-v1`, worker secret and key ID. Keep `DOCKED_RETENTION_APPLY=false`; run authenticated dry-run and review the bounded candidate counts and overdue holds.
4. Only after approval record policy authority and expiry, set enabled, then set apply true. Use an existing scheduler if authorised; this change installs **no schedule** and incurs no new service.
5. Review each run's audit and errors without logging row payloads or secrets. At most 100 jobs/archives per run. On any issue set apply false, then service false. Retain migration/history and encrypted archives; do not drop schema as a rollback.
6. Restore archived metadata only through an operator-reviewed transaction if necessary; never change completed job state or replay Google fulfilment. Keep deletion suppression records when restoring backups. Record resumed pending deletion steps honestly.

Unresolved policy work is limited to the final purchase-reference/tombstone retirement event, exact provider/mailbox backup retention and legal exceptions. These do not prevent testing this dormant minimisation worker. They do prevent claiming all commercial retention operations are activated or complete.
