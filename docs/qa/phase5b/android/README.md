# Android v6 Preview — Phase 5B

[Installable APK](../../../../artifacts/android/Docked-Preview-S24-v6-Forward-Record.apk): **9,597,678 bytes**, SHA-256 `040afbb0a862196bebc1504800fa85bb7bc9435ae5712ef8e6f2cfbb63928dfa`.

The hosted Preview build passed in 2 minutes 5 seconds (373 Gradle tasks; 44 executed). Package `au.com.docked.app.preview`, label **Docked Preview**, versionCode **6**, versionName **1.5-preview**. The actual preserved v5 binary was independently compared: same package and SHA-256 signing certificate `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`, with an increasing version code. Android minSdk 24 / targetSdk 36 and arm64 support were confirmed.

This APK is an HTTPS launcher. It opens the canonical isolated Preview at `/app`; the application UI runs on that host and can advance independently of this binary. Its [initial verified host receipt](packaged-receipt.json) identifies Phase 5A deployment `dpl_2Km6vCTVhK3iwavf2E9DRmgjWpLD`, source `2e9041236b6e26043277e8cf103d1ebe49fe55c2`. The final Phase 5B web deployment is documented separately by the coordinating agent. This report does not mislabel the initial receipt as the later server revision.

## Artifact checks

- [Full APK audit](apk-audit.json): all 988 ZIP entries, zero credential/forbidden-file findings; exact approved HTTPS origin; inspection disabled; both offline branding pages match the canonical approved image.
- [Package/signature/network audit](apk-details.json): PASS against the actual v5 APK; non-debuggable; compiled manifest binds the HTTPS-only network policy with cleartext disabled.
- [Indexed extraction](apk-extraction.json): every one of 988 entries preserved separately, preventing Windows case collisions; 17,634,155 uncompressed bytes.
- [Strong secret audit](apk-secret-scan.json): all 988 extracted files, 17,634,155 bytes; zero findings/errors. Exact configured secret comparison used two available source files and four secret values, plus binary/UTF-16/encoded-value patterns and build-canary detection. Erased QA accounts were not treated as a required input.
- [Offline-shell rendering](apk-shell-render.json): exact HTML extracted from this APK rendered in desktop Chromium at 412×915, with no network requests, console errors or horizontal overflow. The [screenshot](apk-offline-412.png) was visually reviewed. This is an asset check, **not Android device or emulator acceptance**.

The first build attempt stopped before Gradle because the legacy guard accepted only `NOT_CONFIGURED`, while the actual service truthfully reported `PENDING_RIGHTS`. The guarded contract now permits that inactive credential state only with explicitly verified `providerPolling=false` and `publication=false`; all previous closed email/push/commercial/research/production gates remain. Focused guard and preservation tests passed 4/4, including omitted/true/string gates and active/unknown provider states being rejected. No provider request, gate activation or fabricated readiness label was used to complete the build.

## Preservation and limits

v5 remains byte-identical at `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b`; its [original manifest](../../../../artifacts/android/manifest-v5.json) is preserved. v3/v4/v5 and the new v6 are verified in the content-hash archive outside Gradle output. The deliverable lives in `artifacts/android/`, is Git-ignored, and will survive Gradle cleanup. The historic unrecovered v2 loss remains explicitly documented; it is not claimed as preserved.

The user confirms v5 works on their physical Samsung S24. **V6 physical-device acceptance is unverified.** No device or emulator was launched or modified in this build task. No new AAB, upload key, Play upload, production deployment, DNS change, real email or provider request was performed. The protected closed-test AAB workflow still requires owner-controlled upload signing credentials.

No tracked public offline asset, canonical logo or native resource drift was produced by generation. The only new Android source changes are version/deliverable metadata and the explicit inactive-provider receipt guard with regression coverage. The [current delivery manifest](../../../../artifacts/android/manifest.json) records the exact new artifact.
