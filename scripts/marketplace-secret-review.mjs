import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  loadKnownSecrets,
  auditPreviewTargets,
} from "./audit-preview-secrets.mjs";
const root = "docs/qa/marketplace-release";
const prior = JSON.parse(
  readFileSync("docs/qa/marketplace-authenticated/secret-review.json"),
);
const raw = JSON.parse(readFileSync(root + "/secret-scan-raw.json"));
assert.deepEqual(
  raw.findings.map((x) => x.file).sort(),
  [...prior.reviewed.map((x) => x.file), prior.additionalFinding.file].sort(),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const reviewed = prior.reviewed.map((r) => ({
  ...r,
  sha256: hash(readFileSync(r.file)),
  priorHash: r.sha256,
}));
const note = readFileSync(prior.additionalFinding.file);
assert.equal(
  hash(note),
  prior.additionalFinding.fileSha256,
  "Download note must remain untouched",
);
const token = note
  .toString()
  .match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
assert.ok(token);
const payload = JSON.parse(
  Buffer.from(token.split(".")[1], "base64url").toString(),
);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const exposed = tracked.filter((f) =>
  readFileSync(f).includes(Buffer.from(token)),
);
assert.equal(
  exposed.length,
  0,
  "Signed capability must not enter tracked source",
);
assert.equal(
  execFileSync(
    "git",
    ["log", "--all", "--format=%h", "--", prior.additionalFinding.file],
    { encoding: "utf8" },
  ).trim(),
  "",
);
const known = await loadKnownSecrets();
const runtime = JSON.parse(
  readFileSync("private-data/production/beta-runtime-connection.json"),
);
const audit = await auditPreviewTargets(
  [
    "src",
    "public",
    "config",
    "supabase/functions/nfl-postgame",
    "docs/qa/marketplace-authenticated",
    "docs/qa/marketplace-operational",
    "docs/qa/marketplace-phase-one",
    "tmp/marketplace-release-build/.next/static",
    root,
  ],
  [
    ...known.values,
    runtime.databaseUrl,
    decodeURIComponent(new URL(runtime.databaseUrl).password),
    token,
  ],
);
assert.equal(audit.findings.length, 0);
assert.equal(audit.errors.length, 0);
const report = {
  at: new Date().toISOString(),
  rawStatus: raw.status,
  rawFindings: raw.findings.length,
  scannerUnchanged: true,
  exclusionsAdded: false,
  reviewed,
  capability: {
    file: prior.additionalFinding.file,
    fileSha256: hash(note),
    expires: new Date(payload.exp * 1000).toISOString(),
    expired: payload.exp * 1000 < Date.now(),
    trackedHistory: false,
    trackedExposureMatches: 0,
    remoteUsed: false,
    remoteValidity: "NOT_TESTED",
    disposition:
      "Preserved uncommitted. No exposure found in inspected source/public/bundles/reports. Prior sharing outside this inspection cannot be ruled out. No evidence requiring revocation; not a release blocker.",
  },
  publishedBoundaryAudit: audit,
  reviewedDecision: "PASS_WITH_DOCUMENTED_RAW_FINDINGS",
};
writeFileSync(root + "/secret-review.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    raw: raw.status,
    findings: raw.findings.length,
    reviewed: report.reviewedDecision,
    capabilityExpired: report.capability.expired,
    publishedLeaks: 0,
  }),
);
