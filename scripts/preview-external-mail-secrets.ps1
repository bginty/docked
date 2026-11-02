param([ValidateSet('configure','disable')][string]$Mode='configure')
$ErrorActionPreference='Stop'
$operation=$Mode
# Existing CLI credential and pinned Preview management API; no new IAM grants.
. 'C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/private-preview-release/manage-preview.ps1' -Mode inspect | Out-Null
$headers=@{Authorization=('Bearer '+[PreviewCliCredential]::Read())}
try {
 if($operation -eq 'configure') {
  $values=Get-Content -Raw -LiteralPath 'private-data/restored-public-preview/external-hook-secrets.private.json' | ConvertFrom-Json
  if($values.GRAPH_TENANT_ID -ne 'b34880d6-d28e-40c2-b389-232506c69650' -or $values.GRAPH_CLIENT_ID -ne 'b725bf93-6183-40c5-9aac-839e02ace03a' -or $values.DOCKED_ISOLATED_EMAIL_ORIGIN -ne 'https://docked-preview-s24-briant-ginty.vercel.app'){throw 'Exact Preview mail identity required'}
  $items=@($values.PSObject.Properties | ForEach-Object { @{name=$_.Name;value=$_.Value} })
 } else { $items=@(@{name='DOCKED_ISOLATED_EMAIL_ENABLED';value='false'},@{name='DOCKED_GRAPH_MAIL_ENABLED';value='false'},@{name='GRAPH_PRIVATE_KEY_PEM';value=''},@{name='SEND_EMAIL_HOOK_SECRET';value=''}) }
 Api '/v1/projects/bckkllmndoxzpzdqrevb/secrets' 'POST' $items | Out-Null
 Write-Output 'Pinned Preview mail configuration updated; credentials not printed.'
} finally { $headers=$null; $values=$null; $items=$null }
