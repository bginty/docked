/** Verify the one-file owner-approved policy release before promotion. No writes to Vercel. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST";
const base = "053848ed67946fdd727a5c1d8547272d383c9470";
const hash = "9655ebb36bd5410ff07e18001d26c999ab51d4f85345252aab9ca9b293e89b93";
const receipt = JSON.parse(
  await fs.readFile(
    "docs/qa/policy-publication-20261102/deployment-submitted.json",
    "utf8",
  ),
);
assert.equal(receipt.memberGoogleTest, false);
assert.equal(receipt.customerNbaVisible, false);
assert.equal(receipt.fixtureCommerce, true);
const files = execFileSync(
  "git",
  ["diff", "--name-only", base, receipt.commit],
  { encoding: "utf8", windowsHide: true },
)
  .trim()
  .split("\n");
assert.deepEqual(files, ["config/launch-policy-content.json"]);
const bytes = execFileSync(
  "git",
  ["show", receipt.commit + ":config/launch-policy-content.json"],
  { windowsHide: true },
);
assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
const auth = JSON.parse(
  await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
);
const api = async (id) => {
  const r = await fetch(
    "https://api.vercel.com/v13/deployments/" + id + "?teamId=" + team,
    { headers: { Authorization: "Bearer " + auth.token }, redirect: "error" },
  );
  assert(r.ok);
  return r.json();
};
const candidate = await api(new URL(receipt.url).hostname);
assert.equal(candidate.projectId, project);
assert.equal(candidate.meta.githubCommitSha, receipt.commit);
if (candidate.readyState !== "READY") {
  console.log(
    JSON.stringify({ state: candidate.readyState, id: candidate.id }),
  );
  process.exitCode = 2;
} else {
  const live = await api("docked.com.au");
  assert.equal(live.meta.githubCommitSha, base);
  const cli =
    "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
  const checks = [];
  for (const route of [
    "/privacy",
    "/refund-policy",
    "/commercial-policy",
    "/retention",
    "/account-deletion",
    "/api/beta-release",
  ]) {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        cli,
        "curl",
        route,
        "--deployment",
        receipt.url,
        "--",
        "--silent",
        "--show-error",
        "--max-time",
        "45",
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
        timeout: 65000,
        maxBuffer: 3e6,
      },
    );
    const status = Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
    assert.equal(status, 200, route);
    if (route === "/api/beta-release") {
      const body = JSON.parse(stdout.split("\nDOCKED_STATUS:")[0]);
      assert.equal(body.publicRegistration, false);
      assert.equal(body.commit, receipt.commit);
    } else if (route !== "/account-deletion")
      assert(stdout.includes("2026-11-02-release-preparation-v2"), route);
    checks.push({
      route,
      status,
      approvedVersion:
        route === "/account-deletion" || route === "/api/beta-release"
          ? null
          : "2026-11-02-release-preparation-v2",
    });
  }
  const evidence = {
    at: new Date().toISOString(),
    candidate: { id: candidate.id, url: receipt.url, commit: receipt.commit },
    baseline: { id: live.id, commit: base },
    changedFiles: files,
    approvedPolicySha256: hash,
    checks,
    publicRegistration: false,
    googleTestWindow: false,
    paymentActivation: false,
    customerNbaVisible: false,
    productionMutations: 0,
    passed: true,
  };
  await fs.writeFile(
    "docs/qa/policy-publication-20261102/candidate-verified.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({ passed: true, checked: checks.length, id: candidate.id }),
  );
}
