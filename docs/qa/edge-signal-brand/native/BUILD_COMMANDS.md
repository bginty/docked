# Version 3 build and audit commands

Historical preparation plan. The actual build and audits are now recorded in [README.md](README.md). The planned binary comparison against version 2 could not complete because Gradle removed that file; the actual version 1 comparison and separate historical version 2 receipt comparison are documented there. Do not rerun these historical commands expecting the version 2 path to exist. Current build/durable-delivery instructions are in [ANDROID_BUILD.md](../../../ANDROID_BUILD.md). No placeholder receipt or arbitrary origin is permitted.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$taskApk = 'android/app/build/outputs/apk/preview/Docked-Preview-S24-v3-Edge-Signal.apk'
$taskPrior = 'android/app/build/outputs/apk/preview/Docked-Preview-S24-v2.apk'
$taskReportRoot = 'docs/qa/edge-signal-brand/native'
$taskPriorHash = 'a0bbd4ee89109fd1a1ee17b4401eb1c786d8d957bd858ee4b7642e9f0af27be0'
if ((Get-FileHash -LiteralPath $taskPrior -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPriorHash) { throw 'Preserved v2 identity mismatch.' }

npm run android:hosted-preview
if ($LASTEXITCODE -ne 0) { throw 'Hosted preview build failed.' }

node scripts/audit-preview-secrets.mjs android/app/src/main/assets > "$taskReportRoot/assets-secret-scan.json"
if ($LASTEXITCODE -ne 0) { throw 'Packaged asset secret scan failed.' }
& ./scripts/audit-android-apk.ps1 -Mode Hosted -Apk $taskApk -Report "$taskReportRoot/apk-audit.json"
if ($LASTEXITCODE -ne 0) { throw 'APK entry/config audit failed.' }
& ./scripts/android-apk-details.ps1 -Apk $taskApk -PriorApk $taskPrior -Report "$taskReportRoot/apk-details.json"
if ($LASTEXITCODE -ne 0) { throw 'APK signature/manifest/network audit failed.' }
$taskExtract = & ./scripts/extract-android-apk.ps1 -Apk $taskApk -Report "$taskReportRoot/apk-extraction.json"
node scripts/audit-preview-secrets.mjs $taskExtract > "$taskReportRoot/apk-strong-secret-scan.json"
if ($LASTEXITCODE -ne 0) { throw 'Complete extracted APK secret scan failed.' }
if ((Get-FileHash -LiteralPath $taskPrior -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPriorHash) { throw 'Preserved v2 artifact changed.' }
Get-Item -LiteralPath $taskApk | Select-Object FullName, Length
Get-FileHash -LiteralPath $taskApk -Algorithm SHA256
```

The build runner generates approved icons/shells once, synchronises Capacitor and runs `:app:assemblePreview --no-daemon --max-workers=2`. After the preservation incident it now archives all existing debug/preview and delivery APKs before Gradle, then copies the final version 3 APK to `artifacts/android/`. Explicit audit parameters preserve prior receipts. Complete indexed extraction avoids case-colliding Android resource names on Windows. The strong scanner examines every extracted entry, including binaries and encoded configured secrets; never substitute a partial extraction.

Verified current identity: `au.com.docked.app.preview`, **Docked Preview**, versionCode **3**, versionName **1.2-preview**, signing certificate SHA-256 `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`, inspection and cleartext disabled. Exact current receipts and comparison limitations are linked in the result README.

Preparation verified that version 2 was 6,716,374 bytes with its recorded hash before the later build removed it. The APK archive guard regression passed: exact supplied embedded PNG accepted despite incidental `ADB` bytes in its base64; seven invalid documents rejected, including modified images, network resources and development-connection copy. Generic and known-secret checks still inspect every archive entry before the image-only copy check.
