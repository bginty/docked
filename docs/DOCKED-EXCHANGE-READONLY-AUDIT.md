> Current checkpoint: [Hosted email queue verification](DOCKED-HOSTED-EMAIL-QUEUE-VERIFICATION.md). The controlled hosted message received Graph 202 and owner-confirmed Inbox delivery. Existing Microsoft credentials are now protected Supabase secrets; all three sending/worker/test flags are false again. Full Auth acceptance and launch remain blocked. Earlier local-only/no-upload statements below describe historical checkpoints.

# Docked Exchange permission readback

**Completed administrator readback received, 8 October 2026:** the owner supplied the full valid scope with `RecipientFilter = PrimarySmtpAddress -eq 'support@docked.com.au'`, `IsValid=True`, `ObjectState=Unchanged`, the scoped Application Mail.Send assignment, and support `InScope=True`. The earlier blank `RecipientRestrictionFilter` does not invalidate this full readback: that name is the creation parameter; the returned scope exposes `RecipientFilter`. The live Entra application-role query was refreshed and remains empty. Do not repeat creation, grant permissions or enable delivery. Commands below are retained as the audit procedure, not a new request to redo the completed scope check.

The Entra app and Exchange assignment already exist. **Do not recreate them, grant new permissions, rotate credentials or enable the hook.** These are read-only commands for the owner's existing authenticated Exchange administrator PowerShell session. The agent has no connected administrator session and browser automation cannot initialize.

The live Graph query for this exact service principal returned an empty `appRoleAssignments` collection, with no next page. Certificate-authenticated tokens have no delegated scope or Graph application-role claims. This verifies the current Entra application-role grant readback; it does not enumerate Exchange's separate RBAC assignments.

## Required administrator readback

If needed, connect with `Connect-ExchangeOnline` using normal administrator MFA. Do not use the Docked application's certificate to grant it administrative access. Verify you are connected to tenant `b34880d6-d28e-40c2-b389-232506c69650`, then run:

```powershell
$dockedTenantId = 'b34880d6-d28e-40c2-b389-232506c69650'
$dockedAppId = 'b725bf93-6183-40c5-9aac-839e02ace03a'
$dockedObjectId = '081adc14-2b0f-4c3a-b078-1bb7b171d05f'
$dockedConnections = @(Get-ConnectionInformation | Where-Object State -eq 'Connected')
$dockedConnections | Select-Object State, TenantID
if ($dockedConnections.Count -ne 1 -or [string]$dockedConnections[0].TenantID -ne $dockedTenantId) {
  throw 'Use one connected session in the approved Docked tenant before continuing'
}

$dockedSp = Get-ServicePrincipal -Identity $dockedObjectId -ErrorAction Stop
if ([string]$dockedSp.AppId -ne $dockedAppId) { throw 'Wrong Docked application' }
$dockedSp | Select-Object DisplayName, AppId, ObjectId, Identity

# Fetch every assignment for this principal, not just the expected named one.
$dockedAssignments = @(Get-ManagementRoleAssignment -RoleAssignee $dockedSp.Identity -ErrorAction Stop)
$dockedAssignments | Select-Object Name, Role, Enabled, RoleAssigneeType, RoleAssignee, CustomResourceScope, RecipientAdministrativeUnitScope | Format-List

Get-ManagementScope -Identity 'Docked-Support-Mailbox-Only' -ErrorAction Stop |
  Select-Object Name, ScopeRestrictionType, Exclusive, RecipientRoot, RecipientFilter | Format-List

Test-ServicePrincipalAuthorization -Identity $dockedObjectId -Resource 'support@docked.com.au' |
  Select-Object RoleName, GrantedPermissions, AllowedResourceScope, ScopeType, InScope | Format-List
```

Return all displayed rows, including unexpected roles/scopes. Expected: one enabled `Application Mail.Send` assignment (`Docked-Support-MailSend`), its scope `Docked-Support-Mailbox-Only`, and the exact support-only PrimarySmtpAddress filter. An additional assignment, blank/organization-wide scope, administrative-unit scope or broader filter needs investigation; do not remove or modify anything automatically. If another named scope is returned, obtain that exact scope with `Get-ManagementScope -Identity '<returned scope>'`; do not enumerate tenant recipients.

No second genuine mailbox is available. The negative authorization test remains **NOT RUN**, not passed. The application's real read attempt for the test message in support's Inbox returned HTTP 403, which establishes denied read access there only; it does not establish denial of sending as another mailbox.

## Optional trace for the delivered test

The owner confirmed the exact test arrived in the Inbox. The sender's four-second request deadline expired without receiving Graph's acknowledgement, so network acceptance and the eventual delivery have different evidence. To obtain a server-side trace without reading mailbox contents or granting the sender read permissions:

```powershell
Get-MessageTraceV2 -SenderAddress 'support@docked.com.au' -RecipientAddress 'support@docked.com.au' `
  -Subject 'Docked Production Email — controlled delivery check DOCKED-MAIL-CHECK-20261008115516745' `
  -SubjectFilterType StartsWith `
  -StartDate ([datetimeoffset]'2026-10-08T11:50:00Z').UtcDateTime `
  -EndDate ([datetimeoffset]'2026-10-08T12:05:00Z').UtcDateTime |
  Select-Object Received, SenderAddress, RecipientAddress, Subject, Status, MessageTraceId, MessageId
```

If the end time is still in the future, use the current UTC time instead. This optional trace must remain restricted to the one subject and mailbox; do not broaden it to unrelated mail. No further email has been sent or scheduled automatically.

## Before activation

Complete the Exchange readback, resolve the hook deadline/retry behavior and run controlled hosted Auth verification/recovery tests under separately approved access. Do not mark the production mail readiness gate complete based solely on the delivered diagnostic message. The local send reused the existing hook's `sendGraph` implementation with an in-memory enable switch; the actual Supabase function switch was never changed. No Graph credentials were uploaded to Supabase or Netlify.

Sources: [Microsoft RBAC union and testing limits](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [Microsoft Exchange example of per-service-principal assignment enumeration](https://techcommunity.microsoft.com/blog/exchange/identify-applications-using-exchange-online-outlookrestv2-or-exchange-web-servic/3957435), [Get-ManagementRoleAssignment](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/get-managementroleassignment?view=exchange-ps), [Get-MessageTraceV2](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/get-messagetracev2?view=exchange-ps).
