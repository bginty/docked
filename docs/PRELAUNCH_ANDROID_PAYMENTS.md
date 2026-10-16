# Android and payments pre-launch review

Reviewed 16 October 2026 against repository code and official provider guidance. This prepares review; it is not payment activation, store approval or physical-device acceptance.

## Confirmed implementation

| Area | Evidence and limitation |
| --- | --- |
| Native shell | Capacitor 8; `au.com.docked.app`; target/compile API36, minimum API24; Gradle versionCode22/versionName1.21. Beta/Preview/closedTest append `.preview`. |
| Signing | Beta/Preview use the existing debug certificate for sideload upgrades. Non-debuggable is not Play-signed. closedTest requires a separate owner upload key; ordinary release remains blocked. Console package ownership and Play App Signing are unverified. |
| Security | HTTPS only, mixed content and backups disabled, inspection off except local development. Permissions are Internet, network state and vibration. FileProvider is non-exported; shared image cache/Pictures access remains scoped by URI grants. |
| Navigation | Custom scheme is allowlisted; auth callback requires PKCE. Verified HTTPS App Links are not configured. Back dispatches cancellation to the top shared modal before navigation. Offline/resume revalidates sessions rather than interpreting transport failure as logout. |
| PayPal links | Two blocked live Hosted Button mappings exist: expected AUD49/one RARE card and AUD99/one ELITE card. These older single-card products are not the nine-card beta Premium pack. Actual provider prices, quantity settings, availability and merchant permission are unverified. |
| PayPal server | Sandbox-only Orders create/capture, webhook signature checks, amount/currency/order matching and merchant/reference-bound authenticated readback exist. No live switch was introduced. |
| Wallet | The existing aggregate/journal includes payment provenance, cumulative refunds and compensating entries. This is not proof of an operational provider refund/dispute pipeline. |
| Play purchases | No BillingClient dependency, native billing bridge, purchase-token verification, RTDN ingestion or Voided Purchases reconciliation exists. Console billing configuration alone does not implement these. |

No hosted settings, credentials, signing keys, cash transactions or member assets changed.

## Local fixes

1. **Native resource leak:** NativeBridge saved listener cleanup handles only after all parallel registrations succeeded. One rejected registration orphaned successful registrations. `nativeListenerScope` owns each resolved handle, removes late handles after unmount and isolates teardown errors. Connection/launch awaits now recheck mount lifetime. This is a confirmed lifecycle defect, not a claim to have reproduced every Samsung scrolling report.
2. **Provider amount rounding:** PayPal divided ledger cents by 100 using floating-point formatting. Large valid safe integers could change a cent. `paypalAmount` now uses integer quotient/remainder. Invalid expected amounts/order IDs fail before transport. Sandbox requests reject redirects to keep credentials and requests on the fixed provider origin.
3. The Google Play readiness entry point now describes fantasy/collectibles rather than retired betting research. Historical evidence is not used as a current approval.

## Current payment options

Google normally requires Play Billing for in-app digital purchases, subject to programme exceptions. Random-item purchase odds must be disclosed close to purchase. A PayPal WebView button is not itself an exception. [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)

Australia's **Billing Choice programme**, available from 30 September 2026, covers mobile/tablet apps and games. It requires enrolment, Play Billing alongside the alternative, programme APIs, appropriate choice UI, support/refunds and reporting within 24 hours. External links need Console preferences and compliant destinations. Fees still apply and vary by cohort/programme; older non-game-only pilot assumptions are outdated. Docked's enrolment remains unverified. [Current requirements and fees](https://support.google.com/googleplay/android-developer/answer/17161464?hl=en-GB)

| Option | Experience/complexity | Operational implications | Recommendation |
| --- | --- | --- | --- |
| A: Play Billing Android + permitted PayPal web | Familiar native purchase UI; two adapters | Provider-specific fees, verified receipts, duplicate prevention and refund reconciliation. Transferability/refund-after-spend needs approved policy. | Evaluate after commercial product classification; not implemented end-to-end. |
| B: Approved Australian Billing Choice | Extra choice and regional/programme integration | Google fees can apply alongside PSP fees; more reporting, support and reconciliation. No assumed saving. | Possible route; requires actual enrolment and implementation, not merely a PayPal link. |
| C: Free beta credits | Existing gameplay without checkout | No cash receipts from this flow. Keep beta-credit controls, privacy and test labels. | Recommended current mode until commercial rights, policies and payment integration are resolved. |

Paid cards, chance-based packs, competitions, transferability and future redemption require review as a complete product. Store billing does not establish real-money contest approval; some gambling categories cannot use Play Billing. This report does not classify Docked as gambling or exempt. [Real-money games/contests policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)

Confirm the proposed funds flow with PayPal under its approval-dependent categories; supplied button identifiers do not establish permission. [PayPal AU Acceptable Use Policy](https://www.paypal.com/au/legalhub/paypal/acceptableuse-full)

## Implementation contract before paid testing

Use the existing wallet/journal, provider receipt adapters and transactional inbox/outbox, not a second balance. Server-approved product IDs, credit classifications and price versions must remain authoritative. Payment alone must not imply redeemability.

For Play, bind purchase tokens to package, product, quantity and obfuscated Docked account identity via authenticated Developer API readback. Only PURCHASED can fulfil. Atomically record the unique token and ledger issuance; retry returns that result. Consume after committed fulfilment through a retryable outbox. Pending/rejected/refunded/voided remain distinct. Do not trust client callbacks or deduplicate only by order ID. Reconcile notifications against API readback and recover missed events. [Google purchase security](https://developer.android.com/google/play/billing/security)

For PayPal, extend the sandbox order binding/readback after products are approved. Add authenticated refund/dispute adapters and durable reconciliation. Browser success redirects cannot grant credits. Unknown outcomes stay pending until reconciled. Do not invent asset confiscation, negative-balance or credit-transfer policy.

Required fixtures: pending-to-purchased, duplicate token/event, cross-account receipt, wrong package/product/merchant/currency, quantity mismatch, lost response, crash between fulfilment and acknowledgement, concurrent retries, partial/cumulative refund, refund after spend/transfer, voided purchase and provider outage. Use isolated ledgers and sandbox/licence testers only.

## Pre-submission checklist

- Confirm long-term package ID, Console ownership and app-signing/upload certificates. Plan the sideload-to-Play signing boundary; do not submit the debug key.
- Refresh the authorised hosted receipt, run `npm run android:closed-test:check`, then the gated bundle build. Audit final AAB assets for secrets, validate signature, generate test APKs and inspect native libraries. No AAB was built/uploaded here.
- API36 matches current new-app/update requirements; recheck at submission. [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- Choose a supported billing library if billing is approved; v7's ordinary deadline was August2026, v8's is August2027. No stale dependency was installed. [Billing version deadlines](https://developer.android.com/google/play/billing/deprecation-faq)
- Validate 16KB compatibility on actual bundle/native dependencies and an appropriate image; targetSdk alone is insufficient. [Page-size guidance](https://developer.android.com/guide/practices/page-sizes)
- Provide reviewer app-access instructions compatible with invitation controls/MFA; do not create shared owner credentials or disable production gates.
- Complete truthful Data safety from actual SDK/data flows, public privacy policy, retention explanations, in-app and external account-deletion paths. Test deletion and necessary ledger retention; do not assert completion based on a link existing. [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- Verify terms acceptance, report/block, moderation response/appeals and support staffing for social UGC; the existing community rules draft is not an adopted policy. [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- Complete content rating, target audience, ads declarations, random-pack disclosures and commercial sports-data/artwork rights. Use genuine current screenshots and no payout claims.
- Confirm applicable Console testing requirements rather than assuming three beta members satisfy every account's production-access gate. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- On physical S24 test Chrome, Samsung Internet and installed shell: login/owner MFA, Back, repeated modals, large text, keyboard, rotation, offline/restart/resume, account switching and any future payment recovery. Browser emulation does not pass physical acceptance.
- Obtain separate approval for real payments, redemption, identity collection and settlement; no build result activates these features.

## Store listing draft — owner review only

**App name:** Docked

**Short description:** Collect player cards, build fantasy lineups and connect with collectors.

**Description:** Docked brings player-card collecting, fantasy team building and a collector community together. Browse your collection, open available packs, build eligible lineups, follow competition results and share cards with other members. Access and supported competitions depend on the current beta configuration. Private beta credits have no cash value. Real-money purchases, withdrawals and live card-trading settlement are not available in this beta.

This is not submitted copy. Confirm live sport/competition availability, support contact, access rules, content rating, data rights and current screenshots before using it. Do not advertise unimplemented billing, prizes, injuries/live scores, public signup or executable trading.

## Checks performed

- Focused Android/commerce/PayPal/native lifecycle run: **26/26 passed**.
- Additional native-navigation, offline and credits-accounting run: **22/22 passed**. These use isolated fixtures; they do not demonstrate live provider processing.
- Closed-test preflight: **blocked as intended**, because `config/android-preview.json` lacks a current verified deployment manifest. This did not reach upload-key verification or produce a bundle.
- `adb devices` could not start/connect to the ADB daemon in this execution environment. No device was inspected and no APK was installed.
- No actual PayPal purchase, Google Console acceptance, physical S24 test, Samsung Internet test or signed AAB acceptance is claimed.
