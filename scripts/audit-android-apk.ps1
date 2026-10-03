param(
  [string]$Apk = 'android/app/build/outputs/apk/debug/app-debug.apk',
  [string]$Report = 'docs/qa/android/apk-audit.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$secretValues = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath '.env.local') {
  foreach ($line in Get-Content -LiteralPath '.env.local') {
    if ($line -match '^([A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD|TOKEN)[A-Z0-9_]*)=(.+)$') {
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
  }
} finally { $archive.Dispose() }
$inspectionDisabled = $config.android.webContentsDebuggingEnabled -eq $false
$noAttachedOrigin = -not $config.server.url
$result = [ordered]@{
  recordedAt = [DateTime]::UtcNow.ToString('o')
  artifact = $Apk.Replace('\','/')
  bytes = (Get-Item -LiteralPath $Apk).Length
  sha256 = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
  entriesScanned = $count
  credentialOrForbiddenFileFindings = $findings
  inspectionDisabled = $inspectionDisabled
  noAttachedOrigin = $noAttachedOrigin
  status = $(if ($findings -eq 0 -and $inspectionDisabled -and $noAttachedOrigin) { 'PASS' } else { 'FAIL' })
  scope = 'Every ZIP entry inspected; generic credential patterns and exact configured local server-secret values checked in memory. No secret values recorded.'
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output ('APK audit ' + $result.status + ': entries=' + $count + ', findings=' + $findings)
if ($result.status -ne 'PASS') { exit 1 }
