# Operator-only, exact Docked Preview target. No credential is printed or persisted.
# --capture-quota30 requires the user's explicit approval before the operator runs it.
param(
  [Parameter(Position = 0)]
  [ValidateSet('--inspect', '--capture-quota30', '--restore-quota2')]
  [string]$Mode = '--inspect'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$previewRef = 'bckkllmndoxzpzdqrevb'
$previewOrg = 'ernfnkcbalhyqpsrzdwa'
$previewApi = 'https://api.supabase.com/v1/projects/' + $previewRef
$previewBearer = $null
$previewHeaders = $null
$previewStage = 'credential'
try {
  if (-not ('DockedPreviewCredential' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DockedPreviewCredential {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  private struct Credential {
    public uint Flags, Type;
    public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist, AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")]
  private static extern void CredFree(IntPtr credential);
  public static string Read() {
    IntPtr pointer;
    // Exact documented CLI account only; never enumerate the credential store.
    if (!CredRead("Supabase CLI:supabase", 1, 0, out pointer)) throw new Exception("Credential unavailable");
    byte[] bytes = null;
    try {
      var record = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
      if (record.CredentialBlobSize < 4 || record.CredentialBlobSize > 4096) throw new Exception("Credential shape denied");
      bytes = new byte[record.CredentialBlobSize];
      Marshal.Copy(record.CredentialBlob, bytes, 0, bytes.Length);
      string value = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
      if (!value.StartsWith("sbp_", StringComparison.Ordinal)) value = Encoding.Unicode.GetString(bytes).TrimEnd('\0');
      if (!value.StartsWith("sbp_", StringComparison.Ordinal) || value.IndexOfAny(new[]{'\r','\n','\0'}) >= 0)
        throw new Exception("Credential shape denied");
      return value;
    } finally {
      if (bytes != null) Array.Clear(bytes, 0, bytes.Length);
      CredFree(pointer);
    }
  }
}
'@
  }
  $previewBearer = [DockedPreviewCredential]::Read()
  $previewHeaders = @{ Authorization = 'Bearer ' + $previewBearer }
  $previewStage = 'identity'
  $previewProject = Invoke-RestMethod -Method Get -Uri $previewApi -Headers $previewHeaders -MaximumRedirection 0
  if ($previewProject.id -ne $previewRef -or $previewProject.organization_id -ne $previewOrg -or $previewProject.name -ne 'Docked Preview') {
    throw 'Project identity denied'
  }
  $previewStage = 'auth-read'
  $previewConfig = Invoke-RestMethod -Method Get -Uri ($previewApi + '/config/auth') -Headers $previewHeaders -MaximumRedirection 0
  $beforeRate = $previewConfig.rate_limit_email_sent
  if ($Mode -eq '--capture-quota30') {
    if ($previewConfig.hook_send_email_enabled -ne $true -or
        $previewConfig.hook_send_email_uri -ne 'pg-functions://postgres/preview_auth/capture_email' -or
        $previewConfig.site_url -ne 'http://localhost:3000' -or
        $previewConfig.mailer_autoconfirm -ne $false -or
        $previewConfig.external_anonymous_users_enabled -ne $false -or
        -not [string]::IsNullOrEmpty($previewConfig.smtp_host) -or
        $beforeRate -notin @(2, 30)) {
      throw 'Capture-only configuration gate denied'
    }
    $previewStage = 'capture-quota-write'
    $null = Invoke-RestMethod -Method Patch -Uri ($previewApi + '/config/auth') -Headers $previewHeaders -ContentType 'application/json' -Body '{"rate_limit_email_sent":30}' -MaximumRedirection 0
  } elseif ($Mode -eq '--restore-quota2') {
    $previewStage = 'restore-quota-write'
    $null = Invoke-RestMethod -Method Patch -Uri ($previewApi + '/config/auth') -Headers $previewHeaders -ContentType 'application/json' -Body '{"rate_limit_email_sent":2}' -MaximumRedirection 0
  }
  if ($Mode -ne '--inspect') {
    $previewStage = 'auth-verify'
    $afterConfig = Invoke-RestMethod -Method Get -Uri ($previewApi + '/config/auth') -Headers $previewHeaders -MaximumRedirection 0
    $expectedRate = if ($Mode -eq '--capture-quota30') { 30 } else { 2 }
    if ($afterConfig.rate_limit_email_sent -ne $expectedRate) { throw 'Quota verification failed' }
    foreach ($property in $previewConfig.PSObject.Properties) {
      if ($property.Name -like 'rate_limit_*' -and $property.Name -ne 'rate_limit_email_sent' -and
          $afterConfig.($property.Name) -ne $property.Value) { throw 'Other rate limit changed' }
    }
    $previewConfig = $afterConfig
  }
  $safeRates = [ordered]@{}
  foreach ($property in $previewConfig.PSObject.Properties) {
    if ($property.Name -like 'rate_limit_*' -and $property.Value -is [ValueType]) { $safeRates[$property.Name] = $property.Value }
  }
  [ordered]@{
    projectRef = $previewRef; organizationId = $previewOrg; operation = $Mode;
    capturedAt = [DateTime]::UtcNow.ToString('o');
    signupDisabled = $previewConfig.disable_signup;
    siteIsLoopback = ($previewConfig.site_url -eq 'http://localhost:3000');
    emailConfirmationRequired = ($previewConfig.mailer_autoconfirm -eq $false);
    anonymousSigninsDisabled = ($previewConfig.external_anonymous_users_enabled -eq $false);
    captureHookEnabled = $previewConfig.hook_send_email_enabled;
    captureHookUriMatches = ($previewConfig.hook_send_email_uri -eq 'pg-functions://postgres/preview_auth/capture_email');
    customSmtpConfigured = (-not [string]::IsNullOrEmpty($previewConfig.smtp_host));
    beforeEmailQuota = $beforeRate; rateLimits = $safeRates
  } | ConvertTo-Json -Depth 4
} catch {
  # Never echo exception bodies: a management response can contain private config.
  [Console]::Error.WriteLine('Docked Preview management operation failed at ' + $previewStage + '. No credential or private response emitted.')
  exit 1
} finally {
  if ($null -ne $previewHeaders) { $previewHeaders.Clear() }
  $previewBearer = $null
}
