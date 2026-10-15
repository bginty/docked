import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = "docs/qa/social-live-release";
const raw = JSON.parse(
  readFileSync(root + "/secret-scan-raw.json", "utf8").replace(/^\uFEFF/, ""),
);
const prior = JSON.parse(
  readFileSync("docs/qa/social-upgrade/secret-review.json"),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.deepEqual(
  raw.findings.map((x) => x.file).sort(),
  [...prior.reviewed.map((x) => x.file), prior.capability.file].sort(),
);
const reviewed = prior.reviewed.map((item) => {
  const bytes = readFileSync(item.file);
  const unchanged = hash(bytes) === item.sha256;
  if (!unchanged) {
    assert.equal(item.file, "tests/platform/production-release-tools.test.ts");
    const old = execFileSync("git", ["show", "3b6cbe25:" + item.file]);
    const updated = old
      .toString()
      .replace(
        '      "src/core/hosted-beta.mjs",',
        '      "src/core/hosted-beta.mjs",\n      "src/core/private-preview.mjs",\n      "config/hosted-preview.json",',
      );
    assert.equal(
      bytes.toString().replaceAll("\r\n", "\n"),
      updated.replaceAll("\r\n", "\n"),
    );
  }
  return {
    file: item.file,
    sha256: hash(bytes),
    unchanged,
    review: unchanged
      ? "Prior fixture/generated match unchanged"
      : "Only two dependency fixture paths added; synthetic credential unchanged",
  };
});
const token = readFileSync(prior.capability.file, "utf8").match(
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
)?.[0];
assert.ok(token);
const revocation = JSON.parse(
  readFileSync("docs/qa/social-visual-preview/apk-capability-revocation.json"),
);
assert.equal(revocation.capabilitySha256, hash(token));
assert.equal(revocation.oldPathAbsent, true);
for (const f of execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean))
  assert.equal(
    readFileSync(f).includes(token),
    false,
    "Signed capability in tracked file",
  );
const report = {
  at: new Date().toISOString(),
  rawStatus: raw.status,
  findings: raw.findings.length,
  newFindings: 0,
  reviewed,
  obsoleteCapabilityRevoked: true,
  capabilityInTrackedFiles: false,
  exclusionsAdded: false,
};
writeFileSync(root + "/secret-review.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    findings: report.findings,
    newFindings: 0,
    obsoleteCapabilityRevoked: true,
  }),
);
