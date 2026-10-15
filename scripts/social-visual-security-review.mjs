import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "docs/qa/social-visual-preview";
const raw = JSON.parse(readFileSync(root + "/secret-scan-raw.json"));
const prior = JSON.parse(
  readFileSync("docs/qa/social-upgrade/secret-review.json"),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.deepEqual(
  raw.findings.map((x) => x.file).sort(),
  [...prior.reviewed.map((x) => x.file), prior.capability.file].sort(),
);
const reviewed = prior.reviewed.map((r) => ({
  ...r,
  unchangedSinceReview: hash(readFileSync(r.file)) === r.sha256,
}));
assert.ok(reviewed.every((x) => x.unchangedSinceReview));
const text = readFileSync(prior.capability.file, "utf8");
const token = text.match(
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
)?.[0];
assert.ok(token);
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
assert.equal(files.filter((f) => readFileSync(f).includes(token)).length, 0);
let checked = 0;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const path = dir + "/" + name;
    if (statSync(path).isDirectory()) scan(path);
    else {
      checked++;
      assert.ok(
        !readFileSync(path).includes(token),
        "Capability in publishable surface",
      );
    }
  }
}
for (const dir of [
  "src",
  "public",
  "config",
  root,
  "tmp/marketplace-release-build/.next/static",
])
  scan(dir);
const revocation = JSON.parse(
  readFileSync(root + "/apk-capability-revocation.json"),
);
assert.equal(revocation.capabilitySha256, hash(token));
assert.equal(revocation.oldPathAbsent, true);
const output = {
  at: new Date().toISOString(),
  rawStatus: raw.status,
  rawFindings: raw.findings.length,
  newFindingPaths: [],
  reviewed,
  capability: {
    file: prior.capability.file,
    revoked: true,
    retainedPrivately: true,
    oldPathAbsent: true,
    used: false,
  },
  publishedFilesChecked: checked,
  scannerUnchanged: !execFileSync(
    "git",
    ["diff", "--", "scripts/check-secrets.mjs"],
    { encoding: "utf8" },
  ).trim(),
  exclusionsAdded: false,
};
writeFileSync(root + "/secret-review.json", JSON.stringify(output, null, 2));
console.log(
  JSON.stringify({
    findings: raw.findings.length,
    reviewed: reviewed.length,
    obsoleteCapabilityRevoked: true,
    publishedCapabilityLeaks: 0,
  }),
);
