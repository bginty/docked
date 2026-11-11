# Exact isolated Preview only. Default is GET-only; -ApplyPreviewLimits tightens
# two limits while phone Auth/signup stay OFF. Never enables a provider or sends.
param(
  [switch]$ApplyPreviewLimits,
  [string]$ReportPath = 'docs/qa/v31-phone-ops-20261111/preview-limits.json'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$phonePrepRoot = Split-Path -Parent $PSScriptRoot
$phonePrepRef = 'bckkllmndoxzpzdqrevb'
$phonePrepOrg = 'ernfnkcbalhyqpsrzdwa'
$phonePrepApi = 'https://api.supabase.com/v1/projects/' + $phonePrepRef
$phonePrepHeaders = $null
$phonePrepToken = $null
$phonePrepBefore = $null
$phonePrepAfter = $null
$phonePrepPatchSent = $false
function Assert-ClosedPhonePreparation($config) {
  if ($config.disable_signup -ne $true -or $config.external_phone_enabled -ne $false -or
      $config.sms_autoconfirm -ne $false -or $config.sms_otp_exp -ne 300 -or
      $config.sms_otp_length -ne 6 -or -not [string]::IsNullOrWhiteSpace($config.sms_test_otp)) {
    throw 'Private preparation preconditions not met'
  }
}
try {
  $phonePrepHelper = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hosted-preview/auth-management.ps1') -Raw
  $phonePrepDefinition = [regex]::Match($phonePrepHelper, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
  if ([string]::IsNullOrWhiteSpace($phonePrepDefinition)) { throw 'Existing credential helper unavailable' }
  if (-not ('DockedPreviewCredential' -as [type])) { Add-Type -TypeDefinition $phonePrepDefinition }
  $phonePrepToken = [DockedPreviewCredential]::Read()
  $phonePrepHeaders = @{ Authorization = 'Bearer ' + $phonePrepToken }
  $phonePrepProject = Invoke-RestMethod -Method Get -Uri $phonePrepApi -Headers $phonePrepHeaders -MaximumRedirection 0
  if ($phonePrepProject.id -ne $phonePrepRef -or $phonePrepProject.organization_id -ne $phonePrepOrg -or $phonePrepProject.status -ne 'ACTIVE_HEALTHY') {
    throw 'Exact healthy isolated project required'
  }
  $phonePrepBefore = Invoke-RestMethod -Method Get -Uri ($phonePrepApi + '/config/auth') -Headers $phonePrepHeaders -MaximumRedirection 0
  Assert-ClosedPhonePreparation $phonePrepBefore
  $phonePrepPayload = @{ rate_limit_sms_sent = 6; sms_max_frequency = 60 }
  if ($phonePrepBefore.rate_limit_sms_sent -lt 6 -or $phonePrepBefore.sms_max_frequency -gt 60) { throw 'Existing limits are stricter; do not weaken them' }
  if ($ApplyPreviewLimits -and ($phonePrepBefore.rate_limit_sms_sent -ne 6 -or $phonePrepBefore.sms_max_frequency -ne 60)) {
    # This static payload cannot change phone enablement, signup or credentials.
    $phonePrepPatchSent = $true
    $null = Invoke-RestMethod -Method Patch -Uri ($phonePrepApi + '/config/auth') -Headers $phonePrepHeaders -ContentType 'application/json' -Body ($phonePrepPayload | ConvertTo-Json -Compress) -MaximumRedirection 0
  }
  $phonePrepAfter = Invoke-RestMethod -Method Get -Uri ($phonePrepApi + '/config/auth') -Headers $phonePrepHeaders -MaximumRedirection 0
  Assert-ClosedPhonePreparation $phonePrepAfter
  $phonePrepUnexpected = @()
  foreach ($phonePrepName in $phonePrepBefore.PSObject.Properties.Name) {
    if ($phonePrepName -in @('rate_limit_sms_sent', 'sms_max_frequency', 'updated_at')) { continue }
    if ((ConvertTo-Json -InputObject $phonePrepBefore.$phonePrepName -Depth 100 -Compress) -cne
        (ConvertTo-Json -InputObject $phonePrepAfter.$phonePrepName -Depth 100 -Compress)) {
      $phonePrepUnexpected += $phonePrepName
    }
  }
  if ($phonePrepUnexpected.Count -ne 0) { throw 'Other Auth properties changed; investigate without exposing values' }
  if ($ApplyPreviewLimits -and ($phonePrepAfter.rate_limit_sms_sent -ne 6 -or $phonePrepAfter.sms_max_frequency -ne 60)) { throw 'Limit readback mismatch' }
  $phonePrepReport = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    target = 'isolated-preview'
    projectRef = $phonePrepRef
    organizationVerified = $true
    mode = $(if ($ApplyPreviewLimits) { 'apply-static-preview-limits' } else { 'read-only-proposal' })
    productionWrites = 0
    previewPatchSent = $phonePrepPatchSent
    payload = $phonePrepPayload
    before = @{ smsPerHour = $phonePrepBefore.rate_limit_sms_sent; resendSeconds = $phonePrepBefore.sms_max_frequency }
    after = @{ smsPerHour = $phonePrepAfter.rate_limit_sms_sent; resendSeconds = $phonePrepAfter.sms_max_frequency }
    phoneAuthEnabled = $phonePrepAfter.external_phone_enabled
    signupDisabled = $phonePrepAfter.disable_signup
    phoneAutoConfirm = $phonePrepAfter.sms_autoconfirm
    otpDigits = $phonePrepAfter.sms_otp_length
    otpExpirySeconds = $phonePrepAfter.sms_otp_exp
    allOtherReturnedAuthFieldsUnchanged = $true
    credentialsEmitted = $false
    smsAttempts = 0
  }
  $phonePrepDestination = Join-Path $phonePrepRoot $ReportPath
  $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $phonePrepDestination)
  $phonePrepReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $phonePrepDestination
  $phonePrepReport | ConvertTo-Json -Depth 5
} catch {
  [Console]::Error.WriteLine('Private phone-limit preparation did not verify. No private response emitted. Preview PATCH sent: ' + $phonePrepPatchSent)
  exit 1
} finally {
  if ($null -ne $phonePrepHeaders) { $phonePrepHeaders.Clear() }
  $phonePrepToken = $null; $phonePrepBefore = $null; $phonePrepAfter = $null
}
