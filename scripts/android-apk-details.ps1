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
  return [ordered]@{
    package = $package.Matches[0].Groups[1].Value
    label = $label.Matches[0].Groups[1].Value
    versionCode = [int]$package.Matches[0].Groups[2].Value
    versionName = $package.Matches[0].Groups[3].Value
    signingCertificateSha256 = $certificate.Matches[0].Groups[1].Value
    debuggable = [bool]($badging | Select-String '^application-debuggable')
  }
}
$current = Get-ApkIdentity $Apk
$prior = Get-ApkIdentity $PriorApk
$network = & $aapt dump xmltree $Apk --file res/xml/network_security_config.xml
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
  status = $(if ($upgrade -and $httpsOnly -and -not $current.debuggable -and $current.label -eq 'Docked Preview') { 'PASS' } else { 'FAIL' })
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output ('APK metadata and upgrade audit ' + $result.status)
if ($result.status -ne 'PASS') { exit 1 }
