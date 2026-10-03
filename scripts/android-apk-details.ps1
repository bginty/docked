param(
  [string]$Apk = 'android/app/build/outputs/apk/preview/Docked-Preview-S24-v2.apk',
  [string]$PriorApk = 'private-data/android/docked-foundation-debug.apk',
  [string]$Report = 'docs/qa/android-https-preview/apk-details.json'
)
$ErrorActionPreference = 'Stop'
$buildTools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
$aapt = Join-Path $buildTools 'aapt2.exe'
$signer = Join-Path $buildTools 'apksigner.bat'
function Get-ApkIdentity([string]$Target) {
  $badging = & $aapt dump badging $Target
  if ($LASTEXITCODE -ne 0) { throw 'APK metadata could not be verified.' }
  $package = $badging | Select-String "^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'"
  if (-not $package) { throw 'APK identity is missing.' }
  $label = $badging | Select-String "^application-label:'([^']+)'"
  if (-not $label) { throw 'APK application label is missing.' }
  $signature = & $signer verify --print-certs $Target
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
  $certificate = $signature | Select-String '^Signer #1 certificate SHA-256 digest: ([0-9a-f]+)$'
  if (-not $certificate) { throw 'APK signing certificate is missing.' }
  $nativeCode = ($badging | Select-String '^native-code:') -join ' '
  $minimumSdk = $badging | Select-String "^(?:minSdkVersion|sdkVersion):'([0-9]+)'$"
  $targetSdk = $badging | Select-String "^targetSdkVersion:'([0-9]+)'$"
  if (-not $minimumSdk -or -not $targetSdk) { throw 'APK SDK declarations are missing.' }
  return [ordered]@{
    package = $package.Matches[0].Groups[1].Value
    label = $label.Matches[0].Groups[1].Value
    versionCode = [int]$package.Matches[0].Groups[2].Value
    versionName = $package.Matches[0].Groups[3].Value
    signingCertificateSha256 = $certificate.Matches[0].Groups[1].Value
    debuggable = [bool]($badging | Select-String '^application-debuggable')
    nativeAbiDeclaration = $(if ($nativeCode) { $nativeCode } else { 'none; no packaged native ABI restriction' })
    arm64Compatible = -not $nativeCode -or $nativeCode.Contains("'arm64-v8a'")
    minimumSdk = [int]$minimumSdk.Matches[0].Groups[1].Value
    targetSdk = [int]$targetSdk.Matches[0].Groups[1].Value
  }
}
$current = Get-ApkIdentity $Apk
$prior = Get-ApkIdentity $PriorApk
$resources = & $aapt dump resources $Apk
if ($LASTEXITCODE -ne 0) { throw 'Packaged resource mapping could not be verified.' }
$networkResource = [regex]::Match(($resources -join "`n"), 'resource (0x[0-9a-f]+) xml/network_security_config\r?\n\s+\(\) \(file\) (res/[A-Za-z0-9_./-]+\.xml) type=XML')
if (-not $networkResource.Success) { throw 'Packaged network policy resource is missing.' }
$manifest = & $aapt dump xmltree $Apk --file AndroidManifest.xml
if ($LASTEXITCODE -ne 0 -or ($manifest -join "`n") -notmatch ('networkSecurityConfig\(0x[0-9a-f]+\)=@' + [regex]::Escape($networkResource.Groups[1].Value) + '\b')) { throw 'Manifest does not bind the expected network policy.' }
$networkPath = $networkResource.Groups[2].Value
$network = & $aapt dump xmltree $Apk --file $networkPath
if ($LASTEXITCODE -ne 0) { throw 'Packaged network security configuration could not be verified.' }
$networkText = $network -join "`n"
$httpsOnly = $networkText -match '(?m)^\s*A: cleartextTrafficPermitted=false\s*$' -and $networkText -notmatch 'cleartextTrafficPermitted=true|0xffffffff|localhost'
$upgrade = $current.package -eq 'au.com.docked.app.preview' -and $current.package -eq $prior.package -and
  $current.versionCode -gt $prior.versionCode -and $current.signingCertificateSha256 -eq $prior.signingCertificateSha256
$result = [ordered]@{
  recordedAt = [DateTime]::UtcNow.ToString('o')
  artifact = $Apk.Replace('\','/')
  bytes = (Get-Item -LiteralPath $Apk).Length
  sha256 = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
  current = $current
  priorVersionCode = $prior.versionCode
  samePackageAndSigningCertificate = $upgrade
  cleartextDisabledInPackagedResources = $httpsOnly
  compiledNetworkPolicyPath = $networkPath
  status = $(if ($upgrade -and $httpsOnly -and -not $current.debuggable -and $current.label -eq 'Docked Preview' -and $current.arm64Compatible -and $current.minimumSdk -eq 24 -and $current.targetSdk -eq 36) { 'PASS' } else { 'FAIL' })
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output ('APK metadata and upgrade audit ' + $result.status)
if ($result.status -ne 'PASS') { exit 1 }
