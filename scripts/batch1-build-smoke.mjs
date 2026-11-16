/** Start the standalone artifact with a credential-free, loopback-only environment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const directory = resolve(".next/standalone");
assert(existsSync(directory + "/certs/supabase-prod-ca-2021.crt"));
const requireStandalone = createRequire(directory + "/server.js");
for (const module of ["next", "react", "react-dom", "postgres"])
  assert(requireStandalone.resolve(module));
const env = Object.fromEntries(
  ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "USERPROFILE"]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
const origin = "http://127.0.0.1:3067";
Object.assign(env, {
  APP_ENV: "preview",
  SITE_URL: origin,
  PORT: "3067",
  HOSTNAME: "127.0.0.1",
  SENDING_ENABLED: "false",
  REGISTRATION_ENABLED: "false",
});
const child = spawn(process.execPath, [directory + "/server.js"], {
  env,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (b) => {
  output += b;
});
child.stderr.on("data", (b) => {
  output += b;
});
try {
  const start = Date.now();
  while (!output.includes("Ready in")) {
    if (child.exitCode !== null || Date.now() - start > 30000)
      throw Error("Standalone startup failed: " + output);
    await new Promise((r) => setTimeout(r, 100));
  }
  const checks = [];
  for (const path of ["/privacy", "/commercial-policy", "/app/login"]) {
    const response = await fetch(origin + path, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    assert.equal(response.status, 200, path);
    assert(!body.includes("DOCKED_BUILD_CANARY_"));
    checks.push({ path, status: response.status });
  }
  const denied = await fetch(origin + "/api/test-wallet?view=packs", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(denied.status, 403);
  checks.push({ path: "/api/test-wallet cross-origin", status: denied.status });
  assert(!/Cannot find module|MODULE_NOT_FOUND|Module not found/.test(output));
  const result = {
    at: new Date().toISOString(),
    node: process.version,
    passed: true,
    scope:
      "Local standalone production build, credential-free loopback; not Vercel or installed Android",
    caTraced: true,
    moduleResolution: true,
    checks,
    environmentContainsDatabaseOrProviderCredentials: false,
    productionWrites: 0,
    buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
  };
  writeFileSync(
    "docs/qa/batch1-pack-phone-20261116/build-smoke.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  child.kill();
}
