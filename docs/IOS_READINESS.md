# iOS / TestFlight preparation — 5 November 2026

This current section supersedes the archived 4 October note below. The existing Capacitor project is reused; there is no separate customer account or wallet. The owner confirmed on 5 November that neither an enrolled Apple Developer team nor a Mac with Xcode is ready. No Apple fee, agreement, account change, signing, upload or purchase occurred.

## Implemented and locally checked

- Existing Capacitor 8.5.2 project, bundle `au.com.docked.app`, Docked icon/splash, HTTPS backend and shared five-tab application. NFL/AFL/NRL are the customer sports; NBA stays hidden. Existing authentication/MFA and account-deletion flow remain authoritative.
- Registered `DockedAppleBilling` native plugin, StoreKit 2 consumable purchase/unfinished-transaction handling, and a narrowly gated sandbox wallet UI. Bundled configuration is **disabled**, with an empty product list. No production-money path is enabled.
- Member-bound `appAccountToken`, Apple's server-library JWS/certificate verification and fresh App Store Server API transaction readback. Client amounts, identity and decoded JSON do not authorise fulfilment. Sandbox/Australia/bundle/product/quantity checks reject incompatible receipts.
- Shared existing wallet, receipt ledger, pack issuer and refund recovery through the existing authenticated test-purchase service. Apple receipts do not enter Google's consumption outbox. StoreKit `finish()` follows server settlement confirmation.
- Prepared signed-notification HTTP adapter and durable private queue: deduplication, leases, outage recovery, bounded missed-notification sweep, current-provider readback, no cross-account binding, and support review for refund reversal/consumption requests. No consumption information is automatically disclosed to Apple.
- `node scripts/prepare-ios.mjs` synchronises the existing project, prepares branding, checks registered source files, portable SPM paths, secure backend and disabled billing. It **does not compile Swift or produce an IPA**.

The native capability endpoint had still consulted private-beta eligibility in public mode. It now uses the website's public eligibility service and filters server-approved sports. The verified runtime was promoted to Production as `4a44b269` on 5 November, with public gameplay/registration and commercial activation still disabled. Authenticated public customer acceptance was performed in protected Preview, not Production; see [promotion evidence](PUBLIC_GAMEPLAY_DUAL_STORE_HANDOVER_20261105.md).

## Boundaries

There is no genuine Apple sandbox receipt, notification delivery, iOS simulator/device acceptance, archive or TestFlight build. Automated Apple-provider responses are explicitly synthetic. `sandbox/apple-reconciliation.sql` is a disposable local fixture, **not a reviewed Production migration**. Production's Google-only member-receipt admission needs a separately reviewed extension before hosted Apple tests.

`apple-test-http.ts` is dependency-injected preparation, not a public route. Native `/api/store/apple/test` remains unavailable until a protected runtime supplies normal session authentication, per-member expiring admission, rate limits, transaction-time authorisation, private encryption and Apple credentials. These sandbox adapters do not implement or activate real-money Apple settlement.

The privacy manifest declares no tracking and no new required-reason API use in these custom files. This does not mean Docked collects no data. Audit the actual archived Capacitor/plugins/SDK manifests and required-reason APIs through Xcode before upload. No push entitlement was added.

## Exact TestFlight prerequisites

1. Enrol Ginty United Investments Pty Ltd in Apple Developer as an organisation through Apple's verification and two-factor authentication process. The owner must accept agreements and pay any fee personally. Do not send passwords or signing keys in chat.
2. Provide authorised access to a Mac with **Xcode 26+**. [Capacitor requirements](https://capacitorjs.com/docs/ios) specify iOS 15+ and Xcode 26+; check the toolchain. No paid Mac service has been provisioned.
3. Reserve/verify `au.com.docked.app` in the organisation team and create Docked in App Store Connect. Do not silently replace the identifier. Assign scoped access and a secure signing/recovery owner.
4. Start with disabled IAP. Run `npm ci`, `node scripts/prepare-ios.mjs`, then open `ios/App/App.xcodeproj`. Choose the verified team, resolve packages, build for simulator, inspect privacy warnings, then archive/validate via Organizer. Use a unique build number in the actual App Store record; current source values are preparation only.
5. Test login, MFA, confirmation/recovery/deletion links, session restore, navigation, keyboard, safe areas, offline resume, Social/photo permissions and all three sports. Capture actual iPhone screenshots. Android captures are not iOS acceptance.
6. Prepare the draft consumables in `config/apple-store-product-drafts.json`; confirm IDs/AUD price points in App Store Connect. Provision sandbox testers, a Server API key, Apple trust roots, Notifications V2 endpoint and private queue/worker through a reviewed hosted change. Never store keys in Git.
7. Execute successful/pending/cancelled purchases, account switching, outages, duplicates, nine-card opening, refunds before/after spending, signed notification retries and signed-out recovery. StoreKit completion alone is not wallet acceptance.
8. Validate/export/upload the signed archive, configure authorised internal TestFlight testers, and collect crash/device feedback. External testing/public release may require Apple's review. This preparation is not public release or live-IAP approval.

Store copy, privacy-label worksheet and reviewer checklist: [Apple submission draft](APPLE_SUBMISSION_DRAFT_20261105.md). Engineering evidence: `qa/dual-store-20261105/`.

Sources: [Apple enrolment](https://developer.apple.com/programs/enroll/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [App privacy](https://developer.apple.com/app-store/app-privacy-details/), [Server API](https://developer.apple.com/documentation/appstoreserverapi), [refund notifications](https://developer.apple.com/documentation/storekit/handling-refund-notifications). Source review is not legal or App Review approval.

---

## Archived 4 October record — superseded, not current readiness

# iOS readiness — 4 October 2026

Preparation only: no iOS project, signing identity, Apple enrollment, purchase or build was created in Phase 5D. The current package contains Capacitor Android and shared web plugins, but not `@capacitor/ios`; the existing target resolver is Android-specific and must not be reused blindly for iOS.

The [Capacitor v8 documentation](https://capacitorjs.com/docs/ios) specifies iOS 15+ and Xcode 26+. A compatible Mac/Xcode environment is required for native build/signing. Add the matching `@capacitor/ios` version only in a separately authorised implementation, create the native project, and provide an explicit isolated Preview target. Preserve approved D-mark icon/splash assets, HTTPS-only endpoints and the current authentication/session/security controls.

Owner inputs for TestFlight: Apple Developer account/team, bundle identifier approval, signing/App Store Connect access, legal entity/support/privacy details and a tester group. [Apple enrollment](https://developer.apple.com/programs/enroll/) requires identity verification and two-factor authentication; organisation enrollment has additional legal-authority requirements. No fee has been incurred or enrollment started.

Before distribution verify WKWebView auth redirects and session restoration, MFA/password recovery/deletion, universal/deep links, camera/photo permission descriptions, share sheet, offline recovery, keyboard avoidance, notch/home-indicator safe areas and every five-tab screen. Audit native privacy manifests, dependency declarations, third-party SDK collection and App Store privacy labels against actual behavior. Inspect app/client archives for credentials. Keep billing, prizes, affiliates, auto-publication and live official Edges disabled. Research status does not substitute for an App Review policy assessment or legal clearance.

Android friends-and-family testing can continue independently. Physical iPhone and iOS simulator acceptance remain unperformed.

Push remains a separate native integration: configure the iOS APNs entitlement, provisioning capability, permission prompts and server token lifecycle before enabling it. No APNs key or iOS push capability is installed here. The current web session uses protected authentication cookies; no iOS Keychain-backed native token store has been implemented or verified. If native token storage is later needed, use a reviewed Keychain adapter, never ordinary preferences/local storage for secrets. Review the existing native appUrlOpen handler against approved iOS universal links and exact callback allowlists; do not inherit Android intent assumptions.
