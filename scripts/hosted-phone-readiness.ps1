# Read-only OTP readiness for the two existing Docked projects. Never sends SMS,
# changes Auth configuration, enumerates credentials, or prints private values.
param([string]$ReportPath = 'docs/qa/v31-operational-acceptance-20261110/auth-provider-readiness.json')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$otpRoot = Split-Path -Parent $PSScriptRoot
$otpHelper = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hosted-preview/auth-management.ps1') -Raw
$otpDefinition = [regex]::Match($otpHelper, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
if ([string]::IsNullOrWhiteSpace($otpDefinition)) { throw 'Existing credential helper unavailable' }
if (-not ('DockedPreviewCredential' -as [type])) { Add-Type -TypeDefinition $otpDefinition }
$otpToken = $null
$otpHeaders = $null
$otpConfig = $null
$otpResults = @()
try {
  $otpToken = [DockedPreviewCredential]::Read()
  $otpHeaders = @{ Authorization = 'Bearer ' + $otpToken }
  foreach ($otpTarget in @(
    @{ kind = 'production'; ref = 'pojoymtniryarxxunyvz'; org = 'otldyeunbqabbcjydjpe' },
    @{ kind = 'isolated-preview'; ref = 'bckkllmndoxzpzdqrevb'; org = 'ernfnkcbalhyqpsrzdwa' }
  )) {
    $otpApi = 'https://api.supabase.com/v1/projects/' + $otpTarget.ref
    $otpProject = Invoke-RestMethod -Method Get -Uri $otpApi -Headers $otpHeaders -MaximumRedirection 0
    if ($otpProject.id -ne $otpTarget.ref -or $otpProject.organization_id -ne $otpTarget.org) { throw 'Project identity mismatch' }
    $otpConfig = Invoke-RestMethod -Method Get -Uri ($otpApi + '/config/auth') -Headers $otpHeaders -MaximumRedirection 0
    $otpResults += [ordered]@{
      environment = $otpTarget.kind
      observedAt = [DateTime]::UtcNow.ToString('o')
      projectHealthy = ($otpProject.status -eq 'ACTIVE_HEALTHY')
      signupDisabled = $otpConfig.disable_signup
      phoneAuthEnabled = $otpConfig.external_phone_enabled
      phoneAutoConfirm = $otpConfig.sms_autoconfirm
      smsProvider = $otpConfig.sms_provider
      smsRateLimitPerHour = $otpConfig.rate_limit_sms_sent
      smsOtpExpirySeconds = $otpConfig.sms_otp_exp
      smsResendIntervalSeconds = $otpConfig.sms_max_frequency
      smsOtpLength = $otpConfig.sms_otp_length
      twilioAccountConfigured = (-not [string]::IsNullOrWhiteSpace($otpConfig.sms_twilio_account_sid))
      twilioCredentialConfigured = (-not [string]::IsNullOrWhiteSpace($otpConfig.sms_twilio_auth_token))
      twilioMessagingServiceConfigured = (-not [string]::IsNullOrWhiteSpace($otpConfig.sms_twilio_message_service_sid))
      fixedTestOtpConfigured = (-not [string]::IsNullOrWhiteSpace($otpConfig.sms_test_otp))
      captchaEnabled = $otpConfig.security_captcha_enabled
      leakedPasswordProtection = $otpConfig.password_hibp_enabled
      phoneMfaEnrollEnabled = $otpConfig.mfa_phone_enroll_enabled
      phoneMfaVerifyEnabled = $otpConfig.mfa_phone_verify_enabled
      authenticatorEnrollEnabled = $otpConfig.mfa_totp_enroll_enabled
      authenticatorVerifyEnabled = $otpConfig.mfa_totp_verify_enabled
      emailAuthEnabled = $otpConfig.external_email_enabled
      emailAutoConfirm = $otpConfig.mailer_autoconfirm
      passwordReauthenticationRequired = $otpConfig.security_update_password_require_reauthentication
      authenticatedReadOnlyInspection = $true
    }
    $otpConfig = $null
  }
  $otpReport = [ordered]@{
    productionWrites = 0; previewWrites = 0; smsAttempts = 0
    credentialsEmitted = $false; projects = $otpResults
  }
  $otpDestination = Join-Path $otpRoot $ReportPath
  $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $otpDestination)
  $otpReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $otpDestination
  $otpReport | ConvertTo-Json -Depth 5
} catch {
  [Console]::Error.WriteLine('Read-only phone readiness inspection unavailable; no settings changed and no private response emitted.')
  exit 1
} finally {
  if ($null -ne $otpHeaders) { $otpHeaders.Clear() }
  $otpToken = $null; $otpConfig = $null
}
