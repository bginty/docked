# Read-only exact Production config; no secret/provider credential is emitted.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$launchSource = Get-Content -LiteralPath 'scripts/hosted-preview/auth-management.ps1' -Raw
$launchDefinition = [regex]::Match($launchSource, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
if ([string]::IsNullOrWhiteSpace($launchDefinition)) { throw 'Existing credential helper unavailable' }
if (-not ('DockedPreviewCredential' -as [type])) { Add-Type -TypeDefinition $launchDefinition }
$launchToken = $null
try {
  $launchToken = [DockedPreviewCredential]::Read()
  $launchHeaders = @{ Authorization = 'Bearer ' + $launchToken }
  $launchApi = 'https://api.supabase.com/v1/projects/pojoymtniryarxxunyvz'
  $launchProject = Invoke-RestMethod -Method Get -Uri $launchApi -Headers $launchHeaders -MaximumRedirection 0
  if ($launchProject.id -ne 'pojoymtniryarxxunyvz' -or $launchProject.organization_id -ne 'otldyeunbqabbcjydjpe') { throw 'Project mismatch' }
  $launchConfig = Invoke-RestMethod -Method Get -Uri ($launchApi + '/config/auth') -Headers $launchHeaders -MaximumRedirection 0
  $launchReport = [ordered]@{
    at = [DateTime]::UtcNow.ToString('o'); productionWrites=0
    disableSignup=$launchConfig.disable_signup
    emailAutoConfirm=$launchConfig.mailer_autoconfirm
    phoneAuthEnabled=$launchConfig.external_phone_enabled
    phoneAutoConfirm=$launchConfig.sms_autoconfirm
    smsProvider=$launchConfig.sms_provider
    smsRateLimit=$launchConfig.rate_limit_sms_sent
    smsOtpExpiry=$launchConfig.sms_otp_exp
    captchaEnabled=$launchConfig.security_captcha_enabled
    leakedPasswordProtection=$launchConfig.password_hibp_enabled
  }
  $launchReport | ConvertTo-Json | Set-Content -LiteralPath 'docs/qa/v31-p1-p4-20261110/auth-provider-readiness.json'
  $launchReport | ConvertTo-Json
} catch {
  Write-Error 'Read-only Auth configuration check unavailable. No setting was changed; no credentials are included in this error.'
} finally { $launchToken=$null; $launchHeaders=$null; $launchConfig=$null }
