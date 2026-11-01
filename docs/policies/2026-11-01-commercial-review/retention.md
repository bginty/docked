# Retention and deletion approval schedule

**Operator publication draft, not an activated cleanup policy. Updated 2 November 2026.**

The company's financial-record baseline is at least seven years under [ASIC's published guidance](https://www.asic.gov.au/for-business-and-companies/companies/company-building-blocks/company-record-keeping). The accountant must confirm the applicable start date and exceptions for each record class. This is not authority to retain all personal data or raw purchase references for seven years. [OAIC APP 11 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) requires destruction/de-identification when no permitted purpose remains, subject to legal retention exceptions where applicable.

| Category | Required basis and trigger | Implementation / decision still required |
|---|---|---|
| Account/profile/session | Service and security; confirmed deletion or termination | Existing erasure workflow and isolated real-Auth acceptance passed. Approve public shared-identity handling and restoration runbook. |
| Encrypted Google token and account binding | Verification, refund and dispute needs; purchase/refund/dispute closure | Approve finite period and legal holds; restrict decryption to billing runtime; retire keys/references only after justified recovery window. |
| Monetary and credit ledger | Company financial-record obligations; accountant-confirmed reporting/transaction trigger | Minimum seven-year financial record baseline, with longer specific lawful holds. Keep necessary order amount, tax/reporting and journal evidence; remove unnecessary identity linkage under the approved minimisation process. |
| Card serial/ownership history | Permanent supply integrity and transaction disputes | Preserve minimal serial/provenance; approve pseudonymisation and access review. Do not erase legitimate ownership to satisfy a counter. |
| Notification jobs and observations | Reconciliation, incident evidence; completion or attention resolution | Approve operational retention and deletion/archive job. No raw notification tokens or personal details are stored in the queue. |
| Support/recovery notes | Remedy, appeal and security purpose; case closure | Approved finite period, legal holds, reviewer access and minimisation. Do not put ID documents or secrets into reasons. |
| Consent/moderation records | Demonstrating applicable consent and enforcing permitted safety decisions | Preserve necessary evidence through erasure, with approved scope and retention trigger. |
| Backups/provider logs | Recovery and provider obligations; backup creation/expiry | Verify actual provider schedules and locations. Reapply deletion/holds before restored data is exposed. |

Owner approval must specify the period or deterministic decision rule, reviewer, archival store, access controls and restoration procedure for each row. The billing ledger rejects ordinary UPDATE/DELETE of audit and journal history. That integrity guard is not a legal basis for perpetual retention: an approved archival/minimisation procedure is a release prerequisite.

No destructive Production cleanup or key destruction is authorised by this draft. The public privacy notice must accurately explain any still-linkable retained identifier as pseudonymous, not anonymous.

## Concrete approval and implementation package

Preserve existing beta targets: routine support records 12 months after closure, routine operational logs 30 days and security diagnostics 90 days absent a recorded incident hold. Additional proposed limits for privacy/operations approval, not statutory claims: completed notification transport metadata 90 days after successful reconciliation; expired acceptance fixtures and their credentials 30 days after sign-off. Keep the minimal financial/audit event where required rather than retaining duplicate request payloads. Unresolved jobs and active cases must not be deleted by age alone.

Encrypted Google purchase references need a provider/dispute-window decision; do not guess one from the seven-year financial rule. Keep the currently required references encrypted and purpose-restricted while resolving that finite window before commercial activation. The deletion job must use an approved policy version, dry-run counts, per-category hold checks, a reversible archive where required, an audit receipt and a tested restore/deletion replay. It must never drop the ledger, remove another customer's ownership, or destroy keys still needed for active reconciliation.

The present public release is blocked on that approval plus the matching archival/minimisation job. No existing accepted policy or retention period has been silently changed.
