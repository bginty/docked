/** OFF-only watchdog. No shared settings change without explicit --watch and a
 * matching private approval record. Default --check performs no network request. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  validatePhoneWindow,
  watchPhoneWindow,
} from "./lib/phone-window-shutdown.mjs";

const [mode, directory] = process.argv.slice(2);
const root = process.cwd();
const dir = path.resolve(directory ?? "");
assert(["--check", "--watch"].includes(mode));
assert(dir.startsWith(path.resolve(root, "private-data") + path.sep));
const bytes = readFileSync(path.join(dir, "phone-window.json"));
const plan = JSON.parse(bytes);
const digest = createHash("sha256").update(bytes).digest("hex");
validatePhoneWindow(plan);
if (mode === "--check") {
  console.log(
    JSON.stringify({
      planSha256: digest,
      projectRef: plan.projectRef,
      valid: true,
      networkRequests: 0,
    }),
  );
} else {
  const authority = JSON.parse(
    readFileSync(path.join(dir, "phone-window-authority.private.json"), "utf8"),
  );
  assert(authority.approved === true && authority.planSha256 === digest);
  assert(Date.parse(authority.approvedAt) <= Date.now());
  assert(Date.parse(authority.expiresAt) > Date.parse(plan.until));
  assert(
    Date.parse(authority.expiresAt) - Date.parse(authority.approvedAt) <=
      86400000,
  );
  assert(
    !existsSync(path.join(dir, "phone-window-result.json")),
    "Never reuse a completed session",
  );
  let token;
  let interrupted = false;
  const stop = () => {
    interrupted = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    // Existing Windows Credential Manager reader; no credential is an argument,
    // environment variable, report field, log message or committed file.
    const helper = path
      .join(root, "scripts/hosted-preview/auth-management.ps1")
      .replace(/'/g, "''");
    const command = `$ErrorActionPreference='Stop'\n$h=Get-Content -LiteralPath '${helper}' -Raw\n$d=[regex]::Match($h, "(?s)Add-Type -TypeDefinition @'\\r?\\n(.*?)\\r?\\n'@").Groups[1].Value\nif ([string]::IsNullOrWhiteSpace($d)) { throw 'Reader unavailable' }\nAdd-Type -TypeDefinition $d | Out-Null\n[Console]::Out.Write([DockedPreviewCredential]::Read())\n`;
    token = execFileSync(
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
    const request = async (ref, suffix, payload) => {
      assert(ref === plan.projectRef);
      const response = await fetch(
        "https://api.supabase.com/v1/projects/" + ref + suffix,
        {
          method: payload ? "PATCH" : "GET",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) throw Error("Provider request unavailable");
      return response.json();
    };
    const result = await watchPhoneWindow(
      plan,
      {
        project: (ref) => request(ref, ""),
        config: (ref) => request(ref, "/config/auth"),
        disable: (ref, payload) => request(ref, "/config/auth", payload),
      },
      {
        stopRequested: () => interrupted || existsSync(path.join(dir, "STOP")),
        onReady: () => {
          writeFileSync(
            path.join(dir, "phone-window-armed.json"),
            JSON.stringify({
              at: new Date().toISOString(),
              planSha256: digest,
            }),
            { flag: "wx" },
          );
          console.log(
            "OFF-only watchdog armed; this does not authorise enabling Phone or sending SMS.",
          );
        },
      },
    );
    writeFileSync(
      path.join(dir, "phone-window-result.json"),
      JSON.stringify(
        { at: new Date().toISOString(), planSha256: digest, ...result },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(result));
    if (result.safetyFailure) process.exitCode = 1;
  } catch {
    const resultFile = path.join(dir, "phone-window-result.json");
    if (!existsSync(resultFile)) {
      writeFileSync(
        resultFile,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            planSha256: digest,
            closureVerified: false,
            acceptanceComplete: false,
            action:
              "Independently verify provider OFF in its console before ending the session",
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
    }
    console.error(
      "Phone watchdog stopped without complete verified acceptance. Check provider OFF privately; no credentials emitted.",
    );
    process.exitCode = 1;
  } finally {
    token = undefined;
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
