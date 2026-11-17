import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
/** Existing Credential Manager secret remains only in process memory. */
export function managementToken(root = process.cwd()) {
  const helper = path
    .join(root, "scripts/hosted-preview/auth-management.ps1")
    .replaceAll("'", "''");
  const command = `$ErrorActionPreference='Stop'\n$h=Get-Content -LiteralPath '${helper}' -Raw\n$d=[regex]::Match($h, "(?s)Add-Type -TypeDefinition @'\\r?\\n(.*?)\\r?\\n'@").Groups[1].Value\nif ([string]::IsNullOrWhiteSpace($d)) { throw 'Reader unavailable' }\nAdd-Type -TypeDefinition $d | Out-Null\n[Console]::Out.Write([DockedPreviewCredential]::Read())\n`;
  const token = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "-"],
    {
      input: command,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    },
  ).trim();
  assert(/^sbp_[a-zA-Z0-9_-]+$/.test(token));
  return token;
}
