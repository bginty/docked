# Docked Google Play internal preparation — 31 October 2026

This is an internal-test candidate, not a public-launch approval. NFL, AFL and NRL are the customer-visible scope. NBA remains hidden; its underlying records and internal shared infrastructure are preserved. No Production database migration, wallet mutation, real purchase, prize award or public registration change was performed.

## Build and signing

- Existing Capacitor 8.5.2 implementation retained. Store application ID **`docked.fantasy`**, version code **23**, version name **1.22-internal**, compile/target API36, minimum API24. Google rejected the initial `au.com.docked.app` candidate because the existing Console app was already registered as `docked.fantasy`; the Store-only build was corrected to that authoritative identity. Legacy sideload variants retain `au.com.docked.app.preview`.
- `artifacts/android/Docked-store-internal.aab` and matching APK built successfully with JDK21 and Gradle 8.14.3. APK signature and AAB signature verified; self-signed upload certificates are expected for Play App Signing.
- Upload certificate SHA256: `be729f2e2cdbe7b582841b1e385e1b3fa9072036dc9dff984eae50fde9bd0173`. This is an upload key, not a verified Google distribution-signing certificate.
- Local upload keystore and Windows-ACL-protected credential file are in ignored `private-data/android-signing/`. Neither is committed or uploaded. Owner must keep a secure, independent backup. Do not replace this key after binding it to Play without Google's upload-key reset procedure.
- The native build loads `https://docked.com.au/app`. It is non-debuggable, disables cleartext/mixed content/backups and does not contain server credentials. Packaged text-asset checks are recorded in `docs/qa/store-release-20261031/native-security.json`; this is a scoped scan, not a penetration test.
- Existing `.preview` sideload installations are a different application ID. The first Store app installation is separate; do not promise it will upgrade the old Preview package in place. Server accounts and inventory remain shared after normal sign-in.
- Ordinary public `release` builds remain blocked. `storeInternal` is a distinct, signed internal-test target and does not set any public/financial approval flag.

Rebuild using JDK21/Android SDK36 and the existing `DOCKED_UPLOAD_KEYSTORE`, `DOCKED_UPLOAD_ALIAS`, `DOCKED_UPLOAD_STORE_PASSWORD`, `DOCKED_UPLOAD_KEY_PASSWORD` environment contract, then `node scripts/android-store-internal.mjs`. Do not put credentials on command lines or in Git. Run `python scripts/check-native-store.py` on the resulting APK. Increment versionCode for any subsequent uploaded binary; Google does not permit reusing a consumed version code.

## Engineering changes

- Central customer-sport boundary reused by workspace navigation and server beta/commerce checks. A legacy NBA control also underpins AFL/NRL admission; it was deliberately not disabled in the database. Customer NBA requests are denied separately in the candidate code.
- Native links accept only allowlisted routes and visible sports. Canonical Cards/Packs parameters are retained; duplicated/unknown parameters, NBA/NBL and arbitrary redirect targets are rejected. Existing authentication callbacks still require PKCE; HTTPS App Links remain a separate pending setup.
- Added authenticated, uncached `/api/mobile/capabilities` with only eligible visible sports and billing explicitly disabled. Native and web gameplay still use existing authentication, MFA and admission guards.
- Added Google Play Billing **9.1.0** native receipt transport, current-product/offer lookup, account binding, cancellation/pending responses and purchase reconciliation. Approved product lists are empty. There is no real-money purchase route.
- Google server adapter reads purchases from the fixed Android Publisher API, verifies package, approved product, quantity, AU region, test-purchase marker and authenticated account binding. Client-reported balances/prices do not grant credits.
- Apple server adapter uses Apple's maintained certificate/JWS verification library in Sandbox only. StoreKit2 scaffolding preserves unfinished transactions until server fulfilment succeeds. It is not a compiled or tested iOS release.
- Local PostgreSQL receipt inbox/outbox reuses Docked's existing wallet transaction, ledger and lock. Receipt references are AES-GCM encrypted. Terminal refunds survive out-of-order notifications, acknowledgement delivery is leased/retryable, and failure rolls back receipt and wallet changes atomically. `sandbox/store-billing.sql` is **local disposable-test schema, not a Production migration**. Its constructor refuses hosted databases.
- No live receipt HTTP endpoint, RTDN subscription, Voided Purchases job, Apple server-notification endpoint or production settlement deployment is activated. The tested adapter/harness is not evidence that actual store checkout is operational.

## Google Play Console

Existing company account and existing Docked app reused; no duplicate app or developer account created.

- Developer: Ginty United Investments Pty Ltd; publisher display Docked Fantasy.
- Developer ID `6139268121863991375`, app ID `4973145400906008303`.
- Internal track `4701080901813472104`; draft `1.22 (23) — internal preparation`.
- Owner, Barry and Luke tester list created and attached. Existing verified Docked addresses used for Barry/Luke. Owner explicitly substituted the signed-in Google account after Google rejected the Docked support address as not a Google account. Brenton is reserved for Apple testing.
- Internal testing access does not bypass Docked account confirmation, MFA or invitation admission. Tester selection is not an installation or sign-in acceptance result.
- Listing description saved with NFL/AFL/NRL only, invitation-only test-credit wording, no cash withdrawals/prizes or promised live play-by-play. Existing App classification retained; Sports category and public support email/website saved for review.
- No legal agreements accepted, payments profile activated, public release submitted or customer messages sent.

Google accepted bundle 23 (1.22-internal), target API36, into the saved internal draft. Review reports two warnings only: no deobfuscation mapping (minification is disabled) and no native debug-symbol archive for bundled third-party native libraries. Estimated new-install size is 7.82 MB. Icon and 1024×500 feature graphic were uploaded and saved with the listing. Phone screenshots and declarations remain incomplete. No internal rollout or public release was published. The internal opt-in URL is not usable until a release is actually rolled out.

## Store listing assets

Reused `public/brand/docked/icons/docked-icon-512.png` (512px) and `docs/qa/prelaunch-store-assets/feature-graphic-review.png` (1024×500). They use Docked's existing branding, no NBA or third-party logos. Authenticated responsive browser screenshots were captured as private QA evidence, not uploaded as native store screenshots. Release-matching Android screenshots remain required; do not use development fixture screenshots as actual customer screenshots.

Draft short description: **Collect cards, build fantasy teams and connect across NFL, AFL and NRL.**

## Data Safety / content declaration review packet

These are source-backed draft findings, not submitted declarations or legal certification.

| Data/function | Evidence and proposed declaration review |
| --- | --- |
| Account/email/user ID | Supabase Auth, profile and admission records. Collected for account management, authentication and fraud/security. Required for member functionality. MFA remains applicable. |
| Profile, posts/comments/reactions/follows | Existing shared social service, moderation/reporting/blocking and privacy controls. User-generated content is present; do not declare the app has no UGC. Public visibility is user/context dependent. |
| Images | Optional profile/social uploads through existing private/approved media controls. No contacts, SMS, precise location or microphone permission was added. Native Camera/Share plugins require actual selected-use review, not an assertion of blanket media access. |
| Activity analytics | `AnalyticsObserver` and `/api/analytics` send bounded first-party events only after explicit analytics consent; anonymous visitors are not identified by this code. Declare applicable app activity collection rather than claiming no analytics. |
| Transactions | Test credits, pack openings, marketplace and inventory records are stored. Real-money billing is disabled; future receipt, refund and financial-history collection requires updated declarations before activation. No payment-card data is collected by this candidate. |
| Security/diagnostics | Hosting/Auth logs and account/session/rate-limit controls require provider retention review. No new crash-reporting SDK was added. Play vitals/pre-launch results are not yet available. |
| Identity documents | Test-only synthetic verification policy remains in force. Do not collect or advertise production KYC readiness or claim that KYC makes purchases/withdrawals legally approved. |
| Deletion | Existing `/account-deletion` and authenticated account controls provide a request path; private-beta erasure must not blindly delete shared Auth identities. Actual production retention/backup/provider handling and legal exceptions remain review requirements. No live deletion was tested. |

Inspect the exact release's WebView content as well as the native SDK list when completing Data Safety. Supabase, Vercel, mail/media processing and any future Google/Apple receipt processing must be included in the processor inventory. “Service provider” sharing exceptions and linked-to-user classification require factual review. Do not choose “no data collected”.

Before public submission: approve the operator/privacy notice and retention policy; verify the published privacy/deletion URLs; complete IARC ratings honestly for UGC, random packs, purchases and fantasy mechanics; select an adult audience consistent with current AU18+ admission; confirm whether social child-safety declarations apply; supply a genuine authorised reviewer account/access instructions without disabling MFA. No rating or legally binding certification has been guessed or submitted.

## Commercial and policy gates

1. Obtain written classification for paid credits, chance-based card packs, transferable marketplace inventory, competitions and potential prizes under Australian law and both stores' policies. Free entry alone does not establish an exemption. Commercial player/card and statistics rights remain separate requirements.
2. Approve credit products with exact store IDs, credit allocations, AUD prices, GST treatment, refund-after-spend policy and territorial eligibility. Old AUD49/AUD99 single-card mappings are not approved credit bundles. No products or allocations have been invented.
3. Google digital goods generally require Play Billing unless an enrolled exception applies. Existing PayPal web checkout is not itself such an exception. Australian Billing Choice requires actual eligibility/enrolment and additional implementation; none is assumed. Google Billing must not be used for prohibited real-money gambling payments.
4. Random-pack odds, scarcity, exhaustion behaviour and test/paid distinctions must be accurately disclosed before purchase. Preserve the existing rarity supply and odds configuration.
5. Reviewer-authorised service credentials, RTDN/PubSub audience/identity checks, encrypted receipt retention, durable production inbox/outbox, provider refund/voided-purchase reconciliation and alert ownership must be configured and tested before any store product is enabled. Do not send tokens or private keys in chat.
6. Internal testers and **license testers** are separate Google settings. Test-track membership alone does not make purchases free. Keep all product lists empty until approved sandbox products and license-test accounts are configured and actual test-card purchase/refund/decline/restart scenarios pass.
7. Australia-only public availability, paid products, public registration and public submission remain off pending explicit owner approval. A saved draft is not policy approval.

Sources reviewed: [Google Payments](https://support.google.com/googleplay/android-developer/answer/10281818), [real-money games/contests](https://support.google.com/googleplay/android-developer/answer/9877032), [Billing integration](https://developer.android.com/google/play/billing/integrate), [Billing security](https://developer.android.com/google/play/billing/security), [license testing](https://developer.android.com/google/play/billing/test), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), [target API](https://developer.android.com/google/play/requirements/target-sdk), [Apple review rules](https://developer.apple.com/app-store/review/guidelines/), [Apple submission SDK requirements](https://developer.apple.com/news/upcoming-requirements/), [ACMA online gambling](https://www.acma.gov.au/online-gambling-services). These sources identify review obligations; they do not grant Docked permission to launch paid fantasy features.

## iOS continuation

Capacitor iOS 8.5.2 SPM scaffold generated and synced; supplied Docked icon/splash and custom-scheme declarations prepared. StoreKit2 and Apple Sandbox verification scaffolding exist. macOS/Xcode26, company Apple Developer membership, signing/provisioning, App Store Connect app access, privacy manifest aggregation, actual iPhone/simulator acceptance and TestFlight remain required. No IPA/archive or TestFlight upload was produced on Windows. Do not substitute Android evidence for iOS testing.

For iOS sync set `DOCKED_STORE_INTERNAL=true` and `DOCKED_STORE_PLATFORM=ios`, then run `npx cap sync ios`. This preserves the scaffold's `au.com.docked.app` bundle ID, pending confirmation in App Store Connect. Android's build script explicitly sets platform `android` and uses the existing Play Console package `docked.fantasy`.

## Credit-product economics pending commercial configuration

The owner's brief explicitly references A$49/A$99 credit packages and approves A$1 = 100 Docked Credits. At that conversion the base allocations are 4,900 and 9,900 credits; these are arithmetic, not newly activated products. Repository `src/core/pack-products.ts` instead maps those prices to legacy single-card products, and `credits-policy.ts` marks its bonus policy as example/sandbox-only. Do not migrate those legacy products into paid store credits automatically. Confirm bonus amounts and exact product IDs before creating the store catalogue.

For a gross price G, net proceeds must use the store's actual contractual commission base/rate, remitted tax and adjustments. GST-inclusive tax, if applicable, is G/11; it is not assumed here. Commission enrolment, tax treatment and refund-after-spend exposure are unverified, so no invented net-margin figure is reported. Current credit pack prices remain 100/300/700 Standard and 700/1,900/5,000 Premium; existing seller commission remains 5%, capped at 2,000 credits. Revenue or profitability cannot be inferred from virtual-credit face value alone.

## Verification and release limits

Evidence is in `docs/qa/store-release-20261031`: 636 platform tests, 223 database tests, eight focused store tests and four real-PostgreSQL receipt/outbox concurrency scenarios passed. Typecheck, lint, optimized web build, signed Android build and packaged-asset checks passed; runtime dependency audit reported zero vulnerabilities. Provider calls were mocked in settlement tests: no actual Play purchase/refund was performed.

After the owner signed in normally, read-only Production browser acceptance verified NFL Week 7 (105.81 points, 6/7 completed, rank 1 of 2), AFL collection (24 owned cards: 20 Ultra Rare, four Legendary), AFL/NRL six-product pack browsing, NRL marketplace, global Social, Profile and test-wallet navigation. Only NFL/AFL/NRL appeared in selectors. Responsive mobile inspection used a 390×844 browser viewport; this is not native-device acceptance. No purchases, openings, posts, team submissions or account mutations were performed. AFL's existing saved draft reported no-longer-owned selections; it was left untouched and is not a passed team-entry test.

The corrected `docked.fantasy` APK installed successfully on API36 and its MainActivity was resumed; the crash buffer was empty at inspection. Earlier emulator startup attempts encountered a System UI hang. No native signed-in, physical-device, Play-distributed update, actual store purchase/refund or iOS acceptance is claimed. These remain release acceptance requirements.

Production remained on `60a1a3ee966e9782cae7478b44340a3193fc3253` with publicRegistration false. This preparation does not deploy the candidate server visibility patch. Before internal rollout, deploy/review that compatible patch through Docked's existing release process and verify hidden-sport endpoints and member flows against the hosted release. No new Production migration is required by the visibility patch. Keep the current Vercel deployment available for rollback; never restore an old wallet document over subsequent legitimate transactions.
