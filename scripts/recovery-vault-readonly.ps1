# Metadata only. Never reads a secret version, changes IAM, enables an API,
# provisions resources, modifies billing, or prints gcloud's private responses.
param([string]$ReportPath = 'docs/qa/v31-prelaunch-execution-20261111/vault-readonly.json')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$vaultRoot = Split-Path -Parent $PSScriptRoot
$vaultProject = 'docked-play-verification'
$vaultFounder = 'briantg_21@hotmail.com'
$vaultSecretNames = @('docked-recovery-acceptance', 'docked-recovery-backup', 'docked-recovery-archive')
$vaultFailures = [System.Collections.Generic.List[string]]::new()
$vaultReport = [ordered]@{
  observedAt = [DateTime]::UtcNow.ToString('o')
  project = $vaultProject
  status = 'NOT_ACCEPTED'
  cloudWrites = 0
  secretPayloadReads = 0
  credentialsEmitted = $false
  activeFounderAccount = $null
  projectVerified = $false
  projectActive = $null
  parentHierarchyPresent = $null
  secretManagerApiEnabled = $null
  billingEnabled = $null
  billingAccountFreeAllowanceVerified = $false
  founderMfaVerified = $false
  effectiveInheritedIamVerified = $false
  auditLogRoutingVerified = $false
  actualCanaryAccessAndDenialTested = $false
  projectDirectBindings = @()
  auditLogTypes = @()
  auditExemptionsPresent = $null
  secrets = @()
  blockers = @()
}
$vaultGcloud = Get-Command gcloud -ErrorAction SilentlyContinue
function Read-VaultGcloudJson {
  param([string[]]$Arguments, [string]$FailureCode)
  try {
    $vaultRaw = & $vaultGcloud.Source @Arguments '--format=json' '--quiet' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Read failed' }
    return (($vaultRaw -join "`n") | ConvertFrom-Json)
  } catch {
    $vaultFailures.Add($FailureCode)
    return $null
  } finally { $vaultRaw = $null }
}
function Summarize-VaultBindings {
  param($Policy)
  @($Policy.bindings | ForEach-Object {
    [ordered]@{
      role = $_.role
      founderPresent = (@($_.members) -contains ('user:' + $vaultFounder))
      nonFounderMembers = @($_.members | Where-Object { $_ -ne ('user:' + $vaultFounder) }).Count
      publicPrincipalPresent = (@($_.members) -contains 'allUsers' -or @($_.members) -contains 'allAuthenticatedUsers')
      conditional = ($null -ne $_.condition)
    }
  })
}
if ($null -eq $vaultGcloud) {
  $vaultFailures.Add('GCLOUD_UNAVAILABLE')
} else {
  $vaultAccounts = Read-VaultGcloudJson @('auth', 'list', '--filter=status:ACTIVE') 'ACTIVE_ACCOUNT_UNAVAILABLE'
  $vaultReport.activeFounderAccount = (@($vaultAccounts).Count -eq 1 -and $vaultAccounts.account -eq $vaultFounder)
  if (-not $vaultReport.activeFounderAccount) {
    $vaultFailures.Add('FOUNDER_SIGN_IN_REQUIRED_NO_ACCOUNT_SWITCH_PERFORMED')
  } else {
    $vaultProjectMeta = Read-VaultGcloudJson @('projects', 'describe', $vaultProject) 'PROJECT_UNAVAILABLE'
    $vaultReport.projectVerified = ($vaultProjectMeta.projectId -eq $vaultProject)
    $vaultReport.projectActive = ($vaultProjectMeta.lifecycleState -eq 'ACTIVE')
    $vaultReport.parentHierarchyPresent = ($null -ne $vaultProjectMeta.parent)
    if ($vaultReport.projectVerified -and $vaultReport.projectActive) {
      $vaultServices = Read-VaultGcloudJson @('services', 'list', '--enabled', ('--project=' + $vaultProject)) 'ENABLED_SERVICES_UNAVAILABLE'
      if ($null -ne $vaultServices) {
        $vaultReport.secretManagerApiEnabled = (@($vaultServices | Where-Object { $_.config.name -eq 'secretmanager.googleapis.com' }).Count -eq 1)
      }
      $vaultBilling = Read-VaultGcloudJson @('billing', 'projects', 'describe', $vaultProject) 'BILLING_UNAVAILABLE'
      if ($null -ne $vaultBilling) { $vaultReport.billingEnabled = $vaultBilling.billingEnabled }
      $vaultPolicy = Read-VaultGcloudJson @('projects', 'get-iam-policy', $vaultProject) 'PROJECT_IAM_UNAVAILABLE'
      if ($null -ne $vaultPolicy) {
        $vaultReport.projectDirectBindings = @(Summarize-VaultBindings $vaultPolicy)
        $vaultAudits = @($vaultPolicy.auditConfigs | Where-Object { $_.service -in @('allServices', 'secretmanager.googleapis.com') })
        $vaultReport.auditLogTypes = @($vaultAudits.auditLogConfigs.logType | Sort-Object -Unique)
        $vaultReport.auditExemptionsPresent = (@($vaultAudits.auditLogConfigs.exemptedMembers | Where-Object { $_ }).Count -gt 0)
      }
      if ($vaultReport.secretManagerApiEnabled) {
        foreach ($vaultSecretName in $vaultSecretNames) {
          $vaultMetadata = Read-VaultGcloudJson @('secrets', 'describe', $vaultSecretName, ('--project=' + $vaultProject)) ('SECRET_METADATA_UNAVAILABLE:' + $vaultSecretName)
          if ($null -eq $vaultMetadata) { continue }
          $vaultSecretPolicy = Read-VaultGcloudJson @('secrets', 'get-iam-policy', $vaultSecretName, ('--project=' + $vaultProject)) ('SECRET_IAM_UNAVAILABLE:' + $vaultSecretName)
          $vaultVersions = Read-VaultGcloudJson @('secrets', 'versions', 'list', $vaultSecretName, ('--project=' + $vaultProject)) ('VERSION_METADATA_UNAVAILABLE:' + $vaultSecretName)
          $vaultReport.secrets += [ordered]@{
            secretName = $vaultSecretName
            automaticReplication = ($null -ne $vaultMetadata.replication.automatic)
            versionDestroyTtl = $vaultMetadata.versionDestroyTtl
            expirationPresent = ($null -ne $vaultMetadata.expireTime -or $null -ne $vaultMetadata.ttl)
            rotationPresent = ($null -ne $vaultMetadata.rotation)
            directBindings = @(Summarize-VaultBindings $vaultSecretPolicy)
            activeVersions = @($vaultVersions | Where-Object { $_.state -in @('ENABLED', 'DISABLED') }).Count
            versionStates = @($vaultVersions.state | Sort-Object -Unique)
          }
        }
      }
    } else { $vaultFailures.Add('PROJECT_IDENTITY_NOT_CONFIRMED') }
  }
}
# These cannot be established from direct project/secret metadata alone. Inherited
# IAM, custom-role expansion, groups and impersonation must be reviewed separately.
$vaultFailures.Add('EFFECTIVE_IAM_MFA_BILLING_HEADROOM_AND_LOG_ROUTING_REQUIRE_ACCEPTANCE')
$vaultFailures.Add('SYNTHETIC_ACCESS_DENIAL_AND_RECOVERY_NOT_EXECUTED')
$vaultReport.blockers = @($vaultFailures)
$vaultDestination = Join-Path $vaultRoot $ReportPath
$null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $vaultDestination)
$vaultReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $vaultDestination
$vaultReport | ConvertTo-Json -Depth 8
