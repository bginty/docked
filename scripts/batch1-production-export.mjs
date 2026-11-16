/** Export and verify the approved application only; no hosted mutation. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const file = "docs/qa/batch1-hosted-release-20261116/production-package.json";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const bytes = readFileSync(file);
assert.equal(
  hash(bytes),
  "954e467e9e0a5a6e15db154eb03a055913823e067248470f556cf20f31092436",
);
const p = JSON.parse(bytes),
  root = path.resolve(
    "private-data/batch1-production-execution-20261116/source",
  );
execFileSync(
  process.execPath,
  ["scripts/batch1-hosted-release-package.mjs", "verify"],
  { windowsHide: true, stdio: "pipe" },
);
assert(
  !existsSync(root),
  "Export already exists; verify instead of replacing it",
);
const buffers = execFileSync("git", ["cat-file", "--batch"], {
  input:
    p.sourceFiles.map((f) => p.sourceCommit + ":" + f.file).join("\n") + "\n",
  windowsHide: true,
  maxBuffer: 256e6,
});
let offset = 0;
for (const f of p.sourceFiles) {
  const end = buffers.indexOf(10, offset),
    header = buffers.subarray(offset, end).toString();
  assert.match(header, /^[a-f0-9]+ blob \d+$/);
  const size = Number(header.split(" ")[2]),
    b = buffers.subarray(end + 1, end + 1 + size);
  assert.equal(hash(b), f.sha256, f.file);
  const target = path.resolve(root, f.file);
  assert(target.startsWith(root + path.sep));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, b, { flag: "wx" });
  assert.equal(hash(readFileSync(target)), f.sha256);
  offset = end + size + 2;
}
assert.equal(offset, buffers.length);
mkdirSync(root + "/.vercel", { recursive: true });
writeFileSync(
  root + "/.vercel/project.json",
  JSON.stringify({
    projectId: p.projectId,
    orgId: p.teamId,
    projectName: "docked-production",
  }),
  { flag: "wx" },
);
const report = {
  at: new Date().toISOString(),
  source: p.sourceCommit,
  sourceTree: p.sourceTree,
  packageSha256: hash(bytes),
  verifiedApplicationFiles: p.sourceFiles.length,
  node: JSON.parse(readFileSync(root + "/package.json")).engines.node,
  hostedWrites: 0,
};
writeFileSync(
  "docs/qa/batch1-production-execution-20261116/source-export.json",
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(report));
