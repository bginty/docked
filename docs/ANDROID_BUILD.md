# Android build and local verification

Prerequisites verified on this machine: Node 22.14.0, Android SDK platform 36 and build tools 36.0.0, Android Studio bundled JDK 21.0.6, and the existing `Medium_Phone_API_36.0` emulator. The default system JDK was 17, so use per-terminal environment variables. No system Java configuration is changed. Capacitor 8 recommends Android Studio Otter or newer; the installed Studio build was older, so the Gradle CLI is used and IDE compatibility is not asserted. [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0)

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
npm ci
npm run android:debug
```

The default build packages only `mobile/www` and can be installed without any app credentials. AGP selected its default Build-Tools 35.0.0 and installed that missing package under the SDK's **previously accepted** licence during the first build; no new licence acceptance command was issued. Platform/target remains API 36. Gradle uses at most two workers and a 1536 MiB heap to leave room for web acceptance. To review the shared application, first start a verified local preview using the project's normal build/run workflow, then:

```powershell
npm run android:preview
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:3000 tcp:3000
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r android/app/build/outputs/apk/debug/app-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n au.com.docked.app.preview/au.com.docked.app.MainActivity
```

Use only a designated test emulator/device. Real account signup/recovery still requires the separate approved hosted capture workflow. The script does not read `.env`, accept licenses, change project services, sign a release or send notifications. Gradle can provision missing build packages when a matching SDK licence was already accepted; install the stated prerequisites first to avoid that dependency. Gradle's downloaded distribution is checksum-pinned. Build outputs, local SDK paths, keys, Firebase configuration and generated Capacitor assets/configuration are ignored by Git.

For controlled native acceptance only, use `npm run android:inspect`; this opt-in exposes the debug WebView to local ADB/CDP. It cannot be enabled without the exact local preview origin. Before running `scripts/native-acceptance.mjs`, create the ignored `private-data/android` directory if needed and copy the freshly built inspection APK to `private-data/android/docked-inspection-only.apk`; the runner verifies the installed package against that exact private artifact. Install it only on the designated test device and establish the documented ADB reverse connection.

After testing, rebuild with `npm run android:debug` **and reinstall that default APK** on the test device, then remove the task's ADB forward/reverse mappings. Syncing or rebuilding alone does not change the already installed inspection app. Verify the installed/configured version has inspection disabled and no attached origin. Explicit scripts avoid PowerShell/npm argument-forwarding differences observed in this environment. Never log session cookies, passwords or callback links, and never distribute an inspection-enabled APK. Native authentication tests read the authorised account from ignored local fixtures, not command-line arguments.

## Evidence status

The default debug APK built successfully with inspection disabled and no attached origin. Its 990 ZIP entries passed the credential/configuration audit with zero findings. The explicit release dry-run was rejected as intended. Exact artifact size, SHA-256, test receipts, emulator findings and remaining native checks are recorded in [Android QA evidence](qa/android/README.md). Browser tests do not establish native behaviour. Physical-device accessibility and unexecuted native lifecycle cases remain pending.

From the repository root, `android/gradlew.bat -p android :app:assembleRelease --dry-run --no-daemon --max-workers=2` must fail with the explicit Docked release-blocked reason. Do not remove this gate to produce a store artifact. The generated instrumented package assertion now targets `au.com.docked.app.preview`; its device execution remains pending the stable-device prerequisite. Re-run the dependency audit, type check, lint, native allowlist regressions and production web build after native bridge changes.
