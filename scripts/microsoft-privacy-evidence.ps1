# READ ONLY. Run in the owner's existing Exchange administrator session.
# No Connect command, installs, grants, tenant setting changes, mailbox content or secrets.
$ErrorActionPreference = 'Stop'
$dockedConnections = @(Get-ConnectionInformation | Where-Object State -eq 'Connected')
if ($dockedConnections.Count -ne 1 -or [string]$dockedConnections[0].TenantID -ne 'b34880d6-d28e-40c2-b389-232506c69650') {
  throw 'Use one connected Exchange administrator session for the verified Docked tenant.'
}
$dockedMailbox = Get-Mailbox -Identity 'support@docked.com.au'
$dockedMailbox | Select-Object PrimarySmtpAddress,MailboxRegion,MailboxRegionLastUpdateTime,RetentionPolicy,RetainDeletedItemsFor,SingleItemRecoveryEnabled,LitigationHoldEnabled,LitigationHoldDate,LitigationHoldDuration,InPlaceHolds,ComplianceTagHoldApplied,DelayHoldApplied,DelayReleaseHoldApplied,RetentionHoldEnabled,ElcProcessingDisabled,ArchiveStatus | Format-List
# Org-wide hold IDs can apply even when the mailbox InPlaceHolds list is empty.
Get-OrganizationConfig | Select-Object InPlaceHolds | Format-List
if ($dockedMailbox.RetentionPolicy) {
  $dockedPolicy = Get-RetentionPolicy -Identity $dockedMailbox.RetentionPolicy
  $dockedPolicy | Select-Object Name,RetentionPolicyTagLinks | Format-List
  foreach ($dockedTag in $dockedPolicy.RetentionPolicyTagLinks) {
    Get-RetentionPolicyTag -Identity $dockedTag | Select-Object Name,Type,RetentionEnabled,AgeLimitForRetention,RetentionAction | Format-List
  }
}
Write-Output 'If existing hold/label/policy evidence requires follow-up, use the current administrator or provider to identify it. Do not purchase Purview or assume an unavailable portal means no holds. This readback is settings evidence, not a permanent-erasure guarantee. Selected Docked messages may be exported through existing Outlook without paid eDiscovery.'
