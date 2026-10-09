# Connected owner QA Android — v11

**Physical Samsung S24 acceptance: PENDING. Authenticated mobile gameplay/session acceptance: PENDING.**

APK: `C:\Users\61412\Documents\ChatGPT\Docked.com.au\artifacts\android\Docked-v11-Owner-Connected-QA.apk`

This is the **connected** APK, not `Docked-v10-Fantasy-Bundled-QA.apk`. It loads https://docked-production-5uwewz9wi-briant-s-projects.vercel.app and inherits the exact-owner server gate. It does not contain a private database connection, service-role key, Vercel protection bypass, or owner password.

- Package: `au.com.docked.app.preview`
- Version: `1.10-preview`, versionCode `11`
- Size: 11,036,122 bytes
- SHA256: `207e1d67ef67a7e3faf5d4601d4e7c7aeb0b6a5615ab8ca2e9b25291989da304`
- Same package/signing certificate as v10; compatible with an in-place update of that build.
- ARM64 supported; minimum Android API 24, target 36.
- Non-debuggable; cleartext disabled; only the approved HTTPS target is attached.
- Build passed. All 988 APK entries inspected with zero credential/forbidden-file findings. Exact known secrets were also checked in extracted APK entries and client/source outputs; see `secret-audit.json`.

## Install on the S24

1. Copy this exact APK from the path above to the S24 using USB file transfer. In Samsung **My Files → Downloads** (or the folder copied to), tap `Docked-v11-Owner-Connected-QA.apk`.
2. If Android requests it, allow installation from **My Files** for this installation. Choose **Update** for the existing compatible Docked Preview app. Do not uninstall or clear app data as a routine step. If Android rejects the signature/version, report the message instead.
3. Open **Docked Preview**. Vercel deployment protection remains enabled. Complete normal owner Vercel access if presented, then existing Docked owner sign-in and MFA. No new password reset, invitation or MFA setup is required. Browser and WebView cookies are separate; report a protection/login loop rather than disabling protection.
4. Confirm Play / Cards / Market / Social / Profile appear after admission. Only fictional football QA cards and simulated scores are expected. Market purchases and transfers are unavailable; no money is involved.
5. Follow the [visual/device checklist](VISUAL_REVIEW.md). Turn the temporary My Files installation permission off afterwards if enabled. Report visual approval and physical test results separately.

This file is a local deliverable, not a public download or Play Store release. Do not distribute it to friends/testers during the owner-only window.

## Emulator evidence and remaining blocker

The API 36 x86_64 QA emulator initially had an Android Pixel Launcher ANR and stalled installation. A reboot without wiping data recovered it; the installed package reports versionCode 11 / 1.10-preview. A cold launch returned `Status: ok`; the app process remained present, with zero fatal-exception lines in the inspected process log. See [emulator receipt](emulator.json).

During protected navigation the foreground moved to Chrome's first-run activity. [Captured handoff](emulator-v11-protection-handoff.png) is emulator-only evidence. No Vercel owner session was supplied and no first-run/browser sign-in was completed. Therefore protection handoff completion, Docked login/MFA, mobile session persistence and gameplay are **PENDING**, not passed. If normal owner authentication cannot return to the app, a separately verified protected-session handoff implementation is still needed; protection must not be disabled or its credential packaged in the APK.

No physical device was connected or tested. The QA emulator was stopped after evidence capture.
