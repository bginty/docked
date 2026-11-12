# GET-only inspection of the existing saved Preview integration. No OTP request,
# Auth change, sender registration or service mutation. No private values logged.
param([switch]$InspectSavedFormatOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$twilioRoot = Split-Path -Parent $PSScriptRoot
$twilioOutput = Join-Path $twilioRoot 'docs/qa/v31-commercial-execution-20261113/twilio-api-readiness.json'
if (Test-Path -LiteralPath $twilioOutput) { throw 'Evidence exists; inspect it instead of overwriting.' }
$twilioHelper = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hosted-preview/auth-management.ps1') -Raw
$twilioDefinition = [regex]::Match($twilioHelper, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
if ([string]::IsNullOrWhiteSpace($twilioDefinition)) { throw 'Existing credential helper unavailable' }
if (-not ('DockedPreviewCredential' -as [type])) { Add-Type -TypeDefinition $twilioDefinition }
$twilioHeaders = $null
$managementHeaders = $null
$twilioConfig = $null
$twilioPhase = 'saved-preview-configuration'
try {
  $managementHeaders = @{ Authorization = 'Bearer ' + [DockedPreviewCredential]::Read() }
  $twilioConfig = Invoke-RestMethod -Method Get -Uri 'https://api.supabase.com/v1/projects/bckkllmndoxzpzdqrevb/config/auth' -Headers $managementHeaders -MaximumRedirection 0
  if ($twilioConfig.external_phone_enabled -ne $false -or $twilioConfig.disable_signup -ne $true) { throw 'Preview closed-gate precondition failed' }
  if ($twilioConfig.sms_provider -ne 'twilio') { throw 'Unexpected provider' }
  if ($twilioConfig.sms_twilio_account_sid -notmatch '^AC[0-9a-fA-F]{32}$' -or $twilioConfig.sms_twilio_message_service_sid -notmatch '^MG[0-9a-fA-F]{32}$') { throw 'Saved account/service identifiers unavailable' }
  if ([string]::IsNullOrWhiteSpace($twilioConfig.sms_twilio_auth_token)) { throw 'Saved credential unavailable' }
  $twilioFormat = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    authTokenHasExpected32HexFormat = $twilioConfig.sms_twilio_auth_token -cmatch '^[0-9a-fA-F]{32}$'
    authTokenLooksMasked = $twilioConfig.sms_twilio_auth_token -match '^[*•]+$|hidden|redacted|encrypted'
    authTokenContainsOuterWhitespace = $twilioConfig.sms_twilio_auth_token -cne $twilioConfig.sms_twilio_auth_token.Trim()
    authTokenEqualsAccountIdentifier = $twilioConfig.sms_twilio_auth_token -ceq $twilioConfig.sms_twilio_account_sid
    authTokenEqualsServiceIdentifier = $twilioConfig.sms_twilio_auth_token -ceq $twilioConfig.sms_twilio_message_service_sid
    credentialsEmitted = $false
    providerWrites = 0
    authWrites = 0
    smsAttempts = 0
  }
  if ($InspectSavedFormatOnly) {
    $twilioFormat | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $twilioRoot 'docs/qa/v31-commercial-execution-20261113/twilio-saved-format.json')
    $twilioFormat | ConvertTo-Json
    return
  }
  if (-not $twilioFormat.authTokenHasExpected32HexFormat) { throw 'Saved token cannot be used as a Twilio Auth Token' }
  $twilioHeaders = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($twilioConfig.sms_twilio_account_sid + ':' + $twilioConfig.sms_twilio_auth_token)) }
  $twilioServiceUrl = 'https://messaging.twilio.com/v1/Services/' + $twilioConfig.sms_twilio_message_service_sid
  $twilioPhase = 'existing-messaging-service'
  $twilioService = Invoke-RestMethod -Method Get -Uri $twilioServiceUrl -Headers $twilioHeaders -MaximumRedirection 0
  if ($twilioService.account_sid -ne $twilioConfig.sms_twilio_account_sid -or $twilioService.sid -ne $twilioConfig.sms_twilio_message_service_sid) { throw 'Service account mismatch' }
  $twilioPhase = 'generic-sender-pool'
  $twilioAlpha = Invoke-RestMethod -Method Get -Uri ($twilioServiceUrl + '/AlphaSenders?PageSize=1000') -Headers $twilioHeaders -MaximumRedirection 0
  $twilioPhase = 'australian-sender-pool'
  $twilioDestination = Invoke-RestMethod -Method Get -Uri ($twilioServiceUrl + '/DestinationAlphaSenders?IsoCountryCode=AU&PageSize=1000') -Headers $twilioHeaders -MaximumRedirection 0
  if ($twilioAlpha.meta.next_page_url -or $twilioDestination.meta.next_page_url) { throw 'Unexpected pagination; no partial conclusion' }
  $twilioPhase = 'balance'
  $twilioBalance = Invoke-RestMethod -Method Get -Uri ('https://api.twilio.com/2010-04-01/Accounts/' + $twilioConfig.sms_twilio_account_sid + '/Balance.json') -Headers $twilioHeaders -MaximumRedirection 0
  if ($twilioBalance.account_sid -ne $twilioConfig.sms_twilio_account_sid) { throw 'Balance account mismatch' }
  $twilioReport = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    evidenceType = 'Authenticated GET requests using existing saved Preview integration'
    existingCredentialAccepted = $true
    existingServiceAccountMatched = $true
    previewPhoneOff = $true
    previewRegistrationClosed = $true
    genericSenderCount = @($twilioAlpha.alpha_senders).Count
    dockedInGenericSenderPool = @($twilioAlpha.alpha_senders | Where-Object { $_.alpha_sender -ceq 'DOCKED' }).Count -gt 0
    australianDestinationSenderCount = @($twilioDestination.destination_alpha_senders).Count
    dockedInAustralianDestinationSenderPool = @($twilioDestination.destination_alpha_senders | Where-Object { $_.alpha_sender -ceq 'DOCKED' -and $_.iso_country_code -eq 'AU' }).Count -gt 0
    registrationApprovalVerified = $false
    registrationLimitation = 'Sender-pool APIs do not attest Australian registration approval. Authenticated Console registration status or genuine provider approval notice still required.'
    fundedBalance = [decimal]$twilioBalance.balance
    balanceCurrency = $twilioBalance.currency
    approvedTestBudgetAud = 20
    approvedTestWindowBudgetAud = 5
    budgetNote = 'Balance is not spending authority. Window remains unapproved; AUD ceiling includes tax and FX.'
    smsAttempts = 0
    providerWrites = 0
    authWrites = 0
    credentialsEmitted = $false
    references = @('https://www.twilio.com/docs/messaging/api/alphasender-resource','https://www.twilio.com/docs/messaging/api/destination-alphasender-resource','https://help.twilio.com/articles/360025294494-Check-Your-Twilio-Account-Balance','https://help.twilio.com/articles/47624808819483-Registering-Your-Alphanumeric-Sender-ID-for-Australia-in-the-Twilio-Console')
  }
  $twilioReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $twilioOutput
  $twilioReport | ConvertTo-Json -Depth 5
} catch {
  [Console]::Error.WriteLine('Twilio read-only inspection stopped at ' + $twilioPhase + '; HTTP status ' + [string][int]$_.Exception.Response.StatusCode + '; no private response emitted, no writes or SMS.')
  exit 1
} finally {
  if ($null -ne $twilioHeaders) { $twilioHeaders.Clear() }
  if ($null -ne $managementHeaders) { $managementHeaders.Clear() }
  $twilioConfig = $null
}
