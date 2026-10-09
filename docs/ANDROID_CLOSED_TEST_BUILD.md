> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Android v5 and Google Play closed-test build

Prepared 3 October 2026. No Play upload, account purchase or signing key creation has been performed.

## Direct S24 preview

The sideload package remains `au.com.docked.app.preview`, versionCode 5 / versionName `1.4-preview`, with the existing certificate. `npm run android:hosted-preview` creates `artifacts/android/Docked-Preview-S24-v5-App-Entry.apk` only after a fresh verified `config/android-preview.json` exists. Startup is the exact approved HTTPS origin plus `/app`. The v4 APK and its hash archive must remain preserved before any Gradle task. v4 physical operation is owner-confirmed; v5 physical acceptance remains pending until tested.

## Closed-test AAB

`closedTest` is a separate, non-debuggable build type with the preview package suffix and verified HTTPS assets. Production `release` remains blocked. The closed-test type cannot fall back to the sideload debug signing key. Its build runs the signing preflight and HTTPS asset verifier even when invoked directly through Gradle.

No upload keystore was supplied. A signed, upload-ready AAB therefore remains **OWNER_ACTION_REQUIRED**. The prepared command is `npm run android:closed-test`, producing `artifacts/android/Docked-Preview-v5-Closed-Test.aab` after signing checks pass. It does not upload anything. APK/AAB artifacts are hash-archived outside Gradle output before and after builds.

1. The owner creates an upload key in Android Studio: **Build → Generate Signed Bundle/APK → Android App Bundle → Create new**. Store it outside the repository or in ignored `private-data/android-signing/`; use a strong password and a certificate validity of at least 25 years. Back up the key securely.
2. Set process environment variables `DOCKED_UPLOAD_KEYSTORE` (absolute path), `DOCKED_UPLOAD_ALIAS`, `DOCKED_UPLOAD_STORE_PASSWORD`, `DOCKED_UPLOAD_KEY_PASSWORD`, plus SDK/JDK locations. Use a local secret manager or private session; never paste passwords into chat, shell command arguments, tracked files or screenshots. The workflow never loads the web `.env.local` into native assets.
3. Refresh the verified isolated preview receipt. Run `npm run android:closed-test:check`, then the build. The verifier inspects only the public certificate in memory, rejects the known sideload/debug identity and requires validity beyond October 2033. Signing secrets stay in process environment and Gradle signing configuration.
4. Audit the AAB's complete extracted contents for secrets, verify its JAR signature with the JDK `jarsigner -verify`, and validate/generated-device-test with current Google `bundletool` before upload. An AAB is not an installable APK.
5. Owner completes Play App Signing, policy/declaration review and the closed testing track in Play Console. The prepared package ID is the preview ID, not authorization to register the production package. Owner must confirm the long-term package choice before uploading.

**Upgrade boundary:** direct v5 APK uses the v4 certificate and is intended to upgrade v4. Google Play uses its app-signing certificate rather than the upload certificate. A Play-signed installation with a different certificate cannot replace the sideload installation even when package IDs match; it requires an explicitly planned migration or uninstall. Do not enroll the debug key as a Play key merely to avoid that boundary.

## Technical requirements verified from official sources

Android's current target requirement is API 36 for new phone apps/updates from 31 August 2026. This project already targets/compiles API 36 with minSdk 24. [Android target API requirements](https://developer.android.com/google/play/requirements/target-sdk).

Upload keys and app-signing keys are distinct; Play App Signing signs delivered APKs. Store publishing does not accept debug certificates. [Android signing documentation](https://developer.android.com/studio/publish/app-signing).

Gradle `bundle<Variant>` produces an AAB; `jarsigner`, not `apksigner`, signs/verifies the bundle format. [Android command-line build documentation](https://developer.android.com/build/building-cmdline).

Play policy and declarations remain in [GOOGLE_PLAY_POLICY_REVIEW.md](GOOGLE_PLAY_POLICY_REVIEW.md). These technical preparations do not establish policy eligibility or approval.
