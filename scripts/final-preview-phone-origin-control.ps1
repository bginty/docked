# Exact approved Preview provider switch. No recipient, code, send, credential
# change, signup change or Production write exists in this operator.
param([ValidateSet('inspect','enable','disable')][string]$Mode='inspect')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$phoneRoot=Split-Path -Parent $PSScriptRoot
$phoneDir=Join-Path $phoneRoot 'private-data/phone-origin-continuation-20261117'
$phoneReportDir=Join-Path $phoneRoot 'docs/qa/phone-acceptance-20261117/continuation'
$phoneToken=$null
$phoneHeaders=$null
$phoneTouched=$false
$phoneVerifiedClosed=$false
try {
  $phoneHelper=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hosted-preview/auth-management.ps1') -Raw
  $phoneDefinition=[regex]::Match($phoneHelper,"(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
  if ([string]::IsNullOrWhiteSpace($phoneDefinition)) { throw 'Credential reader unavailable' }
  if (-not ('DockedPreviewCredential' -as [type])) { Add-Type -TypeDefinition $phoneDefinition }
  $phoneToken=[DockedPreviewCredential]::Read()
  $phoneHeaders=@{Authorization='Bearer '+$phoneToken}
  $phoneApi='https://api.supabase.com/v1/projects/bckkllmndoxzpzdqrevb'
  $phoneProject=Invoke-RestMethod -Uri $phoneApi -Headers $phoneHeaders -MaximumRedirection 0 -TimeoutSec 20
  if ($phoneProject.id -ne 'bckkllmndoxzpzdqrevb' -or $phoneProject.organization_id -ne 'ernfnkcbalhyqpsrzdwa' -or $phoneProject.status -ne 'ACTIVE_HEALTHY') { throw 'Project mismatch' }
  $phoneBefore=Invoke-RestMethod -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -MaximumRedirection 0 -TimeoutSec 20
  if ($Mode -eq 'enable') {
    $phonePlan=Get-Content -LiteralPath (Join-Path $phoneDir 'phone-window.json') -Raw | ConvertFrom-Json
    $phoneAuthority=Get-Content -LiteralPath (Join-Path $phoneDir 'phone-window-authority.private.json') -Raw | ConvertFrom-Json
    $phonePlanHash=(Get-FileHash -LiteralPath (Join-Path $phoneDir 'phone-window.json') -Algorithm SHA256).Hash.ToLowerInvariant()
    $phoneArmed=Get-Content -LiteralPath (Join-Path $phoneDir 'phone-window-armed.json') -Raw | ConvertFrom-Json
    $phoneDeadline=[DateTime]::Parse($phonePlan.until).ToUniversalTime()
    if ($phoneAuthority.approved -ne $true -or $phoneAuthority.planSha256 -ne $phonePlanHash -or $phoneArmed.planSha256 -ne $phonePlanHash -or [DateTime]::Parse($phoneAuthority.expiresAt).ToUniversalTime() -le $phoneDeadline -or $phoneDeadline -le [DateTime]::UtcNow.AddMinutes(10)) { throw 'Window authority mismatch' }
    if ((Test-Path -LiteralPath (Join-Path $phoneDir 'STOP')) -or (Test-Path -LiteralPath (Join-Path $phoneDir 'phone-window-result.json'))) { throw 'Window already closed' }
    $phoneWatcherId=[int](Get-Content -LiteralPath (Join-Path $phoneDir 'watchdog.pid'))
    if ((Get-Process -Id $phoneWatcherId -ErrorAction Stop).ProcessName -ne 'node') { throw 'Watcher not running' }
    $phoneHosted=Get-Content -LiteralPath (Join-Path $phoneReportDir 'hosted-preflight.json') -Raw | ConvertFrom-Json
    if ($phoneHosted.passed -ne $true -or $phoneHosted.sourceCommit -ne 'fe1572e1781e9d2806d5af45c5d5569b669d5d93' -or [DateTime]::Parse($phoneHosted.at).ToUniversalTime() -lt [DateTime]::UtcNow.AddMinutes(-10)) { throw 'Fresh hosted preflight required' }
    $phoneManifestPath=Join-Path $phoneRoot 'docs/qa/phone-acceptance-20261117/origin-correction-package.json'
    if ((Get-FileHash -LiteralPath $phoneManifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'feecc1bb671f9919b97b4c14bfd4c35764c304d8b62559ea100f1801aa2c0e75') { throw 'Approval bytes changed' }
    $phoneManifest=Get-Content -LiteralPath $phoneManifestPath -Raw | ConvertFrom-Json
    foreach ($phoneFile in $phoneManifest.evidenceFiles) { if ((Get-FileHash -LiteralPath (Join-Path $phoneRoot $phoneFile.file) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $phoneFile.sha256) { throw 'Approval dependency changed' } }
    if ($phoneBefore.external_phone_enabled -ne $false -or $phoneBefore.disable_signup -ne $true -or $phoneBefore.external_anonymous_users_enabled -ne $false -or $phoneBefore.sms_autoconfirm -ne $false -or $phoneBefore.sms_otp_exp -ne 300 -or $phoneBefore.sms_otp_length -ne 6 -or [int]$phoneBefore.sms_max_frequency -ne 60 -or [int]$phoneBefore.rate_limit_sms_sent -ne 6 -or -not [string]::IsNullOrWhiteSpace($phoneBefore.sms_test_otp)) { throw 'Unsafe provider configuration' }
    foreach ($phoneField in @('sms_twilio_account_sid','sms_twilio_auth_token','sms_twilio_message_service_sid')) { if ([string]::IsNullOrWhiteSpace($phoneBefore.$phoneField)) { throw 'Existing provider credentials missing' } }
    $phoneBeforePath=Join-Path $phoneDir 'auth-before.private.json'
    if (Test-Path -LiteralPath $phoneBeforePath) { throw 'Never repeat enable operation' }
    [IO.File]::WriteAllText($phoneBeforePath,($phoneBefore | ConvertTo-Json -Depth 30))
    $phoneTouched=$true
    $null=Invoke-RestMethod -Method Patch -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -ContentType 'application/json' -Body '{"external_phone_enabled":true}' -MaximumRedirection 0 -TimeoutSec 20
  } elseif ($Mode -eq 'disable') {
    $null=Invoke-RestMethod -Method Patch -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -ContentType 'application/json' -Body '{"external_phone_enabled":false}' -MaximumRedirection 0 -TimeoutSec 20
  }
  $phoneAfter=Invoke-RestMethod -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -MaximumRedirection 0 -TimeoutSec 20
  $phoneDifferences=@()
  foreach ($phoneProperty in $phoneBefore.PSObject.Properties) {
    if ($phoneProperty.Name -ne 'external_phone_enabled' -and (($phoneProperty.Value | ConvertTo-Json -Depth 30 -Compress) -cne ($phoneAfter.($phoneProperty.Name) | ConvertTo-Json -Depth 30 -Compress))) { $phoneDifferences+=$phoneProperty.Name }
  }
  if ($phoneDifferences.Count -ne 0 -or $phoneAfter.disable_signup -ne $true) { throw 'Unexpected provider setting drift' }
  if (($Mode -eq 'enable' -and $phoneAfter.external_phone_enabled -ne $true) -or ($Mode -eq 'disable' -and $phoneAfter.external_phone_enabled -ne $false)) { throw 'Provider readback failed' }
  $phoneResult=[ordered]@{at=[DateTime]::UtcNow.ToString('o');mode=$Mode;project='isolated-preview';phoneEnabled=$phoneAfter.external_phone_enabled;signupDisabled=$phoneAfter.disable_signup;unrelatedSettingsChanged=$phoneDifferences.Count;productionWrites=0;smsAttempts=0;credentialsEmitted=$false}
  $phoneResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $phoneReportDir ('provider-'+$Mode+'.json'))
  $phoneResult | ConvertTo-Json
} catch {
  if ($phoneTouched) {
    try { $null=Invoke-RestMethod -Method Patch -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -ContentType 'application/json' -Body '{"external_phone_enabled":false}' -MaximumRedirection 0 -TimeoutSec 20; $phoneClosed=Invoke-RestMethod -Uri ($phoneApi+'/config/auth') -Headers $phoneHeaders -MaximumRedirection 0 -TimeoutSec 20; $phoneVerifiedClosed=($phoneClosed.external_phone_enabled -eq $false) } catch { }
  }
  [Console]::Error.WriteLine(('Preview switch stopped; enable attempted='+$phoneTouched+'; closure verified='+$phoneVerifiedClosed+'. No private response emitted.'))
  exit 1
} finally {
  if ($null -ne $phoneHeaders) { $phoneHeaders.Clear() }
  $phoneToken=$null; $phoneBefore=$null; $phoneAfter=$null
}
