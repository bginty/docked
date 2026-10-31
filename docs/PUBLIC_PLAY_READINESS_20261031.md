# Public Google Play and credit-package readiness — 31 October 2026

Status: internal testing remains available. Public release and real-money billing are not activated. NBA remains hidden. This report records work performed after the owner's public-release/payment request; it does not certify legal clearance.

## Console work actually completed

- Saved declarations: no ads, not a government app, no health features. These changes are saved for review, not submitted as a public release.
- Dashboard verified **4 of 11** initial tasks complete; Production **Inactive**; app still a draft with its temporary unreviewed name.
- Existing internal version 23 (`1.22-internal`) is unchanged.
- One-time products catalogue inspected: no configured products. No price, product or purchase option was activated.
- Sign-in declaration requires a reviewer account. The incomplete form was discarded. Owner credentials were not disclosed and MFA was not bypassed.
- Target audience setup is blocked by the incomplete sign-in declaration. Remaining dashboard tasks include privacy, sign-in details, content rating, audience, Data Safety, financial features and store listing.

Evidence: `qa/public-play-readiness-20261031/play-setup.jpg`.

## Implemented and locally tested

The existing isolated store verifier and settlement adapter now accept explicitly account-wide credit bundles. This uses the existing shared wallet rather than requiring a separate credit product per sport. Legacy sport-labelled products remain supported. Both forms still require an explicit server-approved product allocation. Conflicting scope/sport fields, invalid credit amounts, hidden-sport products and real purchases are rejected by the test verifier.

The PostgreSQL receipt inbox includes product scope in immutable receipt identity. Changing a receipt from an account product to a sport product cannot grant additional credits.

Executed validation:

- Seven focused verification, settlement and navigation tests passed.
- Typecheck passed; ESLint passed for changed source/tests and concurrency runner.
- Four isolated PostgreSQL scenarios passed: 20 concurrent duplicate receipts; changed-scope/cross-account replay rejection; acknowledgement failure and 12-worker retry; concurrent/refund-before-purchase protection; pending and injected transaction rollback/retry.
- Zero production database connections, provider requests or real purchases in those mutation tests.

Evidence: `billing-tests.txt`, `typecheck.txt`, `store-postgres.json` and `store-postgres.txt` in the evidence directory above. These are synthetic adapter/database tests, **not Google sandbox checkout acceptance**. No application deployment, database migration, wallet adjustment or registration change was performed for this work.

## Concrete public-launch blockers

1. **Published policies do not match the current app.** `/privacy` redirects to `/beta-policies#privacy`, version `2026-10-11-beta-rc3`. Its content describes a free NFL friends beta, free swaps and no rarity multipliers. Current visible functionality includes NFL/AFL/NRL, credit sales and rarity multipliers. The approved historical packet and existing consent records were not overwritten. Prepare a new version, reconcile it with actual processing/retention/rights and obtain appropriate review before changing the public policy URL or requesting consent.
2. **Reviewer access:** supply a dedicated ordinary member review account and a supported repeatable access method. Do not provide the owner/admin login or weaken account-wide security. The Console requires full review access and does not allow reviewers to create their own account. Current authentication requirements need an explicitly reviewed solution.
3. **Store declarations and native acceptance:** complete truthful Data Safety, rating, financial features, target audience, privacy and final listing. Validate the Play-distributed build on real Android devices, including session recovery and account deletion. Browser and local emulator results do not replace those checks.
4. **Commercial and policy classification:** establish rights for player/data/card use and review the actual credit, marketplace, competition/prize and possible withdrawal model. Ordinary digital credits generally use Play Billing; regulated gambling/daily-fantasy models have different eligibility and cannot simply be enabled through ordinary Billing.
5. **Billing implementation remains test-only:** no hosted live settlement endpoint, production Google verification credentials/notification reconciliation or real Google sandbox purchase/refund acceptance was established here. Complete and review server verification, account binding, durable settlement, acknowledgement/consumption, voided-purchase reconciliation and spent-credit refund policy before enabling real products. Native product allowlist and server billing gate remain disabled.
6. **Product contents resolved by owner follow-up:** A$49 = 4,900 credits and A$99 = 9,900 credits, with no bonus credits. This approval covers contents/prices, not payment activation. The versioned preparation catalogue is `config/store-credit-package-drafts.json`; runtime product allowlists remain empty.

## Order of remaining actions

1. Confirm credit contents and public commercial model. Keep paid features off while review proceeds.
2. Prepare a newly versioned, accurate policy packet and resolve rights/classification and account-deletion requirements.
3. Establish reviewer access securely; complete remaining Console declarations and listing using verified facts.
4. Create approved credit products/purchase options for Australia; configure secure provider credentials and authenticated notifications; keep the public payment gate off.
5. Finish hosted server integration and run real Google license-tester purchases, pending/cancelled flows, duplicate delivery, refunds, reconnect and reconciliation tests against isolated authorized test accounts. Record evidence without tokens or secrets.
6. Verify a final release candidate, including NBA exclusion, cross-account access and account-wide wallet integrity; submit the public release only after readiness is established and required agreements are handled by the owner. Public registration and payment activation are separate controlled steps.

## Official sources reviewed

- [Google Pay Android setup](https://developers.google.com/pay/api/android/guides/setup): directs digital-goods purchases to Google Play Billing.
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/10281818): digital goods, virtual currency and exceptions.
- [Real-money gambling, games and contests](https://support.google.com/googleplay/android-developer/answer/9877032): regulated-model restrictions; this document does not determine Docked's legal classification.
- [Billing security](https://developer.android.com/google/play/billing/security): backend verification and secure entitlement handling.
- [One-time products](https://support.google.com/googleplay/android-developer/answer/16430488): product and purchase-option configuration.

Google Pay on the website is a separate processor/merchant integration. No browser checkout was enabled or processor agreement accepted in this task.

## Owner confirmation follow-up

The two Google Play products were created as **Draft** purchase options (`buy-au`), restricted to Australia, with new countries/regions excluded:

| Product ID | Credits | Bonus | Australian price |
| --- | ---: | ---: | ---: |
| `docked_credits_4900_v1` | 4,900 | 0 | A$49.00 |
| `docked_credits_9900_v1` | 9,900 | 0 | A$99.00 |

Google's bulk-price tool initially changed 49.00 to 48.99; the individual Australian price was corrected to exactly 49.00 and saved before handover. The second price was entered directly as 99.00. No Activate control was used. Existing default tax classification was left unchanged and must be reviewed with the merchant/tax setup before activation; Console displaying "No VAT" is not Australian tax advice or a tax-readiness certification.

The package-config regression, hidden-sport/release-gate checks and existing verification/settlement tests passed: 8 tests, 0 failures. ESLint and typecheck passed. The regression verifies that approved draft products are still rejected by the empty runtime allowlist. Legacy single-card products, pack pricing, wallet balances and issuance rules are unchanged. No application deployment or migration is necessary to save these non-active drafts.

## License-testing and compliance continuation

The existing three-person Android tester group was not selected in Play Console's **License testing** settings. It is now selected and saved, with `RESPOND_NORMALLY` retained. Internal-track membership alone does not prevent real charges; genuine acceptance must use Google's explicitly labelled test payment instruments. No products were activated.

Created the dedicated Google Cloud project `docked-play-verification` (project number `1007288339937`). After explicit owner approval of the API terms, enabled the Google Play Android Developer API. After separate explicit approval of sensitive access, created `docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com` and granted Docked-only app access: view app information/quality, view financial data, and manage orders/subscriptions. No release, administrator, store-edit or account-wide permissions were selected. Console shows the service account Active.

The server credential was moved out of Downloads and the repository into a current-Windows-user-only ACL directory. No credential content is in this report, screenshots or source. Initial OAuth authentication succeeded (HTTP 200), but a read-only deliberately invalid-receipt probe returned Publisher API HTTP 401 / `permissionDenied`. This does **not** verify purchase access; propagation or access configuration still needs resolution. No real receipt, purchase, refund or wallet was touched by the probe.

A subsequent authenticated catalogue read succeeded (HTTP 200) and returned exactly the two approved products with `buy-au` options still **DRAFT**. The voided-purchases read still returned HTTP 401 / `permissionDenied`. The saved app permissions were re-opened and confirmed: both financial-data and order-management permissions are checked, release/admin/store-edit permissions are unchecked. Catalogue access is verified; purchase/refund API access is not. Evidence: `qa/public-play-readiness-20261031/google-api-readback.json`.

The connected device is a Samsung SM-S921B on Android 16. Initial package inspection found the sideloaded `au.com.docked.app.preview`, version 21 / `1.20-beta`, rather than the Play package `docked.fantasy`. Existing Preview data was preserved. Real Play purchase/refund acceptance remains pending. A locally downloaded official scrcpy release was checked against GitHub's release digest for USB mirroring; audio and automatic clipboard synchronisation were disabled.

The actual phone reached the Google Play internal app listing and offered Install. Installation was attempted and Google displayed “Can't download docked.fantasy (unreviewed)”. Read-only diagnostics show approximately 10 GB available storage, no installed `docked.fantasy`, and Finsky's failed version-23 installation status `1010`. That internal status is recorded as evidence, not assigned an unverified root cause. The older Preview package remains installed. Google Play Store cache-only troubleshooting was requested after the phone locked; no app data, accounts or existing installations were removed. `android-play-listing.png` shows the listing, not a successful install or the dismissed error dialog.

### Further code correction and local evidence

Google consumption now re-verifies the current receipt, account binding, approved product, test marker and purchased state before contacting the consume endpoint. Already-consumed purchases return successfully. A failed provider response is resolved only by authoritative consumed-state readback; otherwise it remains retryable. Real-payment, cancelled, pending, refunded and wrong-account receipts cannot reach consumption. OAuth, network and schema failures return redacted errors rather than leaking receipt material.

Executed 18 targeted tests: store verifier, settlement, approved product drafts, hidden-sport/release gates, native navigation, analytics consent and moderation actions. All passed. Changed-file ESLint and full TypeScript checks passed. Evidence: `qa/public-play-readiness-20261031/sandbox-hardening-tests.txt` and `sandbox-hardening-typecheck.txt`. These are isolated tests, not evidence of Google checkout or actual refund acceptance. No new deployment or migration was performed for this correction.

### Data Safety evidence matrix — review draft, not submitted

Google's form must include the embedded web application and connected services, not just native permissions. The source does not support a “no data collected” declaration.

| Processing | Source evidence | Declaration preparation / remaining verification |
| --- | --- | --- |
| Account email, member ID, profile and authentication | `src/app/api/member/route.ts`, `src/server/auth.ts` | Account management and security; confirm all public-profile fields and processors. Never disclose owner/MFA credentials to reviewers. |
| Country/state and adult/terms attestation | Member jurisdiction command in `src/app/api/member/route.ts` | User-provided jurisdiction, not a claim of GPS permission. Confirm final audience policy and applicable Data Safety category. |
| Posts, comments, images, shared cards and follow/block relationships | `src/server/community-social.ts`, `src/core/community-media.ts`, `src/components/native-image-picker.tsx` | User content/media and interactions. Distinguish optional public sharing from service-provider processing; verify final build visibility and moderation. |
| First-party usage events | `src/core/analytics.ts`, `src/server/analytics.ts` | Consent-gated analytics stored against member ID. Do not claim anonymous/no analytics merely because there is no advertising SDK. |
| Pack, marketplace and wallet history | Existing shared credit ledger and inventory services | Virtual purchase/transaction history exists even in the free test economy. Future paid-store history must be declared before activation. |
| Google test receipts/account binding | `src/server/store-purchase-verification.ts`, local-only `store-test-inbox.ts` | Prepared test-only integration. No hosted production receipt settlement established. Do not describe it as active public billing. |
| Identity documents | `src/core/manual-identity.ts`, `src/server/identity-documents.ts` | Synthetic-only workflow; real identity collection is not approved. Production policy/scanner/retention remain separate blockers. |
| Push subscription endpoints and keys | `src/app/api/notifications/push/route.ts` | Existing optional notification feature requires data inventory review. No push behaviour changed in this work. |
| Service/security logs, IP and device data | Hosting, authentication and email provider configuration | Runtime retention, regions, processor agreements and any derived location require provider evidence; absence of app log statements is not proof of no collection. |
| Export/deletion | `src/app/api/member/route.ts`, `src/server/account-deletion.ts`, `/account-deletion` | Export and disable-first erasure code exists; actual disposable-account hosted deletion and published retention exceptions still need acceptance. Never test deletion against customer accounts. |

### Required policy replacement, without rewriting historical consent

Prepare a new reviewed policy version covering the current NFL/AFL/NRL service, hidden NBA, card ownership and rarity multipliers, credit-sales-only marketplace, actual fee rules, random pack probabilities, account-wide credits and the disabled cash/withdrawal/prize conditions. The public privacy notice must identify the verified operator/support contact, purposes and categories above, processors/transfers, retention, deletion exceptions, privacy enquiries and complaints. Retention durations, data rights and legal classification cannot be invented from source code. Preserve `2026-10-11-beta-rc3` and all existing consent evidence; change the active policy pointer only after review and any required re-consent plan.

Remaining Google declarations must be completed against this evidence and final runtime behaviour: Data Safety, financial features, content rating, target audience, reviewer access and final listing. A dedicated ordinary-member review account is still required; do not expose an administrator session or bypass MFA. No public release, registration, paid product or financial feature was enabled here.

Current official references: [Google test purchases](https://developer.android.com/google/play/billing/test), [Data Safety including SDKs and embedded web flows](https://support.google.com/googleplay/android-developer/answer/10787469), [Google Play real-money games and contests](https://support.google.com/googleplay/android-developer/answer/9877032), [Android Publisher API setup](https://developers.google.com/android-publisher/getting_started). Review the actual paid-card/market/prize model against the relevant policy; ordinary Play Billing integration does not itself establish eligibility for regulated fantasy contests.

### Android download recovery and actual launch

The owner confirmed that clearing only Google Play Store cache did not resolve the download error. The approved Google account was enrolled as an internal tester, and the consumer listing reported device compatibility. No account was removed, no app data was cleared and the existing Preview installation was retained.

A read-only Publisher API diagnostic (`scripts/google-play-readiness.mjs`) retrieved the Google-generated version-23 universal APK. APK signature verification passed, and its signer matched Google's generated-artifact certificate. USB installation succeeded. Opening that sideloaded build correctly triggered Google's “Get this app from Play” protection. No protection was disabled or bypassed.

Following Google's Get app link exposed **Update from Play**. That operation completed successfully; the listing then showed **Open**. Android package diagnostics confirmed versionCode 23 / versionName 1.22-internal with both installerPackageName and initiatingPackageName equal to `com.android.vending`. Opening from Play reached Docked's actual login screen on the Samsung device. Thus Play-managed installation and unauthenticated launch are now verified on this device. Fresh installation on another tester's device, authenticated app acceptance, checkout and refunds remain unverified. The initial Play download failure's underlying cause is not established; the successful recovery must not be described as a general fresh-install fix.

Evidence: `android-play-protection.png`, `android-play-update-open.png`, `android-play-login.png`, `android-play-installed.txt`, and `google-readiness-latest.json` in the dated QA directory. NBA/payment gates remain unchanged; both paid products remain DRAFT. No purchase, refund, wallet mutation, public release, migration or application deployment was performed during recovery.

### Signed-in Android acceptance — 31 October 2026, 18:01–18:05 AEDT

The owner completed sign-in personally on version 23 / 1.22-internal. USB diagnostics confirmed the foreground package was `docked.fantasy`; this is actual authenticated installed-app acceptance, not desktop browser or emulator evidence.

Read-only checks completed on Samsung SM-S921B / Android 16:

- NFL Play loaded Week 7 with a nonblank 105.81-point Game Day total and 6/7 completion count. This verifies rendering, not an independent re-audit of the scoring calculation.
- Switching to AFL and NRL loaded each sport's Play screen. No lineup, draft or entry was saved. The existing selected test round still displays historical/provisional cap wording; no salary migration was attempted as part of store acceptance.
- NRL Cards displayed 8 owned cards; Profile displayed the same total with 8 Ultra Rare cards and 1 pack opened. AFL Cards displayed 24 owned cards. No inventory was granted or opened.
- NRL Packs loaded coupon, product and weekly starter-pack interfaces, including existing unopened entitlements. No purchase, coupon redemption or opening occurred.
- NRL Market loaded Browse / My Listings / Activity navigation and filters. No listing or settlement was changed.
- Social loaded Latest / Following / Announcements, composer and existing feed content without a sport selector. Nothing was posted or reacted to.
- Profile and Test Wallet loaded. The displayed account-wide test balance remained 35,200 throughout; this is UI evidence, not a new ledger reconciliation. Wallet clearly states no cash value / cannot be withdrawn.
- Customer sport selectors showed NFL / AFL / NRL, with NBA absent.

An unauthenticated request to `/api/mobile/capabilities` was denied with the authorised-sign-in error. Source configuration retains billing disabled, empty product allowlists and closed public registration. Eleven focused customer-sport, product-draft, verifier and settlement tests were executed again and passed. No checkout/refund provider mutations occurred in those tests.

The read-only Google diagnostic was repeated at 07:03:45 UTC (18:03:45 AEDT): catalogue HTTP 200, generated APK HTTP 200, and voided-purchase read **HTTP 200 with zero results**. Both approved products remain DRAFT. This supersedes the earlier 401 refund-query blocker; no permissions were expanded. Actual receipt verification, purchase consumption and refund acceptance still require a genuine controlled test purchase and an isolated test-capable build/backend. Public billing remains disabled.

Screenshots are saved as `android-signed-in-*.png` in the dated QA directory. These checks do not establish fresh installation on other devices, complete marketplace/pack transactions, account deletion, all deep links, full session recovery, or public-launch compliance. No application deployment or database migration occurred.

AFL Rankings also rendered its sport/mode/season/round controls. Android's system Back returned to AFL Play with the sport context intact. These are read-only route checks, not evidence of a completed scoring or awards cycle.

## USB Google checkout/refund preparation — internal version 24

Implemented a separate `storeBillingQa` native source set and authenticated loopback-TLS test service. It uses the existing Google test verifier and isolated PostgreSQL credit ledger. The normal app's purchase allowlist remains empty, hosted payments remain disabled and NBA remains hidden. No production database route exposes the test service. The verifier now supports explicit refunds only for freshly verified Google TEST receipts, with Google-derived order IDs and authoritative reconciliation before ledger reversal.

Built and uploaded `artifacts/android/Docked-billing-qa.aab`, version 24 / `1.23-billing-qa`, SHA-256 `9e4c54a162d6b83444ccd77ff15d52ee33d233dcfbd89bfbfe54667132e61577`. Google Console showed **Available to internal testers**, released 31 October at 18:32 AEDT. This is the existing three-person internal track, not a public release. Google reported no release errors; its warnings concerned missing deobfuscation/native-symbol files. No hosted application deployment or database migration occurred.

Executed: 17 focused tests, full TypeScript check, changed-file ESLint, signed Android build/lint, signing and bundle credential checks, and four real PostgreSQL concurrency scenarios. All passed. TLS probes confirmed unauthorised requests return 401, browser-origin requests return 403 and authorised native-shaped requests return 200 with zero receipts/credits. These probes are not phone checkout acceptance. Google's catalogue and refund-list APIs both returned HTTP 200; there were zero returned refunds and both credit options remained DRAFT.

Google's signed universal version 24 installed in place on the connected Samsung, preserving app data. Its Play protection then requested **Get this app from Play**. The official **Update from Play** action still scheduled version 23 (observed in Finsky diagnostics at 18:39 AEDT), so the Play-managed update had not completed. No protection was disabled, no account/app data cleared and no existing app uninstalled. Phone pairing and genuine version-24 checkout acceptance remain pending; the earlier version-23 signed-in acceptance above must not be represented as version-24 acceptance.

The owner was asked whether to temporarily activate only the two approved Australian purchase options for supervised license testing and deactivate them afterward. No activation has been performed. Google requires products to be published for license testing, but an active product is not inherently restricted to license testers; this is why activation is not inferred from an instruction to keep real-money payments disabled. No real or Google test purchase/refund occurred in this continuation and no customer balance changed.

See [USB billing lab runbook](GOOGLE_PLAY_USB_BILLING_LAB.md) for setup, test sequence, exact boundaries and recovery limitations. Genuine approved/declined/cancelled/pending checkout, verified consumption, refund readback, reversal and reconciliation still need execution. Public store compliance/reviewer-access requirements above remain outstanding; this internal release is not public-launch approval.
