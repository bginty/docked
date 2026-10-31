# Google Play USB billing lab

This is an internal, supervised acceptance tool, not public payment activation. NBA and normal Docked payment gates remain disabled. The test ledger is a new disposable local PostgreSQL database with a synthetic member; it cannot credit a customer wallet. The normal app and server do not import the lab route handler.

## Build and run

1. Use the existing protected verifier credential and signing configuration. Never put either in source, Android assets, logs or screenshots.
2. Set `JAVA_HOME` to the Android Studio JDK 21 and run `node scripts/google-play-lab-prepare.mjs`. This creates a private loopback TLS key in the existing ACL-protected `.docked-secrets` directory and exports only its public certificate into the QA source set. It does not change system trust.
3. Set the existing `DOCKED_UPLOAD_*` environment variables from protected signing configuration. Run `node scripts/android-store-internal.mjs --billing-qa`. Do not promote this QA variant to public Production.
4. Run `node scripts/fantasy-production-local-postgres.mjs --google-play-lab`. It starts a fresh disposable database and a TLS server bound only to `127.0.0.1:48591`, expiring after one hour. Session recovery material is stored in the protected directory, not printed.
5. Use `adb reverse tcp:48591 tcp:48591` on the authorised USB device. Open **Docked Billing Test** using its launcher and enter the current protected pairing key into the masked field. Never share the key or persist it in Android storage.
6. Use the Google Play-managed copy of the internal release. A Google-generated sideloaded APK may require **Update from Play**; do not bypass this protection. Confirm the requested version in diagnostics if the Store still serves an older release.

## Required activation decision

Google requires published one-time products for license-test checkout. The two approved Australian purchase options are currently DRAFT: `docked_credits_4900_v1` (A$49/4,900 credits) and `docked_credits_9900_v1` (A$99/9,900 credits). Activating a product is not itself a license-tester-only restriction. Obtain the owner's specific temporary activation decision, retain all normal payment gates, and deactivate the options after the supervised session.

Internal-track membership alone does not prevent a real charge. The checkout must visibly show Google's test payment instrument and approved license-test account before confirming. Cancel immediately if a real payment instrument is shown. A subsequent server rejection cannot undo an accidental real charge.

## Acceptance sequence

- Pairing succeeds; synthetic balance and receipt count initially zero.
- Google returns the exact approved product, Australian price and account binding.
- Cancelled and declined checkouts grant nothing.
- Pending receipts grant nothing; approved completion settles the configured credit amount once.
- The server verifies Google's TEST marker, package/product, quantity, region, purchase state and obfuscated account binding. Tokens stay encrypted locally and never appear in UI or logs.
- Consumption happens only after local ledger commit, through the durable outbox, and re-verifies TEST immediately beforehand.
- Reconciliation/replayed callbacks do not duplicate credit.
- **Refund latest verified test receipt** obtains the order ID from Google's verified response, never client input, and uses revoke=true. Ledger reversal follows authoritative receipt reconciliation, not merely a successful refund POST.
- Refund/reconcile retries do not double reverse or resurrect a purchase.
- Confirm normal customer balances, hidden NBA and payment gates remain unchanged.

The local runner is intentionally session-scoped. Recovery metadata is protected, but automated crash/resume of a genuine Google session is not yet accepted. Preserve its database/encrypted references if a real test receipt is created; do not start a fresh session and assume the previous purchase has been reconciled. Public RTDN/production settlement, legal/store declarations and public release are separate work.

Stop the runner after acceptance and remove only the owned forwarding rule with `adb reverse --remove tcp:48591`. Do not uninstall the customer app, clear its data or delete customer records.

## Evidence on 31 October 2026

- QA release 24 / `1.23-billing-qa` built, signed, uploaded and made available on the existing internal track. No public release.
- 17 focused tests passed; full TypeScript check and changed-file ESLint passed.
- Real PostgreSQL tests passed for duplicate settlement, concurrent outbox delivery, refunds/out-of-order callbacks and transaction rollback. These use isolated fixtures, not genuine Google purchases.
- Loopback TLS probes passed: unauthorised 401, browser-origin 403, valid native pairing 200, empty local ledger.
- Google catalogue and voided-purchase read APIs returned 200; both options remain DRAFT and no refunds were returned. This does not establish successful receipt verification or refund mutation.
- Phone initially installed version 24 through USB, while Google Play's update request still selected version 23. Genuine checkout, settlement and refund remain pending until the Play-managed QA build and approved products are available.

Official references: [license testing](https://developer.android.com/google/play/billing/test), [published product requirement](https://support.google.com/googleplay/android-developer/answer/6062777), [verified purchase fields](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2), [order refunds](https://developers.google.com/android-publisher/api-ref/rest/v3/orders/refund).
