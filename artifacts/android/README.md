# Docked Android preview delivery

[Download Docked Preview v6 — Forward Record](Docked-Preview-S24-v6-Forward-Record.apk)

9,597,678 bytes · SHA-256 `040afbb0a862196bebc1504800fa85bb7bc9435ae5712ef8e6f2cfbb63928dfa`

This sideload preview is package `au.com.docked.app.preview`, versionCode 6 (`1.5-preview`). It opens the isolated HTTPS preview at `/app`, which routes to app login, onboarding or Edges. Internet access is required; a laptop, ADB forwarding and local server are not required after installation. Android debugging, WebView inspection and cleartext are disabled. The package and signing certificate match the actual preserved v5 APK for an in-place upgrade. The APK is a launcher: the application UI is delivered by the approved HTTPS host and can advance independently of its initial deployment receipt.

**V6 physical-device and emulator acceptance remain unverified.** The user confirms v5 works on their physical Samsung S24; that does not establish v6 lifecycle, keyboard, native share or photo-picker acceptance.

The APK is Git-ignored and stored outside Gradle outputs. [V6 manifest](manifest-v6.json), [current manifest](manifest.json) and [v6 build/security audits](../../docs/qa/phase5b/android/README.md) identify the exact artifact. Builds verify all existing delivery/debug/preview artifacts in a content-hash archive before invoking Gradle.

[Preserved v5 — App Entry](Docked-Preview-S24-v5-App-Entry.apk) remains unchanged: 9,597,678 bytes, SHA-256 `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b`. Its [original manifest](manifest-v5.json) and [historical audits](../../docs/qa/phase45/android/README.md) are retained.

[Preserved v4 — Mobile App](Docked-Preview-S24-v4-Mobile-App.apk) remains unchanged: 9,262,110 bytes, SHA-256 `18fb07bcb4f1fc8d43ac1b1b9c974b56f902ec0a76e2ff4f53558a993af8e19e`. Its [original manifest](manifest-v4.json) and [historical audits](../../docs/qa/mobile-app-ux/android/README.md) are retained, including the [undelivered first candidate](../../docs/qa/mobile-app-ux/android/initial-candidate/README.md).

[Preserved v3 — Edge Signal](Docked-Preview-S24-v3-Edge-Signal.apk) remains unchanged: 9,262,110 bytes, SHA-256 `d34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0`. Its [original manifest](manifest-v3.json) and [historical audit](../../docs/qa/edge-signal-brand/native/README.md) remain available. That report includes the earlier v2 binary loss; v2 must not be described as preserved.

A signed Play AAB requires separate owner-controlled upload signing credentials. The guarded [closed-test workflow](../../docs/ANDROID_CLOSED_TEST_BUILD.md) is prepared; no AAB or Play upload was produced.
