// Deployment protection authentication is distinct from member authentication.
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au",
  root = process.cwd();
const evidence =
  process.env.NBA_RELEASE_EVIDENCE ?? "docs/qa/nba-private-beta-live";
assert(evidence.startsWith("docs/qa/") && !evidence.includes(".."));
const receipt = JSON.parse(
  readFileSync(evidence + "/deployment-submitted.json", "utf8"),
);
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const live = process.argv[2] === "live",
  checks = [];
const auth = JSON.parse(
  readFileSync(main + "/private-data/vercel-cli/auth.json", "utf8"),
);
for (const path of [
  "/api/beta-release",
  "/api/status",
  "/api/nba-beta",
  "/api/nba-beta?view=state",
  "/api/fantasy/standings",
  "/api/admin/sports-sandbox?sport=basketball",
  "/app/login",
  "/fantasy/play?sport=basketball",
]) {
  let status, body;
  if (live) {
    const r = await fetch("https://docked.com.au" + path, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(40000),
    });
    status = r.status;
    body = await r.text();
  } else {
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
        "--max-time",
        "40",
        "--write-out",
        "\nDOCKED_STATUS:%{http_code}",
      ],
      {
        cwd:
          root + "/private-data/nba-production/" + receipt.commit + "/source",
        env: { ...process.env, VERCEL_TOKEN: auth.token },
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 4e6,
      },
    );
    const match = r.stdout.match(/\nDOCKED_STATUS:(\d+)\s*$/);
    assert(match);
    status = Number(match[1]);
    body = r.stdout.slice(0, match.index);
  }
  if (path === "/api/beta-release") {
    const data = JSON.parse(body);
    assert.equal(status, 200);
    assert.equal(data.commit, receipt.commit);
    assert.equal(data.publicRegistration, false);
  } else if (path === "/api/status") {
    assert.equal(status, 200);
    assert.equal(JSON.parse(body).registration, "closed");
  } else if (path.startsWith("/api/"))
    assert([401, 403].includes(status), `${path}: ${status}`);
  else {
    assert([200, 303, 307].includes(status));
    assert(!body.includes("FUNCTION_INVOCATION_FAILED"));
  }
  checks.push({ path, status, passed: true });
}
const report = {
  at: new Date().toISOString(),
  commit: receipt.commit,
  environment: live ? "live-domain" : "protected-production-candidate",
  checks,
  passed: true,
  authenticatedMemberTesting: false,
};
writeFileSync(
  evidence + "/" + (live ? "live-http" : "candidate-http") + ".json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
