# Google TEST notifications — deployed infrastructure and acceptance

Updated 1 November 2026. The owner approved the scoped notification IAM grants. No further IAM approval is required for the configuration below. Purchases, public registration, withdrawals, prizes and NBA remain disabled.

## Applied Google configuration

- Project: `docked-play-verification` (1007288339937).
- Topic: `projects/docked-play-verification/topics/docked-google-test-notifications`.
- Google's `google-play-developer-notifications@system.gserviceaccount.com` has Publisher on that topic only.
- Keyless delivery identity: `docked-play-rtdn-push@docked-play-verification.iam.gserviceaccount.com`. No keys or project-level application/financial permissions.
- Pub/Sub service agent `service-1007288339937@gcp-sa-pubsub.iam.gserviceaccount.com` has **Service Account OpenID Connect Identity Token Creator** on that identity only. The narrower OIDC permission is sufficient; general Token Creator was not granted.
- Authenticated subscription: `projects/docked-play-verification/subscriptions/docked-google-test-notifications-push`.
- Endpoint and exact OIDC audience: `https://docked.com.au/api/store/google/notifications`.
- Wrapped payload; 60-second acknowledgement deadline; exponential retry 10–600 seconds; one-day unacknowledged retention; no acknowledged retention/export/dead-letter service. Temporary subscription expires after 31 inactive days; review this before an enduring commercial service.
- Play Console uses that topic with subscriptions, voided purchases and all one-time-product notifications. This does not activate products or payments.

## Genuine delivery evidence

At **2026-11-01T07:09:20.087Z**, a test notification sent by Google Play Console reached the deployed HTTPS handler, passed Google signature/issuer/audience/verified-service-identity/subscription/package validation, and persisted in the private database queue. The queue row is `test`, `done`, without any purchase token. Acknowledgement follows durable insertion.

Evidence: `qa/customer-billing-20261101/genuine-google-notification.json`, `google-play-rtdn-saved.png`, `google-publisher-applied.png`, `google-push-identity-applied.png`, `google-push-subscription.png`.

**This proves authentic Google push delivery, not an actual purchase refund.** There are zero ordinary-member receipts and zero new-purchase admissions. Previous genuine isolated Google TEST refund evidence remains separate; it used a paired synthetic subject rather than the ordinary member session.

Wallet revision **226**, document hash **5f6b1926b820cb90f68d9a6a01ab5d5e**, and the nine existing database schedules are unchanged. No customer purchase, opening, balance adjustment, prize or permanent card issuance was performed.

## Durable scheduling on existing hosting

Use the existing **Vercel Pro** application, with one five-minute job: `/api/store/google/scheduled`, `*/5 * * * *`. No new host or paid subscription was introduced. Normal existing-plan function/Pub/Sub usage limits still apply; this is not a claim of unlimited free usage.

The server's `CRON_SECRET` is also stored as a sensitive Production project variable for Vercel's scheduler. It is not in Git, browser assets or a database HTTP queue. Runtime receipt/binding keys are retained securely and must not be rotated without a migration for existing receipts.

Initial hosted verification caught two configuration differences from a direct worker call: the scheduler needs its project-level secret, and Vercel's protected deployment invocation carries `_vercel_jwt`. The dedicated scheduler tolerates only this hosting cookie while still requiring the independent constant-time-checked bearer secret. Member cookies, Origin, forwarded authorization and incorrect methods remain denied. The ordinary POST worker and Google push boundary are unchanged. Safe rejection diagnostics record only header-presence booleans, never values.

The original Supabase pg_net proposal was not used. Inspection found its existing HTTP request queue readable through inherited PUBLIC grants, so inserting the new secret there would have exposed it. No existing ACL or job was changed. That pre-existing queue permission requires separate infrastructure hardening review; this new worker keeps its secret outside it.

The bounded worker schedules at most 100 known receipts, claims two verification jobs and one consumption job, with durable leases/retries/operator-attention state. Only previously account-bound **Google TEST** receipts may change the isolated member test ledger. A notification is a refresh hint, never a credit instruction. Unknown receipts cannot select an account. Logs expose pending/working/attention/overdue counters without identities or tokens. Attention counters are recorded as errors in existing Vercel logs; external alert delivery has not been verified.

The natural five-minute schedule executed successfully at **2026-11-01T07:30:09.812Z**, independently of the earlier manual trigger. All pending/working/attention/overdue counters were zero. Evidence: `qa/customer-billing-20261101/rtdn-scheduled-execution.txt`. This verifies automatic execution, not a completed financial reconciliation; there are no ordinary-member receipts to process yet.

## Database and recovery

All three separately approved migrations are applied: `20261031123611_free_core_gameplay_eligibility.sql`, `20261031123931_member_google_test_receipts.sql`, `20261031234304_google_test_reconciliation_queue.sql`. The queue migration was applied at 06:15:48 UTC with exact source/hash comparison and twelve unchanged protected fingerprints. No additional migration was needed for notification activation.

The encrypted targeted backup covers the affected tables/function definitions; it is not a complete Auth/storage disaster-recovery backup. Raw migration DDL must not be blindly replayed; use the reviewed version/source ledger checks.

To suspend the new runtime, return to `dpl_FpXCzRPTNYFtK7DVTj5dAXW3PiYp` (5a62f4ee), which has no Google cron/new-purchase activation. Preserve encrypted keys, queue, receipt and audit records. Do not restore an old wallet over later customer activity. Disable push temporarily if necessary while retaining recoverable messages. No financial-record deletion is a rollback step.

## Remaining acceptance

Android **28 / 1.27-member-test** is available to the existing internal testers. It uses normal Docked authentication and a separate native product allowlist from the authoritative approved package configuration; no paired synthetic subject, custom lab CA or public activation. Server new-purchase admission and both Play products remain disabled. The v27 AAB is preserved byte-for-byte.

An authorised store-installed licence tester must still complete ordinary-session checkout, actual wallet fulfilment, pack reveal, duplicate handling, delayed approval and refunds before/after spending, including observation of a real order's RTDN event. No connected device/emulator is available. The former v27 device checks were not repeated. Public submission and real-money fulfilment remain NO-GO.

References: [Google RTDN](https://developer.android.com/google/play/billing/getting-ready#configure-rtdn), [authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [Vercel Cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
