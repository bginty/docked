# V4 build and artifact audit commands

Executed from the Docked workspace after root verified the new isolated HTTPS deployment and refreshed its public receipt. [README.md](README.md) records the passing results. SDK/Gradle access required the approved sandbox escalation. No deployment, account operation, device installation or emulator launch was included. Any future rebuild still requires a fresh approved receipt; these commands must not be run with a fabricated origin or identity.

```powershell
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$taskApk = 'artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk'
$taskPrior = 'artifacts/android/Docked-Preview-S24-v3-Edge-Signal.apk'
$taskReports = 'docs/qa/mobile-app-ux/android'
$taskPriorHash = 'd34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0'
$taskCertificate = '38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b'
if ((Get-FileHash -LiteralPath $taskPrior -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPriorHash) { throw 'Preserved v3 identity mismatch; do not build.' }

npm run android:hosted-preview
if ($LASTEXITCODE -ne 0) { throw 'Hosted preview build failed.' }

node scripts/verify-android-preview-assets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Exact preview assets failed verification.' }
node scripts/audit-preview-secrets.mjs android/app/src/main/assets > "$taskReports/assets-secret-scan.json"
if ($LASTEXITCODE -ne 0) { throw 'Packaged asset secret scan failed.' }
& ./scripts/audit-android-apk.ps1 -Mode Hosted -Apk $taskApk -Report "$taskReports/apk-audit.json"
if ($LASTEXITCODE -ne 0) { throw 'APK entry/config audit failed.' }
& ./scripts/android-apk-details.ps1 -Apk $taskApk -PriorApk $taskPrior -Report "$taskReports/apk-details-v3-comparison.json"
if ($LASTEXITCODE -ne 0) { throw 'APK signature/manifest/network audit failed.' }
$taskDetails = Get-Content -Raw -LiteralPath "$taskReports/apk-details-v3-comparison.json" | ConvertFrom-Json
if ($taskDetails.status -ne 'PASS' -or $taskDetails.current.versionCode -ne 4 -or $taskDetails.current.versionName -ne '1.3-preview' -or $taskDetails.priorVersionCode -ne 3 -or $taskDetails.current.signingCertificateSha256 -ne $taskCertificate) { throw 'V4 identity or actual v3 upgrade comparison failed.' }

$taskExtract = & ./scripts/extract-android-apk.ps1 -Apk $taskApk -Report "$taskReports/apk-extraction.json"
node scripts/audit-preview-secrets.mjs $taskExtract > "$taskReports/apk-strong-secret-scan.json"
if ($LASTEXITCODE -ne 0) { throw 'Complete extracted APK secret scan failed.' }
if ((Get-FileHash -LiteralPath $taskPrior -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPriorHash) { throw 'Preserved v3 artifact changed.' }
Get-Item -LiteralPath $taskApk | Select-Object FullName, Length
Get-FileHash -LiteralPath $taskApk -Algorithm SHA256
```

The runner archives all existing durable, debug and preview APKs before Gradle; an unavailable or corrupted archive stops the build. It generates icons/shells once, synchronises Capacitor and invokes `:app:assemblePreview --no-daemon --max-workers=2`. The final APK is copied to the durable artifact directory and archived again.

Inspect the APK's `assets/capacitor.config.json` in memory for `SystemBars.style=DARK`, `insetsHandling=css`, the expected HTTPS entry, `loggingBehavior=none`, `webContentsDebuggingEnabled=false`, `allowMixedContent=false`, `cleartext=false` and no wildcard navigation. Save only those non-sensitive assertions as a separate native configuration receipt. The full ZIP audit and strong scanner still examine every entry; the selective configuration receipt does not replace them.

Indexed extraction uses unique filenames to retain case-colliding Android resources on Windows. Do not use a partial extraction, omit binaries or suppress scanner findings to obtain a passing result. Record entry counts, uncompressed bytes and any scan errors. Raw credentials and extracted payloads remain outside the public evidence folder.

All artifact audits passed, and the result README and durable artifact manifest now record actual build time, task counts, file size/hash, deployment identity and receipts. V3 was not deleted or overwritten. A passing artifact audit still does not establish physical S24 installation or native runtime acceptance.
