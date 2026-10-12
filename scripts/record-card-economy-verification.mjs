import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const json = (p) => JSON.parse(readFileSync(p));
const text = (p) => readFileSync(p, "utf8");
assert.match(
  text("private-data/economy-v2/platform-tests-unrestricted.log"),
  /# pass 304\r?\n# fail 0/,
);
assert.match(
  text("private-data/economy-v2/database-tests-final.log"),
  /# pass 150\r?\n# fail 0/,
);
assert.match(
  text("private-data/economy-v2/browser-final-labels.log"),
  /4 passed/,
);
assert.match(
  text("private-data/economy-v2/android-build.log"),
  /BUILD SUCCESSFUL/,
);
const domain = json("docs/qa/friends-cutover/domain-boundary.json");
const wallet = json("docs/qa/android-v21/wallet-domain.json");
const apk = json("docs/qa/android-v21/apk-details.json");
const download = json("docs/qa/android-v21/apk-published.json");
const secrets = json("docs/qa/android-v21/known-secret-audit.json");
assert.equal(domain.passed, true);
assert.equal(wallet.passed, true);
assert.equal(apk.status, "PASS");
assert.equal(secrets.status, "PASS");
assert.equal(download.sha256, apk.sha256);
const audit = json("private-data/economy-v2/dependency-audit.json");
assert.equal(audit.metadata.vulnerabilities.total, 0);
const report = {
  at: new Date().toISOString(),
  deployment: wallet.deployment,
  commit: wallet.commit,
  typecheck: "PASS",
  lint: "PASS",
  platform: {
    passed: 304,
    failed: 0,
    note: "Initial restricted attempt hit Windows temp-directory access failures; unchanged suite passed with appropriate filesystem access.",
  },
  database: { passed: 150, failed: 0 },
  finalIconNativePostgres: json("docs/qa/economy-v2/postgres.json"),
  nineCardBrowser: {
    passed: 4,
    failed: 0,
    widths: [360, 412, 1366],
    reducedMotion: true,
    accessibility: true,
  },
  hostedWallet: wallet,
  domainBoundaries: domain.checks.length,
  webBuild: "Local PASS and exact Vercel deployment READY",
  android: {
    built: true,
    version: apk.current.versionCode,
    sameSignature: apk.samePackageAndSigningCertificate,
    sha256: apk.sha256,
    downloadVerified: download.downloadWithoutLoginVerified,
    expiresAt: download.expiresAt,
  },
  dependencyVulnerabilities: 0,
  secretScan: secrets,
  weightedMemberRound:
    "UNFINISHED: new inventory/entry bridge not connected; old free rounds unchanged",
  physicalDevice: "PENDING",
  ownerVisualApproval: "PENDING",
  emulator: "NOT RUN",
  realMoney: false,
  additionalHumanGrants: 0,
  messagesSent: 0,
};
writeFileSync(
  "docs/qa/economy-v2/verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    recorded: true,
    domainChecks: domain.checks.length,
    apk: apk.current.versionCode,
  }),
);
