// Refusal tests never provide approved:true and therefore never open a hosted client.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { readExactPackage } from "./lib/v31-exact-package.mjs";
const { digest } = readExactPackage();
const privateDir = "private-data/v31-prelaunch-execution-20261111";
mkdirSync(privateDir, { recursive: true });
const invalid = `${privateDir}/refused-approval.fixture.json`;
const template = JSON.parse(
  readFileSync("config/operations/v31-backend-approval.template.json", "utf8"),
);
writeFileSync(
  invalid,
  JSON.stringify({ ...template, approved: false, packageSha256: digest }),
);
const results = [];
for (const [script, args] of [
  ["scripts/v31-approved-backend-migrations.mjs", ["apply"]],
  ["scripts/v31-controlled-backend.mjs", ["stage"]],
  ["scripts/v31-controlled-backend.mjs", ["promote"]],
  [
    "scripts/v31-approved-backend-migrations.mjs",
    ["apply", `--approval=${invalid}`],
  ],
  ["scripts/v31-controlled-backend.mjs", ["stage", `--approval=${invalid}`]],
  ["scripts/v31-controlled-backend.mjs", ["prepare", "--fixture-commerce"]],
]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  assert.notEqual(r.status, 0);
  assert.match(
    r.stderr,
    /Exact founder approval file required|false !== true|AssertionError|package excludes that execution scope/,
  );
  results.push({
    script,
    mode: args[0],
    approved: false,
    refusedBeforeHostedClient: true,
  });
}
const report = {
  at: new Date().toISOString(),
  packageSha256: digest,
  cases: results,
  productionWrites: 0,
};
writeFileSync(
  "docs/qa/v31-prelaunch-execution-20261111/database/approval-refusals.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
