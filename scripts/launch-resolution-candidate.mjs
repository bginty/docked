/** Read-only closed-gate candidate and live release identity checks. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST";
const auth = JSON.parse(
  await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
);
const r = JSON.parse(
  await fs.readFile(
    "docs/qa/commercial-billing-20261101/candidate/deployment-submitted.json",
    "utf8",
  ),
);
async function inspect(host) {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${host}?teamId=${team}`,
    { headers: { Authorization: `Bearer ${auth.token}` }, redirect: "error" },
  );
  assert(response.ok);
  const d = await response.json();
  assert.equal(d.projectId, project);
  return {
    id: d.id,
    url: d.url,
    state: d.readyState,
    commit: d.meta.githubCommitSha,
  };
}
const candidate = await inspect(new URL(r.url).hostname);
if (candidate.state !== "READY") {
  console.log(JSON.stringify(candidate));
  process.exit(0);
}
assert.equal(candidate.commit, r.commit);
const live = await inspect("docked.com.au");
assert.equal(live.commit, "053848ed67946fdd727a5c1d8547272d383c9470");
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const checks = [];
for (const [route, status] of [
  ...[
    "/api/store/google/commercial",
    "/api/admin/commercial-billing",
    "/api/workspace-wallet",
    ...["nfl", "afl", "nrl", "basketball"].map(
      (s) => "/api/public-gameplay?sport=" + s,
    ),
  ].map((p) => [p, 403]),
  ...[
    "/privacy",
    "/refund-policy",
    "/retention",
    "/commercial-policy",
    "/account-deletion",
  ].map((p) => [p, 200]),
]) {
  const x = await promisify(execFile)(
    process.execPath,
    [
      cli,
      "curl",
      route,
      "--deployment",
      r.url,
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
        process.cwd() + "/private-data/nba-production/" + r.commit + "/source",
      env: { ...process.env, VERCEL_TOKEN: auth.token },
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 2e6,
    },
  );
  const observed = Number(x.stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
  assert.equal(observed, status, route);
  if (status === 403) assert(/cache-control:[^\r\n]*no-store/i.test(x.stdout));
  if (status === 200 && route !== "/account-deletion")
    assert(x.stdout.includes("2026-11-02-release-preparation-v2"));
  checks.push({
    route,
    status: observed,
    ...(status === 403 ? { noStore: true } : {}),
  });
  console.log(route, observed);
}
await fs.writeFile(
  "docs/qa/launch-resolution-20261102/closed-candidate.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      candidate,
      live,
      checks,
      authenticatedMember: false,
      productionMutations: 0,
      promoted: false,
    },
    null,
    2,
  ),
);
