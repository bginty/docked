/** Re-run baseline UI diagnostics. Product sources are never changed. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const out = "docs/qa/overnight-audit-20261115";
const temp = "private-data/overnight-audit-20261115";
const baseline = "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef";
assert.equal(
  execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      baseline,
      "--",
      "src",
      "supabase",
      "config",
      "android",
      "package.json",
      "package-lock.json",
    ],
    { encoding: "utf8", windowsHide: true },
  ).trim(),
  "",
  "Only the actual Production product source is profiled; diagnostic-only commits are allowed",
);
const jobs = [
  [
    "collection",
    "scripts/owned-collection-browser.ts",
    "docs/qa/owned-collection",
  ],
  [
    "member-surfaces",
    "scripts/member-surfaces-browser.ts",
    "docs/qa/member-surfaces",
  ],
  ["weekly-core", "scripts/weekly-core-browser.ts", "docs/qa/weekly-core"],
  [
    "social-admin",
    "scripts/prelaunch-experience-browser.ts",
    "docs/qa/prelaunch",
  ],
];
const results = [];
for (const [name, file, oldOutput] of jobs) {
  let source = fs.readFileSync(file, "utf8");
  assert(
    !source.includes("process.env.DATABASE_URL"),
    "No hosted database fixture",
  );
  source = source
    .replaceAll('from "../', 'from "../../')
    .replaceAll(oldOutput, out + "/" + name);
  const generated = path.join(temp, name + ".ts");
  fs.writeFileSync(generated, source);
  const started = new Date().toISOString();
  console.log(JSON.stringify({ name, status: "running", source: file }));
  const run = spawnSync(process.execPath, ["--import", "tsx", generated], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 600000,
    maxBuffer: 8e6,
  });
  fs.writeFileSync(
    path.join(temp, name + ".log"),
    (run.stdout ?? "") + "\n" + (run.stderr ?? ""),
  );
  const row = {
    name,
    source: file,
    started,
    finished: new Date().toISOString(),
    exitCode: run.status,
    error: run.error?.message,
    productChanges: false,
    productionWrites: 0,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  fs.writeFileSync(
    out + "/journey-runner.json",
    JSON.stringify(
      {
        baseline,
        environment:
          "Loopback HTTP fixtures, real React components; synthetic members and transport. Failed assertions require triage before being labelled product defects.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
