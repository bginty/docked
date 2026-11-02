# Prepared Google Play support request — not sent

Subject: Both active AU one-time purchase options return NO_ELIGIBLE_OFFER to licence tester

Application: Docked, package `docked.fantasy`. Internal testing build 30 (1.29), installed through Google Play on Samsung SM-S921B. No public release yet. Google Play Store version observed: 53.8.11-34 [0] [PR] 1005778592.

On 2 November 2026, the two one-time products `docked_credits_4900_v1` and `docked_credits_9900_v1` each had purchase option `buy-au` ACTIVE, AU AVAILABLE, AUD49 and AUD99 respectively. Android Publisher API confirmed this at 09:44:34 UTC. No other region is enabled; multi-quantity is off.

The phone used the approved licence-test account and a selected Australian Play country/profile. Console licence response was RESPOND_NORMALLY. Installed product identifiers exactly match. BillingClient connection succeeded. Product query returned `UnfetchedProduct` for each identifier with `statusCode=4 (NO_ELIGIBLE_OFFER)`, including at 09:48:13 UTC after clearing only Play Store cache. No purchase sheet was launched and no payment method was used. Queries of owned purchases returned no outstanding receipt.

Please identify the unmet purchase-option eligibility condition or propagation problem for this internal-test application/account. Are there additional eligibility constraints attached to these one-time `buy-au` options that are not represented by ACTIVE / AU AVAILABLE in Console and Publisher API?

Both options were deactivated after the supervised diagnostic at 09:50 UTC; inactive now is deliberate and should not be mistaken for their tested state. A further short no-charge licence-test window can be arranged once the relevant correction is identified. Do not enable public charges or submit our release as a troubleshooting step.

Attachments available: redacted active/inactive Publisher API evidence, relevant product IDs and filtered BillingClient diagnostic. No passwords, access tokens, signing credentials or purchase tokens should be attached. If Google requires the licence-test account email, supply it directly through authenticated Play Console support with the owner's permission; it is omitted from this public repository record.

Owner action, if needed: Play Console → Help and support → contact support for in-app product availability; paste the above and attach `qa/v30-customer-billing-20261102/google-active-readback.json`. This draft was prepared only; no support message has been sent.
