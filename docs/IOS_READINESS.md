# iOS readiness — 4 October 2026

Preparation only: no iOS project, signing identity, Apple enrollment, purchase or build was created in Phase 5D. The current package contains Capacitor Android and shared web plugins, but not `@capacitor/ios`; the existing target resolver is Android-specific and must not be reused blindly for iOS.

The [Capacitor v8 documentation](https://capacitorjs.com/docs/ios) specifies iOS 15+ and Xcode 26+. A compatible Mac/Xcode environment is required for native build/signing. Add the matching `@capacitor/ios` version only in a separately authorised implementation, create the native project, and provide an explicit isolated Preview target. Preserve approved D-mark icon/splash assets, HTTPS-only endpoints and the current authentication/session/security controls.

Owner inputs for TestFlight: Apple Developer account/team, bundle identifier approval, signing/App Store Connect access, legal entity/support/privacy details and a tester group. [Apple enrollment](https://developer.apple.com/programs/enroll/) requires identity verification and two-factor authentication; organisation enrollment has additional legal-authority requirements. No fee has been incurred or enrollment started.

Before distribution verify WKWebView auth redirects and session restoration, MFA/password recovery/deletion, universal/deep links, camera/photo permission descriptions, share sheet, offline recovery, keyboard avoidance, notch/home-indicator safe areas and every five-tab screen. Audit native privacy manifests, dependency declarations, third-party SDK collection and App Store privacy labels against actual behavior. Inspect app/client archives for credentials. Keep billing, prizes, affiliates, auto-publication and live official Edges disabled. Research status does not substitute for an App Review policy assessment or legal clearance.

Android friends-and-family testing can continue independently. Physical iPhone and iOS simulator acceptance remain unperformed.
