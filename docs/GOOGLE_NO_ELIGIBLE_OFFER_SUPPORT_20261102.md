# Prepared Google Play support request — not sent

Subject: Both active AU one-time purchase options return NO_ELIGIBLE_OFFER to licence tester

Application: Docked, package `docked.fantasy`. Internal testing build 30 (1.29), installed through Google Play on Samsung SM-S921B. No public release yet. Google Play Store version observed: 53.8.11-34 [0] [PR] 1005778592.

On 2 November 2026, the two one-time products `docked_credits_4900_v1` and `docked_credits_9900_v1` each had purchase option `buy-au` ACTIVE, AU AVAILABLE, AUD49 and AUD99 respectively. Android Publisher API confirmed this at 09:44:34 UTC. No other region is enabled; multi-quantity is off.

The phone used the approved licence-test account and a selected Australian Play country/profile. Console licence response was RESPOND_NORMALLY. Installed product identifiers exactly match. BillingClient connection succeeded. Product query returned `UnfetchedProduct` for each identifier with `statusCode=4 (NO_ELIGIBLE_OFFER)`, including at 09:48:13 UTC after clearing only Play Store cache. No purchase sheet was launched and no payment method was used. Queries of owned purchases returned no outstanding receipt.

Please identify the unmet purchase-option eligibility condition or propagation problem for this internal-test application/account. Are there additional eligibility constraints attached to these one-time `buy-au` options that are not represented by ACTIVE / AU AVAILABLE in Console and Publisher API?

Both options were deactivated after the supervised diagnostic at 09:50 UTC; inactive now is deliberate and should not be mistaken for their tested state. A further short no-charge licence-test window can be arranged once the relevant correction is identified. Do not enable public charges or submit our release as a troubleshooting step.

Additional verified eligibility checks on 2 November:

- Publisher API readback confirms both products belong to `docked.fantasy`; neither is a DRAFT. Each has one `buy-au` option, `legacyCompatible: true`, AU AVAILABLE, no restricted payment-country list, no rental configuration and no multi-quantity purchase. Both remain deliberately INACTIVE after the diagnostic window. The separate offers-list endpoints returned HTTP 204 with no body; no discount/preorder eligibility metadata was supplied. Exact timestamps and HTTP statuses are in `qa/google-eligibility-20261102/catalogue-readback.json`.
- Console release 8 is **Available to internal testers**, version 30 (1.29), released 2 November at 00:26 Sydney. The authorised licence-test account also belongs to the selected internal-test email list. The production draft awaiting review does not prevent this already released internal track being available.
- The actual installed APK copied from the Samsung has versionCode 30, versionName 1.29, package `docked.fantasy`, BILLING permission, Billing Library **9.1.0**, both exact product IDs, `queryProductDetailsAsync` and `getOneTimePurchaseOfferDetailsList`. Its verified signing-certificate SHA-256 matches Google's generated release. APK SHA-256: `56ee0d2de9be5aa4978d393a1b0258a007c4a391e956b4604c91b20b26c2600f`.
- The native query still uses INAPP and the same product/offer query as the previously accepted member-test build. The v30 native change chooses the commercial product allowlist and exposes that capability; it does not replace the query with the legacy SKU API. No rebuild is justified by the evidence so far.
- Console's activity log explicitly shows the 4,900-credit option becoming Active at **19:55 Sydney**. The failed query at 20:48 therefore was not an immediate post-activation request. This does not prove all of Google's serving caches had propagated.
- Publishing overview has no approved changes waiting to publish and still has ten changes not submitted. Managed publishing remains ON. No hidden ready-to-publish product release was found.

Google returns only the broad no-eligible-offer result, not the exact failed eligibility predicate. The next differentiating check is the same licence account in official **Play Billing Lab**, with Australia selected temporarily and real payment methods OFF, followed by one controlled active-option query. This tests Google's billing-country eligibility independently of the Store profile display. A successful override would narrow the failure to account/region eligibility; continued failure with verified active options requires Google's serving-side investigation. Do not label either hypothesis an established root cause.

The Samsung is not connected during these additional checks. The existing Play-enabled emulator boots but has no Google accounts, so it cannot substitute for an authenticated licence tester without owner sign-in. No test checkout was attempted, and the emulator was shut down without wiping its data. No product activation, purchase, refund, database migration or Production deployment occurred in this continuation.

References: [Google status-code definition](https://developer.android.com/reference/com/android/billingclient/api/UnfetchedProduct.StatusCode), [one-time offer eligibility and legacy compatibility](https://developer.android.com/google/play/billing/one-time-product-multi-purchase-options-offers), [official Billing Lab and licence-testing instructions](https://developer.android.com/google/play/billing/test).

Attachments available: redacted active/inactive Publisher API evidence, relevant product IDs and filtered BillingClient diagnostic. No passwords, access tokens, signing credentials or purchase tokens should be attached. If Google requires the licence-test account email, supply it directly through authenticated Play Console support with the owner's permission; it is omitted from this public repository record.

Owner action, if needed: Play Console → Help and support → contact support for in-app product availability; paste the above and attach `qa/v30-customer-billing-20261102/google-active-readback.json`. This draft was prepared only; no support message has been sent.
