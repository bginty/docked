// Review only. Never print or use the signed download capability.
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const out = "docs/qa/premium-completion";
const raw = JSON.parse(readFileSync(out + "/secret-scan-raw.json"));
const prior = JSON.parse(
  readFileSync("docs/qa/marketplace-release/secret-review.json"),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.deepEqual(
  raw.findings.map((x) => x.file).sort(),
  [...prior.reviewed.map((x) => x.file), prior.capability.file].sort(),
  "Unexpected findings require separate review",
);
const reviewed = prior.reviewed.map((r) => ({
  file: r.file,
  classification: r.classification,
  reason: r.reason,
  sha256: hash(readFileSync(r.file)),
  unchangedSinceReview: hash(readFileSync(r.file)) === r.sha256,
}));
const note = readFileSync(prior.capability.file);
assert.equal(hash(note), prior.capability.fileSha256);
const token = note
  .toString()
  .match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
assert.ok(token);
const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const exposure = tracked.filter((f) =>
  readFileSync(f).includes(Buffer.from(token)),
);
assert.equal(exposure.length, 0, "Capability present in tracked file");
let scanned = 0;
function inspect(path) {
  if (!existsSync(path)) return;
  for (const e of readdirSync(path)) {
    const f = path + "/" + e;
    if (statSync(f).isDirectory()) inspect(f);
    else {
      scanned++;
      assert.ok(
        !readFileSync(f).includes(Buffer.from(token)),
        "Capability in review/export surface",
      );
    }
  }
}
for (const p of [
  "src",
  "public",
  "config",
  out,
  "tmp/marketplace-release-build/.next/static",
])
  inspect(p);
const history = execFileSync(
  "git",
  ["log", "--all", "--format=%h", "--", prior.capability.file],
  { encoding: "utf8" },
).trim();
assert.equal(history, "");
writeFileSync(
  out + "/secret-review.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      rawStatus: raw.status,
      rawFindings: raw.findings.length,
      newFindingPaths: [],
      scannerUnchanged: !execFileSync(
        "git",
        ["diff", "--", "scripts/check-secrets.mjs"],
        { encoding: "utf8" },
      ).trim(),
      exclusionsAdded: false,
      reviewed,
      capability: {
        ...prior.capability,
        expired: payload.exp * 1000 < Date.now(),
        expires: new Date(payload.exp * 1000).toISOString(),
        trackedHistory: false,
        trackedExposureMatches: 0,
        remoteUsed: false,
        remoteValidity: "NOT_TESTED",
        disposition:
          "Uncommitted and untouched. No inspected exposure found. External sharing cannot be ruled out. If shared unintentionally, owner must revoke only this APK download link; no evidence currently requiring unrelated credential rotation.",
      },
      scanned,
      decision: "REVIEWED_WITH_NINE_RAW_FINDINGS; not a raw scanner pass",
    },
    null,
    2,
  ),
);
console.log(
  "Reviewed nine existing findings; capability untouched, never used, and absent from inspected tracked/export surfaces.",
);
