# Docked Android preview delivery

[Download Docked Preview v4 — Mobile App](Docked-Preview-S24-v4-Mobile-App.apk)

9,262,110 bytes · SHA-256 `18fb07bcb4f1fc8d43ac1b1b9c974b56f902ec0a76e2ff4f53558a993af8e19e`

This is a sideload preview, package `au.com.docked.app.preview`, versionCode 4 (`1.3-preview`). It connects to the isolated Docked HTTPS preview over internet access; it does not require a laptop, ADB forwarding or a local server after installation. Debugging and cleartext are disabled. The package and signing certificate match the actual preserved v3 APK, allowing an in-place upgrade. Physical S24 acceptance has not been run.

The binary is Git-ignored and stored outside Gradle outputs. [Current manifest](manifest.json) and [v4 artifact audits](../../docs/qa/mobile-app-ux/android/README.md) record its identity and exact checks. Every existing delivery/debug/preview APK is verified in a content-hash archive before Gradle can run.

This final v4 includes the verified receipt for the corrected mobile preview deployment. The earlier undelivered v4 candidate and its exact receipts remain in a separate [historical archive record](../../docs/qa/mobile-app-ux/android/initial-candidate/README.md).

[Preserved v3 — Edge Signal](Docked-Preview-S24-v3-Edge-Signal.apk) remains unchanged: 9,262,110 bytes, SHA-256 `d34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0`. Its [original manifest](manifest-v3.json) and [historical audit](../../docs/qa/edge-signal-brand/native/README.md) remain available. That report includes the earlier v2 binary loss; v2 must not be described as preserved.
