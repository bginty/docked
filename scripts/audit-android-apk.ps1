param(
  [string]$Apk = 'android/app/build/outputs/apk/debug/app-debug.apk',
  [string]$Report = 'docs/qa/android/apk-audit.json',
  [ValidateSet('Bundled','Hosted')][string]$Mode = 'Bundled'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$secretValues = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath '.env.local') {
  foreach ($line in Get-Content -LiteralPath '.env.local') {
    if ($line -match '^([A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD|TOKEN|API_KEY|SMTP)[A-Z0-9_]*)=(.+)$') {
      $value = $Matches[2].Trim().Trim('"').Trim("'")
      if ($value.Length -ge 16) { $secretValues.Add($value) }
      if ($value -match '^postgres(?:ql)?://[^:]+:([^@]+)@') {
        $passwordValue = [Uri]::UnescapeDataString($Matches[1])
        if ($passwordValue.Length -ge 12) { $secretValues.Add($passwordValue) }
      }
    }
  }
}
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Apk))
$count = 0
$findings = 0
$config = $null
$packagedEnvironment = $null
$hostedPagesSafe = $true
try {
  foreach ($entry in $archive.Entries) {
    $count++
    if ($entry.FullName -match '(?i)(^|/)(\.env(?:\.[^/]*)?|google-services\.json|local\.properties)$|\.(jks|keystore|p12|pem)$') { $findings++ }
    if ($entry.Length -eq 0) { continue }
    $stream = $entry.Open()
    $memory = [IO.MemoryStream]::new()
    try { $stream.CopyTo($memory); $text = [Text.Encoding]::UTF8.GetString($memory.ToArray()) }
    finally { $stream.Dispose(); $memory.Dispose() }
    if ($text -match '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_\-]{20,}|postgres(?:ql)?://[^\s"<>]+:[^\s"<>]+@') { $findings++ }
    foreach ($secretValue in $secretValues) { if ($text.Contains($secretValue)) { $findings++ } }
    if ($entry.FullName -eq 'assets/capacitor.config.json') { $config = $text | ConvertFrom-Json }
    if ($entry.FullName -eq 'assets/public/preview-environment.json') { $packagedEnvironment = $text | ConvertFrom-Json }
    if ($Mode -eq 'Hosted' -and $entry.FullName -in @('assets/public/index.html','assets/public/offline.html') -and $text -match 'localhost:3000|ADB|Connect the reviewed preview|reverse port') { $hostedPagesSafe = $false }
  }
} finally { $archive.Dispose() }
$inspectionDisabled = $config.android.webContentsDebuggingEnabled -eq $false
$noAttachedOrigin = -not $config.server.url
$approvedHostedOrigin = $false
$expectedEnvironment = $null
if ($Mode -eq 'Hosted') {
  $expectedText = & node --input-type=module -e "import {resolveAndroidTarget} from './scripts/android-preview-config.mjs'; console.log(JSON.stringify(resolveAndroidTarget({CAPACITOR_PREVIEW_MODE:'hosted'}).manifest));"
  if ($LASTEXITCODE -ne 0) { throw 'APK audit requires a current verified preview manifest.' }
  $expectedEnvironment = $expectedText | ConvertFrom-Json
  $approvedHostedOrigin = $config.server.url -eq ($expectedEnvironment.origin + '/home') -and
    $config.server.cleartext -eq $false -and $config.android.allowMixedContent -eq $false -and
    -not $config.server.allowNavigation -and $hostedPagesSafe -and
    $packagedEnvironment.origin -eq $expectedEnvironment.origin -and
    $packagedEnvironment.supabaseProjectRef -eq $expectedEnvironment.supabaseProjectRef -and
    $packagedEnvironment.deploymentId -eq $expectedEnvironment.deploymentId
}
$result = [ordered]@{
  recordedAt = [DateTime]::UtcNow.ToString('o')
  artifact = $Apk.Replace('\','/')
  bytes = (Get-Item -LiteralPath $Apk).Length
  sha256 = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
  entriesScanned = $count
  credentialOrForbiddenFileFindings = $findings
  inspectionDisabled = $inspectionDisabled
  noAttachedOrigin = $noAttachedOrigin
  mode = $Mode
  approvedHostedOrigin = $approvedHostedOrigin
  previewOrigin = $expectedEnvironment.origin
  supabaseProjectRef = $expectedEnvironment.supabaseProjectRef
  status = $(if ($findings -eq 0 -and $inspectionDisabled -and (($Mode -eq 'Bundled' -and $noAttachedOrigin) -or ($Mode -eq 'Hosted' -and $approvedHostedOrigin))) { 'PASS' } else { 'FAIL' })
  scope = 'Every ZIP entry inspected; generic credential patterns and exact configured local server-secret values checked in memory. No secret values recorded.'
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output ('APK audit ' + $result.status + ': entries=' + $count + ', findings=' + $findings)
if ($result.status -ne 'PASS') { exit 1 }
