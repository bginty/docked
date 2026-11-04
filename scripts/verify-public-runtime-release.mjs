/** Read-only staged/live verification. No purchase, signup or customer mutation. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
const out = "docs/qa/public-promotion-20261105",
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const receipt = JSON.parse(
  await fs.readFile(out + "/deployment-submitted.json", "utf8"),
);
const live = process.argv.includes("--live");
assert.equal(receipt.commit, "4a44b269a211f9893d7d48d1b150bfea11f984d4");
assert.equal(receipt.customerNbaVisible, false);
assert.equal(receipt.memberGoogleTest, false);
const policyHash = createHash("sha256")
  .update(
    execFileSync(
      "git",
      ["show", receipt.commit + ":config/launch-policy-content.json"],
      { windowsHide: true },
    ),
  )
  .digest("hex");
assert.equal(
  policyHash,
  "9655ebb36bd5410ff07e18001d26c999ab51d4f85345252aab9ca9b293e89b93",
);
const auth = JSON.parse(
  await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
);
const target = live ? "https://docked.com.au" : receipt.url;
const r = await fetch(
  "https://api.vercel.com/v13/deployments/" +
    new URL(target).hostname +
    "?teamId=team_tf6xweKKyVCj9bTppUKttJ4l",
  { headers: { Authorization: "Bearer " + auth.token } },
);
assert(r.ok, "Deployment inspection unavailable");
const d = await r.json();
assert.equal(d.projectId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(d.meta.githubCommitSha, receipt.commit);
if (d.readyState !== "READY") {
  console.log(JSON.stringify({ state: d.readyState }));
  process.exit(2);
}
const checks = [];
for (const [route, status] of [
  ["/api/beta-release", 200],
  ["/app/login", 200],
  ["/privacy", 200],
  ["/refund-policy", 200],
  ["/retention", 200],
  ["/commercial-policy", 200],
  ["/account-deletion", 200],
  ["/api/store/google/commercial", 403],
  ["/api/public-gameplay?sport=nfl", 403],
  ["/api/public-gameplay?sport=basketball", 403],
  ["/api/mobile/capabilities", 401],
  ["/api/workspace-wallet", 403],
  ["/api/store/apple/test", 404],
]) {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
      "curl",
      route,
      "--deployment",
      target,
      "--",
      "--silent",
      "--show-error",
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
      timeout: 55000,
      maxBuffer: 3e6,
    },
  );
  const actual = Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
  assert.equal(actual, status, route);
  if (route === "/api/beta-release") {
    const b = JSON.parse(stdout.split("\nDOCKED_STATUS:")[0]);
    assert.equal(b.commit, receipt.commit);
    assert.equal(b.publicRegistration, false);
  }
  if (route === "/app/login") assert(stdout.includes("Welcome back"));
  if (
    ["/privacy", "/refund-policy", "/retention", "/commercial-policy"].includes(
      route,
    )
  )
    assert(stdout.includes("2026-11-02-release-preparation-v2"));
  checks.push({ route, status: actual });
}
const report = {
  at: new Date().toISOString(),
  live,
  id: d.id,
  commit: receipt.commit,
  url: target,
  policyHash,
  checks,
  passed: true,
  authenticatedAcceptance: false,
  customerMutations: 0,
};
await fs.writeFile(
  out + "/" + (live ? "live" : "candidate") + "-verified.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({ passed: true, live, id: d.id, checks: checks.length }),
);
