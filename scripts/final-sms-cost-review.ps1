# GET-only. Existing Preview credentials remain in memory; no phone/OTP/token output.
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$smsRoot=Split-Path -Parent $PSScriptRoot
$smsHeaders=$null;$smsConfig=$null;$smsProviderHeaders=$null;$smsToken=$null;$smsStage='credential-reader'
try {
 $smsHelper=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hosted-preview/auth-management.ps1') -Raw
 $smsDefinition=[regex]::Match($smsHelper,"(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
 if([string]::IsNullOrWhiteSpace($smsDefinition)){throw 'Missing credential helper'}
 if(-not ('DockedPreviewCredential' -as [type])){Add-Type -TypeDefinition $smsDefinition}
 $smsToken=[DockedPreviewCredential]::Read();$smsHeaders=@{Authorization='Bearer '+$smsToken}
 $smsApi='https://api.supabase.com/v1/projects/bckkllmndoxzpzdqrevb'
 $smsProject=Invoke-RestMethod -Uri $smsApi -Headers $smsHeaders -MaximumRedirection 0 -TimeoutSec 20
 if($smsProject.id-ne'bckkllmndoxzpzdqrevb'-or$smsProject.organization_id-ne'ernfnkcbalhyqpsrzdwa'){throw 'Project mismatch'}
 $smsConfig=Invoke-RestMethod -Uri ($smsApi+'/config/auth') -Headers $smsHeaders -MaximumRedirection 0 -TimeoutSec 20
 if($smsConfig.external_phone_enabled-ne$false-or$smsConfig.disable_signup-ne$true){throw 'Preview window unexpectedly open'}
 if($smsConfig.sms_twilio_account_sid-notmatch'^AC[0-9a-fA-F]{32}$'-or[string]::IsNullOrWhiteSpace($smsConfig.sms_twilio_auth_token)){throw 'Missing existing provider identity'}
 $smsProviderHeaders=@{Authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($smsConfig.sms_twilio_account_sid+':'+$smsConfig.sms_twilio_auth_token))}
 $smsStage='twilio-pricing'
 $smsPrice=Invoke-RestMethod -Uri 'https://pricing.twilio.com/v1/Messaging/Countries/AU' -Headers $smsProviderHeaders -MaximumRedirection 0 -TimeoutSec 20
 if($smsPrice.iso_country-ne'AU'){throw 'Unexpected price region'}
 $smsStage='twilio-message-cost'
 $smsMessages=Invoke-RestMethod -Uri ('https://api.twilio.com/2010-04-01/Accounts/'+$smsConfig.sms_twilio_account_sid+'/Messages.json?PageSize=5') -Headers $smsProviderHeaders -MaximumRedirection 0 -TimeoutSec 20
 $smsSafeMessages=@($smsMessages.messages | Where-Object {$_.messaging_service_sid-eq$smsConfig.sms_twilio_message_service_sid} | ForEach-Object {[ordered]@{dateSent=$_.date_sent;status=$_.status;segments=$_.num_segments;providerPrice=$_.price;providerCurrency=$_.price_unit}})
 $smsReport=[ordered]@{at=[DateTime]::UtcNow.ToString('o');productionWrites=0;previewWrites=0;smsSent=0;credentialsEmitted=$false;phoneNumbersEmitted=$false;priceUnit=$smsPrice.price_unit;outboundPrices=$smsPrice.outbound_sms_prices;recentSameServiceMessages=$smsSafeMessages;note='Prices are provider-currency amounts; taxes, fees and FX must fit the conservative A$1 per-attempt reservation before activation. No AUD charge invented.'}
 $smsReport|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $smsRoot 'docs/qa/final-release-decision-20261117/sms-provider-costs.json')
 [ordered]@{success=$true;priceUnit=$smsPrice.price_unit;carriers=@($smsPrice.outbound_sms_prices).Count;recentSameServiceMessages=$smsSafeMessages;mutations=0}|ConvertTo-Json -Depth 5
} catch {
 $smsStatus=$null;if($null-ne$_.Exception.Response){$smsStatus=[int]$_.Exception.Response.StatusCode}
 [ordered]@{success=$false;stage=$smsStage;httpStatus=$smsStatus;mutations=0;smsSent=0;privateResponsesSuppressed=$true}|ConvertTo-Json
 exit 1
}
finally{if($null-ne$smsHeaders){$smsHeaders.Clear()};if($null-ne$smsProviderHeaders){$smsProviderHeaders.Clear()};$smsConfig=$null;$smsToken=$null;$smsMessages=$null}
