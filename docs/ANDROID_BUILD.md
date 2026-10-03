# Android preview build and verification

## Samsung S24 hosted preview

The installable S24 artifact is built with **`npm run android:hosted-preview`**, not the disconnected developer command. First verify the isolated HTTPS deployment and write the public `config/android-preview.json` receipt described in [Android architecture](ANDROID_ARCHITECTURE.md). It must identify Docked Preview Supabase `bckkllmndoxzpzdqrevb`, the exact HTTPS origin, the actual deployment and a verification time within the last 24 hours, with every required safety gate closed. A missing, stale or mismatched receipt blocks the build. Do not create a placeholder receipt to bypass this check.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
npm run android:hosted-preview
```

The preserved, owner-tested S24 deliverable is `artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk`, version code 4 / `1.3-preview`, package `au.com.docked.app.preview`. Phase 4.5 prepares `artifacts/android/Docked-Preview-S24-v5-App-Entry.apk`, version code 5 / `1.4-preview`; it must not be described as built until its new artifact receipt exists. The existing signing identity is retained for direct preview upgrades. The preview variant disables Android debugging/WebView inspection and packages an HTTPS-only network policy. v5 starts at `/app`, which routes to app login, onboarding or Edges. Offline recovery retries that same preview. Installation needs the APK and internet access, with no USB, ADB, laptop, Android Studio or local server afterwards.

Gradle can clear its output directory even when an older APK has a different filename. Before any build, the runner now copies and SHA-256 verifies existing delivery, debug and preview APKs into `private-data/android/apk-archive/<sha256>/`; failure stops the build. Successful hosted builds also copy to `artifacts/android/` and archive the resulting APK. Never treat a Gradle output directory as durable storage. The Edge Signal build exposed this issue and the old final v2 binary was not recovered; its original source and audit receipts remain intact. [Current verification and incident record](qa/edge-signal-brand/native/NATIVE_BRANDING.md).

Verify the actual built artifact before handing it over:

```powershell
New-Item -ItemType Directory -Force docs/qa/android-https-preview | Out-Null
& ./scripts/audit-android-apk.ps1 -Mode Hosted -Apk artifacts/android/Docked-Preview-S24-v5-App-Entry.apk -Report docs/qa/phase45/android/apk-audit.json
& ./scripts/android-apk-details.ps1
$taskExtract = & ./scripts/extract-android-apk.ps1
node scripts/audit-preview-secrets.mjs $taskExtract
```

The audits inspect every ZIP entry for credentials and forbidden files, check the exact attached origin, resolve and inspect the compiled cleartext policy and debuggable state, verify the APK signature, and compare package/signing/version against the preserved version-1 APK. The extraction helper gives every entry a unique indexed filename because Android's optimized resources can have names that differ only by case; ordinary Windows ZIP extraction may silently omit files or fail partway. The strong scan must cover every extracted entry, including binary/encoded secret checks. Its inputs stay in ignored `private-data` and no credential values are printed. The resulting evidence supplies the final byte size and SHA-256. A successful compile alone does not establish real-device cold/warm launch, account persistence, navigation, offline restoration, keyboard, sharing or photo-picker acceptance. Record these separately against the actual hosted APK.

## Separate developer modes

Prerequisites verified on this machine: Node 22.14.0, Android SDK platform 36 and build tools 36.0.0, Android Studio bundled JDK 21.0.6, and the existing `Medium_Phone_API_36.0` emulator. The default system JDK was 17, so use per-terminal environment variables. No system Java configuration is changed. Capacitor 8 recommends Android Studio Otter or newer; the installed Studio build was older, so the Gradle CLI is used and IDE compatibility is not asserted. [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0)

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
npm ci
npm run android:debug
```

The default developer build packages a disconnected shell into `mobile/generated/bundled` and can be installed without app credentials. This mode is deliberately distinct from the hosted S24 deliverable. AGP selected its default Build-Tools 35.0.0 and installed that missing package under the SDK's **previously accepted** licence during the first build; no new licence acceptance command was issued. Platform/target remains API 36. Gradle uses at most two workers and a 1536 MiB heap to leave room for web acceptance. To review the shared application locally, first start a verified local preview using the project's normal build/run workflow, then:

```powershell
npm run android:preview
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:3000 tcp:3000
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r android/app/build/outputs/apk/debug/app-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n au.com.docked.app.preview/au.com.docked.app.MainActivity
```

Use only a designated test emulator/device. Real account signup/recovery still requires the separate approved hosted capture workflow. The script does not read `.env`, accept licenses, change project services, sign a release or send notifications. Gradle can provision missing build packages when a matching SDK licence was already accepted; install the stated prerequisites first to avoid that dependency. Gradle's downloaded distribution is checksum-pinned. Build outputs, local SDK paths, keys, Firebase configuration and generated Capacitor assets/configuration are ignored by Git.

For controlled native acceptance only, use `npm run android:inspect`; this opt-in exposes the debug WebView to local ADB/CDP. It cannot be enabled without the exact local preview origin. Before running `scripts/native-acceptance.mjs`, create the ignored `private-data/android` directory if needed and copy the freshly built inspection APK to `private-data/android/docked-inspection-only.apk`; the runner verifies the installed package against that exact private artifact. Install it only on the designated test device and establish the documented ADB reverse connection.

After testing, rebuild with `npm run android:debug` **and reinstall that default APK** on the test device, then remove the task's ADB forward/reverse mappings. Syncing or rebuilding alone does not change the already installed inspection app. Verify the installed/configured version has inspection disabled and no attached origin. Explicit scripts avoid PowerShell/npm argument-forwarding differences observed in this environment. Never log session cookies, passwords or callback links, and never distribute an inspection-enabled APK. Native authentication tests read the authorised account from ignored local fixtures, not command-line arguments.

## Preserved foundation evidence

The earlier Phase 4 default debug APK built successfully with inspection disabled and no attached origin. Its 990 ZIP entries passed the credential/configuration audit with zero findings. The explicit release dry-run was rejected as intended. Exact artifact size, SHA-256, test receipts, emulator findings and remaining native checks are preserved in [foundation Android QA evidence](qa/android/README.md). Those receipts describe the old disconnected APK, not acceptance of the new hosted artifact. Browser tests do not establish native behaviour. Physical-device accessibility and unexecuted native lifecycle cases remain pending.

The new independently connected S24 artifact, final signature/secret audits and bounded emulator findings are recorded separately in [HTTPS Android QA](qa/android-https-preview/ANDROID_QA.md). Use its exact final APK path and checksum for delivery.

From the repository root, `android/gradlew.bat -p android :app:assembleRelease --dry-run --no-daemon --max-workers=2` must fail with the explicit Docked release-blocked reason. Do not remove this gate to produce a store artifact. The generated instrumented package assertion now targets `au.com.docked.app.preview`; its device execution remains pending the stable-device prerequisite. Re-run the dependency audit, type check, lint, native allowlist regressions and production web build after native bridge changes.
