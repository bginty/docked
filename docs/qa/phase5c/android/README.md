# Android v7 Preview — Match Research

[Installable APK](../../../../artifacts/android/Docked-Preview-S24-v7-Match-Research.apk): **9,597,678 bytes**, SHA-256 `fb1703c10e2141b26dcf6abb2969643ebff496b9ea67dc7439f059fd0a72f4d0`.

Build passed in **1 minute 50 seconds**, 373 Gradle tasks (42 executed). Package `au.com.docked.app.preview`, label **Docked Preview**, versionCode **7**, versionName **1.6-preview**. Comparison against the actual preserved v6 APK confirms the same package and signing certificate `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`, with a higher version code. Minimum SDK 24, target SDK 36 and arm64 support were checked.

The APK opens the stable isolated HTTPS Preview at `/app`; it does not bundle the server application. Its [initial verified receipt](packaged-receipt.json) identifies deployment `dpl_2Km6vCTVhK3iwavf2E9DRmgjWpLD` and initial source `2e9041236b6e26043277e8cf103d1ebe49fe55c2`. The coordinating task records the later Phase 5C server deployment separately. This initial receipt is not a claim that Phase 5C was already hosted at build time.

## Verified artifact properties

- [APK audit](apk-audit.json): all 988 ZIP entries inspected, zero credential/forbidden-file findings, exact approved HTTPS origin, inspection disabled, both embedded offline pages use the approved logo bytes.
- [Manifest/signature audit](apk-details.json): PASS against the actual v6 binary; non-debuggable, correct package/version/certificate, compiled HTTPS-only network policy and cleartext disabled.
- [Complete indexed extraction](apk-extraction.json): all 988 entries retained separately, 17,634,155 uncompressed bytes; Windows case collisions cannot omit an entry.
- [Strong byte scan](apk-secret-scan.json): all 988 files, zero findings/errors; exact comparison against four configured secrets from two available source files, binary/UTF-16/encoded credential patterns and build-canary detection. No secret values appear in the receipt.
- [Offline asset rendering](apk-shell-render.json): exact APK HTML rendered at 412×915 in isolated desktop Chromium; zero external requests, console errors or horizontal overflow. The [screenshot](apk-offline-412.png) was visually inspected. This is not Android device acceptance.
- [Preservation](preservation.json): v3, v4, v5 and v6 still match their original manifest hashes and verified archive copies. The new v7 is also outside Gradle output and archived by content hash. The historic unrecovered v2 loss is not concealed or reclassified.

No source-generation drift occurred in public offline HTML, canonical logos or Android resources. The native changes are version/delivery metadata and a narrow member research UUID deep-link rule; source/authority checks remain server-side. Push route families were not expanded.

**V7 physical Samsung S24 and emulator acceptance are unverified.** The user-confirmed v5 S24 operation does not certify this binary. No device, emulator, account, signing key, Play upload, provider request, email, production deployment or DNS change was made by the native build. The owner-controlled upload key is still required before a signed closed-test AAB can be created.

The current [delivery manifest](../../../../artifacts/android/manifest.json) and immutable [v7 manifest](../../../../artifacts/android/manifest-v7.json) identify the exact bytes. Preserve the prior v6 [manifest](../../../../artifacts/android/manifest-v6.json) and [Phase 5B evidence](../../phase5b/android/README.md).
