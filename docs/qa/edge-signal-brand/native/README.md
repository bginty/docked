# Edge Signal Android preview: actual result

Version 3 built successfully and passed its current-artifact audits. The durable deliverable is [Docked-Preview-S24-v3-Edge-Signal.apk](../../../../artifacts/android/Docked-Preview-S24-v3-Edge-Signal.apk), stored outside Gradle's output directories.

- Size: **9,262,110 bytes**.
- SHA-256: `d34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0`.
- Identity: `au.com.docked.app.preview`, **Docked Preview**, versionCode **3**, versionName **1.2-preview**.
- Signing certificate SHA-256: `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`.
- Entry: `https://docked-preview-s24-briant-ginty.vercel.app/home`.
- Verified deployment: `dpl_98W8eekf5UHSkD1oNWNe39wRVUNb`; web source `5ee5c56b769abb875ee2fe6a00c0519288777841`.

## Completed checks

The build completed in 81 seconds: 373 Gradle tasks, 53 executed and 320 up to date. Both bundled branded offline pages matched the exact approved PNG and current preview configuration. The asset scan checked eight files; the APK audit and complete indexed extraction checked all 988 entries. The extracted strong scan covered 17,286,088 uncompressed bytes with **zero credential findings or scan errors**.

The final platform suite passed **188/188 tests** in 29.189 seconds with no failures or skips, including the artifact preservation regression. Type checking and scoped lint also passed after the preservation repair.

Actual packaged checks confirmed Android debugging, WebView inspection, mixed content and cleartext are disabled. The package supports ARM64, minimum SDK24 and target SDK36. The signature/package comparison against the preserved original version 1 APK passed. [Current metadata and actual v1 comparison](apk-details-v1-comparison.json), [APK audit](apk-audit.json), [full extraction](apk-extraction.json), [strong scan](apk-strong-secret-scan.json) and [build receipt](apk-build.json) retain the evidence.

No emulator, app, sign-in or physical-device acceptance was run for this build. Samsung S24 installation and native lifecycle remain **UNVERIFIED**. The authorized recovery-only device inventory found no connected devices; no emulator was started.

## Version 2 preservation failure

The prior final version 2 APK was verified immediately before building: 6,716,374 bytes, SHA-256 `a0bbd4ee89109fd1a1ee17b4401eb1c786d8d957bd858ee4b7642e9f0af27be0`. It was mistakenly retained inside Gradle's output folder. Packaging version 3 removed that file despite its different filename. This was a preservation failure; the exact version 2 binary is **unrecovered**.

The Docked workspace, including intermediates/private archives, and Desktop/Downloads subfolders contained no recovery copy. The Desktop website ZIP contained no APK. The known emulator was stopped; historical evidence shows it held a different preflight build (`9c28c40b…`), and the final version 2 APK was never reinstalled there. No emulator was started and no binary was reconstructed or represented as the original.

The [original version 2 audit](../../android-https-preview/apk-details.json) remains unchanged. Its recorded package and certificate match version 3 and its versionCode is lower, but this is a **historical receipt comparison**, not a new inspection of the lost binary. [Separate comparison receipt](apk-v2-receipt-comparison.json) explicitly marks `priorBinaryRecheck: UNAVAILABLE`; [recovery report](v2-recovery.json) records the limitation.

The build runner now preserves and verifies all existing APKs in both debug/preview outputs and the durable delivery folder before any Gradle invocation. Copies live in content-hash archives outside Gradle. A copy error, hash mismatch or corrupted existing archive stops the build. Its regression passed with three named APKs across both variants, simulated output cleanup and corruption refusal. The repair affects future build handling; it cannot restore the lost version 2 binary.

## Branding evidence

[Native branding details](NATIVE_BRANDING.md) records supplied-asset use, source identity, platform safe areas and responsive offline screenshots. The standalone offline checks had zero accessibility violations, console errors, horizontal overflow or network requests. [Prepared commands](BUILD_COMMANDS.md) preserve the original intended workflow; the actual version 2 comparison limitation is documented above.
