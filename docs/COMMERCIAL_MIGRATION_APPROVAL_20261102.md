# Commercial billing migration and activation review

Prepared 2 November 2026 (Australia/Sydney). **No Production migration or commercial activation is authorised by this document.** The live invitation-only service remains unchanged.

## Exact proposed migrations

| Migration | Effect | Defaults / preservation |
|---|---|---|
| `20261101120754_commercial_google_ledger.sql` | Private monetary/credit ledger, verified receipts, encrypted references, funding lots, refund holds, durable jobs, permanent supply/pack/ownership records, independently gated credit sales and audit. NOLOGIN restricted runtime role. | Sales, issuance and transfers false; products unapproved; no customers, definitions, cards, jobs or credentials seeded. No TEST balance conversion or legacy table writes. |
| `20261102010000_commercial_lineup_inventory.sql` | Dormant owned-inventory adapter for the existing lineup validator/read projection; shared reservation protection; authenticated private Profile counts. | Gameplay false. Only **new** explicitly opted-in competitions can use it. Existing rules/snapshots are immutable and unchanged. Free Core remains eligibility, not issuance. NBA excluded. |

Production read-only check at **2026-11-01 13:14:57 UTC**: commercial schema absent; both migration IDs absent. Neither has been applied to Production. Migrations were applied in disposable local databases; reapplication of the ledger and adapter was exercised. The runtime role cannot approve products, change activation gates, edit definitions' identity/supply cap, delete audits or access beta wallets.

The two narrow private SECURITY DEFINER locking functions let the runtime obtain shared locks on configuration without granting UPDATE/activation privilege. All other application transactions retain ordinary RLS and restricted-role checks. Member and owner routes authenticate before returning records; anonymous roles cannot execute the private functions or read the schema.

## Application and native compatibility

Three independent server flags default closed: `DOCKED_COMMERCIAL_SERVICE`, `DOCKED_COMMERCIAL_SURFACES`, `DOCKED_COMMERCIAL_CHECKOUT`. The deployed adapter always expects commercial receipts; a client cannot choose acceptance mode. Existing Google TEST endpoints and beta wallet remain separate. No commercial secret is public configuration.

Android v29/1.28 continues to run the current private beta with payments disabled. The prepared v30/1.29 adds an explicit native commercial capability and the two approved product identifiers; it still needs a matching authenticated server session and current product availability. Native product visibility is not authority to fulfil a purchase. Do not use v30's preparation as evidence of real-money settlement or physical-device acceptance.

## Approval-gated rollout

1. Confirm exact source commit and hashes, current Production migration history and supported PostgreSQL version. Check migrations in a restored isolated copy with the actual restricted runtime role.
2. Before any Production application, capture an encrypted schema/data backup, current function definitions/grants, release configuration and protected-record checksums. Verify restore to an isolated target. **A fresh Production restore drill has not been performed in this task; it is a pre-apply gate.** Do not rely solely on an old QA snapshot or assume a provider backup is restorable.
3. Apply these two exact migrations, in order, in transactions using the approved migration mechanism. Do not run a blanket push of unrelated pending migrations. Recheck all gates false and zero new member/card/credit rows; compare protected records.
4. Provision an approved non-superuser, non-BYPASSRLS login inheriting only `docked_commercial_app`. No role login/password is created by the migrations. Store its TLS connection URL server-side as `DOCKED_COMMERCIAL_DATABASE_URL`; preserve existing app roles.
5. Provision a reviewed Google verifier identity with only the required Docked purchase/order/consumption permissions. Configure `DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL` and `DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY` in secret storage. Do not copy secrets into build files or client bundles.
6. Provision stable HMAC account binding (`DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET`) and AES-GCM reference keyring (`DOCKED_COMMERCIAL_REFERENCE_KEYS`, JSON key-id to 32-byte hex key; `DOCKED_COMMERCIAL_REFERENCE_KEY_ID` active id). Retain old decrypt keys until the approved retention window closes. Test restore/rotation without logging keys. TEST binding/keys are not reused.
7. Route authenticated Google notifications to `/api/store/google/commercial/notifications` with a dedicated exact audience, service account and subscription. Run `/api/store/google/commercial/reconcile` with the separate worker secret and existing approved scheduler. The persistent worker re-verifies Google, handles leases/retries, polls known receipts after outages and exposes overdue/attention counts. **No new scheduler, IAM grant or Google notification route was activated here.** Maintain the existing TEST route while its receipts still need reconciliation; do not silently replace it.
8. Approve the commercial policy version `commercial-closed-loop-2026-11-01-v1` and evidenced owner/legal/Google/privacy/retention/refund-recovery/player-rights/supply-reconciliation references with a finite review date. This is an operator-reviewed configuration, not an owner-panel shortcut around approvals.
9. Reconcile every licensed player's permanent definition and lifetime serial baseline against all existing issuance. Definitions start empty. `legacy_issued` is an explicitly audited baseline, never a guessed reset or second supply pool. No schema script fabricates players or commercial rights.
10. Configure approved current AU adult eligibility and consent versions. Only an 18+ policy is implemented; a higher age threshold cannot be satisfied by the existing 18+ attestation. Keep public registration closed until the separate onboarding approval and public-mode hosted acceptance.
11. For gameplay, create approved future **free/no-prize** rounds with saved `commercial_inventory_policy='commercial-owned-v1'` and `free_core_policy='public-free-core-v1'`, verified roster/fixtures and the existing sport rules. Do not mutate historical/confirmed rounds. Opt-in and `gameplay_enabled` are distinct from sales/prizes. Free Core eligibility remains available during a payment recovery hold; owned paid cards cannot be newly selected while held. Historical locked entitlement remains intact.
12. Conduct authenticated acceptance of that exact protected configuration before enabling commercial checkout/products. Recheck order price/AU identity, fulfilment, acknowledgement, pack opening, ownership/lineup/summary, refund/revocation and worker recovery. Keep commercial transfers off for the recommended launch unless separately reviewed. Beta coupons and social ownership adapters do not automatically gain commercial eligibility.
13. Publish approved policy versions, update actual Console declarations/listing/screenshots, obtain final owner approval, and only then consider Australian public submission/activation. No cash features, prizes, paid entry or NBA activation is part of this package.

## Reconciliation and support

Google notifications are hints, not credits. The server fetches the current purchase and order, checks package/product, account binding, quantity, environment, AU region and exact approved AUD price. Credit fulfilment and a durable consumption job commit atomically. Pending/cancelled purchases receive no credits. TEST receipts are rejected by commercial runtime.

Full verified refunds remove only unused credits from that receipt. Spent/refunded funding creates a hold and auditable exposure; spendable balances cannot go negative. Partial refunds and price discrepancies require review. Completed opening receipts and other members' acquired cards are preserved. The owner/MFA review screen can waive an eligible completed-refund hold with a reason and expected revision; it cannot send money, manufacture credits, activate products, approve its own case or erase the audit.

Gross charges/refunds, outstanding credits, recovery exposure and job health are available. Provider fees, payout reconciliation and recognised revenue are **not fabricated**; an approved accountant/provider-settlement reconciliation process remains required. No real settlement has been tested.

## Rollback and recovery

The staged application has no live alias. Discarding the candidate leaves the current live deployment intact. For a future approved deployment, first disable checkout/sales/issuance/transfers and keep read access and refund reconciliation available. Roll back the application alias to the captured release. Do not drop the commercial schema after a receipt exists; retain encrypted references, journals, issued serials and retry state. Do not restore an older wallet snapshot over newer purchases.

The gameplay adapter is reversible by disabling `gameplay_enabled` and stopping new opt-ins; locked snapshots are not rewritten. An already-entered round requires explicit operational review before changing eligibility. Restore saved wrapper definitions only under a reviewed migration, with no concurrent saves/transfers. No destructive down migration or production cleanup is supplied as an automatic command.

## Remaining release checks

- Fresh approved backup/restore evidence; Production migration/runtime/worker configuration and genuine hosted commercial acceptance.
- Rights and supply-baseline reconciliation for commercial permanent cards.
- Public access programme/region/consent configuration and its hosted journey; no automatic promotion of beta grants.
- Commercial social sharing/coupon eligibility and full marketplace UI are deliberately not activated; keep them off unless their adapters and commercial scope are separately verified.
- Approved retention/minimisation job and provider settlement reporting; the current immutable ledger is not a legal basis for indefinite retention.
- Physical Play-installed v30 acceptance when a suitable device is available; existing v29 TEST evidence remains valid within its original scope.
