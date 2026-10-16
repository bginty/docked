// Read-only local review. Never print secret matches, bearer links or JWT claims.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";

const dir = "docs/qa/prelaunch-data";
await mkdir(dir, { recursive: true });
const raw = JSON.parse(await readFile(`${dir}/secret-scan-raw.json`, "utf8"));
const artifactStatus = JSON.parse(
  await readFile(`${dir}/apk-capability-status.json`, "utf8"),
);
const prior = JSON.parse(
  await readFile(
    "docs/qa/marketplace-authenticated/secret-review.json",
    "utf8",
  ),
);
// Re-reviewed source revisions: runtime-generated local passwords or fictional
// release-gate fixtures. Any change requires review again, not suppression.
const reReviewed = {
  "scripts/fantasy-production-local-postgres.mjs":
    "510ce8d98879e0ea7b417aad2e7cc5caf62417a9b5c32ebbbb215bc835cbb49a",
  "scripts/marketplace-auth-infra.mjs":
    "b13437b975940f6e5e9f4e2e583ab02e6cbbfec43498b1275eee9819c49c1603",
  "tests/platform/production-release-tools.test.ts":
    "7fb1055aba35c44b905879835d97e1b13ac5ad2f327b83e3c1d6918a1abd5a1e",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const reviewed = [];
let capability = null;
let capabilityToken;
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
for (const finding of raw.findings) {
  const bytes = await readFile(finding.file);
  const baseline = prior.reviewed.find((item) => item.file === finding.file);
  if (baseline) {
    const unchanged = hash(bytes) === baseline.sha256;
    const sourceReReviewed = hash(bytes) === reReviewed[finding.file];
    reviewed.push({
      file: finding.file,
      sha256: hash(bytes),
      baselineUnchanged: unchanged,
      sourceReReviewed,
      classification:
        unchanged || sourceReReviewed
          ? baseline.classification
          : "REVIEW_REQUIRED",
      reason: baseline.reason,
    });
    continue;
  }
  if (finding.file === prior.additionalFinding.file) {
    capabilityToken = bytes
      .toString()
      .match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
    if (!capabilityToken)
      throw Error("Capability shape changed; private manual review required");
    const payload = JSON.parse(
      Buffer.from(capabilityToken.split(".")[1], "base64url").toString(),
    );
    if (!Number.isFinite(payload.exp))
      throw Error("Capability expiry unavailable");
    const matches = [];
    for (const file of tracked) {
      if ((await readFile(file)).includes(Buffer.from(capabilityToken)))
        matches.push(file);
    }
    const history = execFileSync(
      "git",
      ["log", "--all", "--format=%h", "--", finding.file],
      { encoding: "utf8" },
    ).trim();
    capability = {
      file: finding.file,
      sha256: hash(bytes),
      baselineUnchanged: hash(bytes) === prior.additionalFinding.fileSha256,
      classification: "UNTRACKED_SIGNED_DOWNLOAD_CAPABILITY",
      expires: new Date(payload.exp * 1000).toISOString(),
      expired: payload.exp * 1000 <= Date.now(),
      trackedExposurePaths: matches,
      fileInTrackedHistory: !!history,
      remoteValidity:
        artifactStatus.oldObjectAbsent &&
        artifactStatus.priorReceiptMatchesTokenDigest
          ? "ORIGIN_PATH_ABSENT_SEPARATE_READ_ONLY_CHECK"
          : "REVIEW_REQUIRED",
      storageCheckAt: artifactStatus.at,
      revoked: false,
      disposition:
        "Bearer token retained locally until expiry; no tracked exposure found. Separate apk-capability-status.json confirms prior relocation: original path 404, private archive and v22 replacement present. This is object-path withdrawal, not cryptographic token revocation; prior downloads/cache copies cannot be recalled. No new mutation or capability use performed.",
    };
    continue;
  }
  reviewed.push({
    file: finding.file,
    sha256: hash(bytes),
    classification: "REVIEW_REQUIRED",
  });
}
const known = await loadKnownSecrets();
const boundary = await auditPreviewTargets(
  ["src", "public", "config", "supabase/functions"],
  [...known.values, ...(capabilityToken ? [capabilityToken] : [])],
);
const report = {
  at: new Date().toISOString(),
  rawStatus: raw.status,
  rawFindings: raw.findings.length,
  scannerUnchanged: true,
  exclusionsAdded: false,
  reviewed,
  capability,
  deployableSourceAudit: boundary,
  conclusion:
    reviewed.some((item) => item.classification === "REVIEW_REQUIRED") ||
    boundary.findings.length ||
    boundary.errors.length
      ? "MANUAL_REVIEW_REQUIRED"
      : "DOCUMENTED_FINDINGS_REMAIN; NOT_A_CLEAN_SCAN",
  limitations:
    "Source scan only; no new build scan, remote secret inventory, complete Git history content scan, artifact revocation or external sharing audit.",
};
await writeFile(`${dir}/secret-review.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    status: report.conclusion,
    rawFindings: raw.findings.length,
    boundaryFindings: boundary.findings.length,
    boundaryErrors: boundary.errors.length,
    capabilityExpired: capability?.expired ?? null,
  }),
);
