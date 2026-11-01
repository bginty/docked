# Retention and deletion approval schedule

**Operator draft, not an implemented cleanup policy. No period below is invented.**

| Category | Required basis and trigger | Implementation / decision still required |
|---|---|---|
| Account/profile/session | Service and security; confirmed deletion or termination | Existing erasure workflow and isolated real-Auth acceptance passed. Approve public shared-identity handling and restoration runbook. |
| Encrypted Google token and account binding | Verification, refund and dispute needs; purchase/refund/dispute closure | Approve finite period and legal holds; restrict decryption to billing runtime; retire keys/references only after justified recovery window. |
| Monetary and credit ledger | Applicable financial/tax/dispute obligations; transaction/end of relevant reporting period | Accountant/legal adviser to specify basis and period. Separate audit retention from indefinite account identity retention. |
| Card serial/ownership history | Permanent supply integrity and transaction disputes | Preserve minimal serial/provenance; approve pseudonymisation and access review. Do not erase legitimate ownership to satisfy a counter. |
| Notification jobs and observations | Reconciliation, incident evidence; completion or attention resolution | Approve operational retention and deletion/archive job. No raw notification tokens or personal details are stored in the queue. |
| Support/recovery notes | Remedy, appeal and security purpose; case closure | Approved finite period, legal holds, reviewer access and minimisation. Do not put ID documents or secrets into reasons. |
| Consent/moderation records | Demonstrating applicable consent and enforcing permitted safety decisions | Preserve necessary evidence through erasure, with approved scope and retention trigger. |
| Backups/provider logs | Recovery and provider obligations; backup creation/expiry | Verify actual provider schedules and locations. Reapply deletion/holds before restored data is exposed. |

Owner approval must specify the period or deterministic decision rule, reviewer, archival store, access controls and restoration procedure for each row. The billing ledger rejects ordinary UPDATE/DELETE of audit and journal history. That integrity guard is not a legal basis for perpetual retention: an approved archival/minimisation procedure is a release prerequisite.

No destructive Production cleanup or key destruction is authorised by this draft. The public privacy notice must accurately explain any still-linkable retained identifier as pseudonymous, not anonymous.
