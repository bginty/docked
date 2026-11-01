// Read-only post-migration probes. Deployment protection is not member Auth.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const evidence = "docs/qa/approved-production-20261102";
const receipt = JSON.parse(
  await readFile(evidence + "/candidate/deployment-submitted.json", "utf8"),
);
const auth = JSON.parse(
  await readFile(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
    "utf8",
  ),
);
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const paths = [
  "/api/store/google/commercial",
  "/api/admin/commercial-billing",
  "/api/workspace-wallet",
  ...["nfl", "afl", "nrl", "basketball"].map(
    (s) => "/api/public-gameplay?sport=" + s,
  ),
];
const checks = [];
for (const path of paths) {
  const r = await promisify(execFile)(
    process.execPath,
    [
      cli,
      "curl",
      path,
      "--deployment",
      receipt.url,
      "--",
      "--silent",
      "--show-error",
      "--include",
      "--max-time",
      "40",
      "--write-out",
      "\nDOCKED_STATUS:%{http_code}",
    ],
    {
      cwd:
        process.cwd() +
        "/private-data/nba-production/" +
        receipt.commit +
        "/source",
      env: { ...process.env, VERCEL_TOKEN: auth.token },
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 2e6,
    },
  );
  const status = Number(r.stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
  assert.equal(status, 403, path + " must remain disabled");
  assert(
    /cache-control:[^\r\n]*no-store/i.test(r.stdout),
    path + " must not be cached",
  );
  checks.push({ path, status, noStore: true });
}
const policies = [];
for (const path of [
  "/privacy",
  "/refund-policy",
  "/retention",
  "/commercial-policy",
  "/account-deletion",
]) {
  const r = await fetch("https://docked.com.au" + path, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const body = await r.text();
  assert.equal(r.status, 200, path);
  assert(!body.includes("FUNCTION_INVOCATION_FAILED"));
  policies.push({
    path,
    status: r.status,
    releasePreparationVersionPresent: body.includes(
      "2026-11-01-release-preparation-v1",
    ),
  });
}
const result = {
  at: new Date().toISOString(),
  candidate: receipt.url,
  sourceCommit: receipt.commit,
  memberAuthenticated: false,
  mutations: 0,
  checks,
  policies,
};
await writeFile(
  evidence + "/post-migration-http.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
