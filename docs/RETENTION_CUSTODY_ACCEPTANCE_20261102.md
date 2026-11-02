# Retention operations: remaining activation decisions

Verified 2 November 2026. Published v2 policy wording is approved; cleanup execution is separately gated. This record does not enable cleanup or claim a legal review.

## Observed Production state

`billing_retention.policy` is disabled, version `operational-retention-2026-11-02-v1`, with 90-day completed-job and 30-day encrypted-archive settings. Authority and expiry are null. There are zero archives, active holds and overdue holds. `docked_retention_worker` is NOLOGIN, not superuser, and cannot bypass RLS. No archive key has been provisioned to this production worker. Evidence: `qa/v30-customer-billing-20261102/production-before.json` and the prior 12-scenario PostgreSQL acceptance.

The existing migration-backup key directory ACL grants access only to the current Windows operator account. That is evidence of local access restriction, **not** independently held recovery custody. The 07:27 UTC migration backup was decrypted and restored successfully in the isolated rehearsal; its 545 durable-table fingerprints were preserved. This is not evidence of a scheduled off-site recovery programme or a provider-wide backup retention period.

## Schedule and legal basis

| Records | Period / decision | Enforcement |
|---|---|---|
| Company purchase, credit, pack, sales, commission and refund accounting | At least seven years for covered company financial records. Retain longer for an applicable hold/obligation. | No deletion permission in the retention worker. Preserve journal/receipt exports and readability. [ASIC company records](https://www.asic.gov.au/for-business-and-companies/companies/company-building-blocks/company-record-keeping). |
| Completed notification operational metadata | Proposed 90 days after successful completion, then 30-day encrypted recovery archive; both require operational approval. | Excludes unresolved jobs, recovery cases, holds and leased work. Bounded transactions and replay tombstones. |
| Token references, replay tombstones, necessary identity links | Finite retirement event remains undecided; do not treat the financial minimum as a universal token period. | No automatic deletion. Record provider/dispute closeout, replay risk and lawful continuing need before retiring references. |
| Profile/contact/content following verified account closure | Existing 30-day handling target, subject to necessary retained records and closed rounds/disputes. | Account closure and Auth erasure workflow already tested; preserve suppression/deletion requests during backup restoration. |
| Support and operational/security logs | Published operational targets: 12 months after support closure; 30 days routine logs; 90 days security logs. | Microsoft, Vercel and Supabase actual settings/backup copies still need recorded verification. They are not asserted to meet those targets. |

[OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) supports necessity-based destruction/de-identification, subject to applicable exceptions. It does not supply a universal 90-day period. No unknown provider backup or legal period has been invented.

## Custody, access and restoration controls

Before activation, nominate the accountable privacy/support operator and a separate recovery custodian. Generate a dedicated 32-byte archive key, version it, store the runtime copy as a restricted server secret, and store the recovery copy separately from database backups and the working laptop. Do not reuse Auth, Google, wallet or migration-backup keys. Record access permissions and a witnessed recovery check. No recurring paid service has been commissioned.

Archive encryption uses AES-256-GCM, a fresh nonce, job-bound authenticated context, digest and key version. Rotation must retain old keys for archives still retained or held. Key loss is not a deletion policy. No browser/general-support role can access the archive; any operator decryption must use a recorded incident/support case and be audited without copying the payload into logs. The existing raw decoder is an internal library, not a customer endpoint.

Legal holds are explicit all/job/receipt/member records with case reference and review date. They serialize with cleanup. An overdue review never releases the hold. Only an authorised operator may release it after documented resolution; no production holds were created or removed in this work.

Restoration is to an isolated destination first. Verify hashes and key availability; replay deletion/suppression records before reopening customer access. Do not restore stale wallet/card snapshots over newer transactions, reset completed jobs, or repeat Google fulfilment. Restore archived operational metadata only under a documented recovery case; keep terminal financial states and audit history.

## Monitoring and approval checklist

Run an authenticated dry-run first with apply disabled. Monitor eligible jobs/archives, overdue holds, worker errors, missing key versions and archive authentication failures. The existing worker caps a run at 100 records and transactionally rolls back a failed archive/minimisation. Alert the nominated operator on failures and overdue holds; routine payloads and keys must never enter alerts. Schedule only after owner approval, using existing infrastructure.

Owner decisions required: approve the 90+30-day operational schedule; name runtime/recovery custodians; approve the backup/recovery retention and access record; settle the provider/dispute-based reference-retirement rule with the relevant accountant/privacy adviser. Published wording, migration approval and commercial-model approval do not themselves authorise irreversible cleanup.
