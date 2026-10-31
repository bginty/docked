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
6. **Product contents pending owner confirmation:** the launch brief requests A$49/A$99 credit packages and A$1 = 100 credits, while older source contains single-card products at those prices. Proposed 4,900/9,900-credit allocations without bonuses were asked about, not assumed or activated.

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
