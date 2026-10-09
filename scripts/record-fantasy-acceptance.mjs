import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const out = "docs/qa/fantasy-cleanup";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const log = (p) => readFileSync("private-data/" + p, "utf8");
assert.match(log("cleanup-unit.log"), /# pass 190/);
assert.match(log("cleanup-unit.log"), /# fail 0/);
assert.match(log("cleanup-db.log"), /# pass 139/);
assert.match(log("cleanup-db.log"), /# fail 0/);
assert.match(log("cleanup-browser.log"), /22 passed/);
assert.match(log("cleanup-browser-owner.log"), /6 passed/);
assert.match(log("cleanup-onboarding.log"), /1 passed/);
assert.doesNotMatch(log("cleanup-typecheck.log"), /error TS/);
assert.doesNotMatch(log("cleanup-lint.log"), /\berror\b|problems/);
const hosted = json(out + "/hosted-acceptance.json"),
  holding = json(out + "/holding-after.json"),
  audit = json("private-data/cleanup-audit.json"),
  secrets = json(out + "/secret-audit.json"),
  apk = json(out + "/apk-audit.json"),
  beta = json("docs/qa/beta-isolation/real-postgres.json"),
  races = json("docs/qa/fantasy-production/real-postgres-races.json");
assert.equal(hosted.passed, true);
assert.equal(holding.unchanged, true);
assert.equal(secrets.status, "PASS");
assert.equal(apk.status, "PASS");
assert.equal(audit.metadata.vulnerabilities.total, 0);
assert.equal(beta.passed, true);
const report = {
  at: new Date().toISOString(),
  branch: "pivot/fantasy-cards-preview-v1",
  baseline: "7284abff",
  deployedSourceCommit: hosted.deployment.commit,
  preview: hosted.deployment.url,
  overall:
    "FAIL — full hosted gameplay, physical-device and owner visual acceptance remain incomplete",
  categories: {
    fantasyFunctionality: {
      local: "PASS",
      hostedMemberJourneys: "FAIL — gameplay gate intentionally closed",
      missing:
        "Operational multi-sport scoring, live sports data and public/paid marketplace are not implemented",
    },
    design: {
      responsiveAndAccessibility: "PASS",
      physicalSamsungS24: "FAIL — not performed",
      ownerVisualApproval: "PENDING",
    },
    security: {
      executedChecks: "PASS",
      fullHostedDatabaseRetirement:
        "PENDING — separate migration and scheduler/grant audit",
    },
    legacyCleanup: {
      activeApplication: "PASS",
      historicalDatabaseAndPolicy:
        "Preserved and documented; not silently rewritten or presented as current product plans",
    },
  },
  verification: {
    typecheck: "PASS",
    lint: "PASS",
    platform: { pass: 190, fail: 0 },
    database: { pass: 139, fail: 0, engine: "PGlite migration/RLS tests" },
    postgresFreePlayRaces: { pass: races.results.length, scope: races.scope },
    postgresBetaIsolation: { pass: beta.scenarios.length, scope: beta.scope },
    browser: {
      uniqueTestsPassed: 26,
      scope:
        "25-suite scenarios verified across final suite and six-scenario owner screenshot rerun, plus one onboarding scenario",
      initialFinalSuite:
        "22 passed; three screenshot-file writes failed after UI assertions. All six owner scenarios passed using a fresh evidence directory.",
    },
    hosted: {
      pass: hosted.checks.length,
      fail: hosted.failures.length,
      scope: hosted.scope,
    },
    webBuild: "PASS — optimized production build and hosted READY receipt",
    android: "PASS — bundled debug QA build; no remote origin",
    dependencyAudit: { vulnerabilities: 0 },
    clientSecretAudit: secrets,
    apkAudit: apk,
  },
  boundaries: {
    productionHoldingPageUnchanged: holding.unchanged,
    publicRegistration: "CLOSED",
    externalAdmission: "CLOSED",
    gameplay: "DISABLED on protected Preview",
    emailSent: false,
    paidServicesActivated: false,
    DNSChanged: false,
    productionDeployed: false,
  },
  remaining: [
    "Owner visual approval of supplied-brand screens",
    "Physical S24 keyboard, safe area, navigation, lifecycle, share and connected-session checks",
    "Separate authority and hosted acceptance for owner fantasy gameplay; no authentication bypass used",
    "Non-destructive retirement of obsolete database grants/jobs/outbox items; current read-only role evidence is not a full scheduler audit",
    "Versioned fantasy-specific replacement consent packet; prior approved bytes retained",
  ],
  nextAction:
    "Review VISUAL_REVIEW.md and approve the fantasy design; then run a separately scoped owner-only gameplay and physical S24 acceptance window, with registration still closed.",
};
writeFileSync(out + "/acceptance.json", JSON.stringify(report, null, 2) + "\n");
const git = (...args) =>
  execFileSync("git", ["-c", "core.safecrlf=false", ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
const entries = git("diff", "--name-status", "--find-renames=90%", "7284abff")
  .trim()
  .split("\n")
  .filter(Boolean);
for (const f of git("ls-files", "--others", "--exclude-standard")
  .trim()
  .split("\n")
  .filter(Boolean))
  if (existsSync(f)) entries.push("A\t" + f);
writeFileSync(
  out + "/changed-files.tsv",
  "status\tpath\tnew_path_if_renamed\n" + entries.sort().join("\n") + "\n",
);
console.log(
  JSON.stringify({
    overall: report.overall,
    localBrowserTests: 26,
    hostedChecks: hosted.checks.length,
    changedEntries: entries.length,
  }),
);
