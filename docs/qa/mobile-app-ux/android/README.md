# Android v4 mobile app preview — actual artifact result

**BUILD AND ARTIFACT AUDITS PASSED.** [Download Docked Preview v4](../../../../artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk). The durable file lives outside every Gradle output directory.

## Identity and delivery

- File: `artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk`.
- Size: **9,262,110 bytes**.
- SHA-256: `18fb07bcb4f1fc8d43ac1b1b9c974b56f902ec0a76e2ff4f53558a993af8e19e`.
- Package: `au.com.docked.app.preview`; label **Docked Preview**.
- VersionCode **4**, versionName **1.3-preview**.
- Signing certificate SHA-256: `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`.

The APK opens the approved HTTPS preview at `https://docked-preview-s24-briant-ginty.vercel.app/home`; the current web application redirects that compatibility route to `/edges`. Internet access is required. No laptop, ADB forwarding or local server is required after installation. The packaged deployment receipt identifies `dpl_J6UfdR9DPMx5YSkLjk93LHcPP1gn`, verified at `2026-10-03T11:13:06.661Z`, with web source `6cd166187c30596d3f97d793606a2398adf6f43c`. The canonical backend can receive later reviewed updates independently of the APK.

## Completed checks

Gradle `:app:assemblePreview --no-daemon --max-workers=2` completed successfully in **1m 25s**: 373 tasks, 36 executed and 337 up to date. The build generated the approved assets once and passed the exact HTTPS receipt guard. Gradle reported existing flat-directory/deprecation warnings; there was no build failure.

| Check | Observed result |
| --- | --- |
| Actual v4/v3 package and certificate comparison | PASS — same package/certificate, versionCode 4 greater than 3 |
| APK identity | PASS — 4 / 1.3-preview / Docked Preview |
| SDK and ABI | PASS — minimum 24, target 36, ARM64 supported |
| Debuggable manifest and WebView inspection | Both disabled |
| Cleartext and mixed content | Both disabled; compiled network policy bound by manifest |
| Exact HTTPS origin and deployment receipt | PASS — no wildcard navigation |
| Native system bars | DARK, CSS insets; logging disabled |
| Approved self-contained branded pages | Both exact approved PNG checks passed |
| Asset secret scan | 8 files / 644,268 bytes; zero findings/errors |
| Complete APK ZIP audit | 988 entries; zero credential/forbidden-file findings |
| Indexed extraction | All 988 entries retained; 17,286,087 uncompressed bytes |
| Extracted strong scan | All 988 files / 17,286,087 bytes; zero findings/errors |
| Prior v3 durable binary and archive | PASS — exact original hash preserved |
| V4 durable binary and archive | PASS — copies verified by SHA-256 |
| Initial undelivered v4 candidate | PASS — exact binary and copied audit/manifest bytes preserved |

Evidence: [build receipt](apk-build.json), [actual v3 binary comparison](apk-details-v3-comparison.json), [APK entry audit](apk-audit.json), [asset scan](assets-secret-scan.json), [indexed extraction](apk-extraction.json), [strong scan](apk-strong-secret-scan.json), and [native configuration/preservation checks](native-config-and-preservation.json). The strong scan includes binary and encoded credential representations; no entries were skipped to obtain a pass. [Build/audit commands](BUILD_COMMANDS.md) retain the explicit workflow.

The generated public offline HTML was byte-for-byte identical to the committed/deployed source. No semantic public or native resource change was introduced by regeneration. No web source edits, deployment, account, provider, production or DNS operations were performed during this Android build/audit stage.

## Preservation and physical-device limits

The existing [v3 APK](../../../../artifacts/android/Docked-Preview-S24-v3-Edge-Signal.apk) remains **9,262,110 bytes**, SHA-256 `d34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0`. Both v3 and v4 have verified content-hash archives outside Gradle. The corruption/preservation regression passed before this build. V4 was compared against the actual v3 binary, rather than only a historical receipt.

An initial v4 candidate was built before the real Following-row layout and badge-contrast repair. It was not delivered. Its exact `f1d6089f…8238b` binary is preserved in a separate content-hash archive, and the original audit/manifest bytes are preserved under [initial-candidate](initial-candidate/README.md). This final receipt-matching build retains versionCode 4 and the same delivery filename. All three binary archives and the initial candidate's audit hashes were rechecked after the final build.

The read-only preflight found **no connected devices**. SDK platforms/build-tools 34, 35, 36 and JDK 21.0.6 were available. [Preflight](preflight.json) is explicitly the historical before-build snapshot. No emulator was started, no APK was installed, and no native sign-in or account mutation was attempted. **Physical Samsung S24 installation, safe areas, keyboard, background/resume, share/picker and offline lifecycle remain UNVERIFIED for v4.** Browser viewport/keyboard simulations are separate evidence, not native-runtime acceptance.

The earlier v2 preservation failure remains documented in the [v3 report](../../edge-signal-brand/native/README.md); the lost exact v2 binary has not been recovered or reconstructed. That historical limitation does not affect the actual v3-to-v4 binary comparison.
