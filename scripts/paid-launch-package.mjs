/** Exact Git-byte preparation/verifier/exporter. No network or deployment. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const directory = "docs/qa/paid-launch-final-20261118/";
const baseline = "78482f713fd93b6677f85b43c5c49cfa00acccde";
const branch = "codex/paid-launch-final-20261118";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
const roots = new Set([
  ".nvmrc",
  ".vercelignore",
  "certs",
  "config",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "public",
  "src",
  "tsconfig.json",
  "vercel.json",
]);
function blobs(commit, files) {
  const result = new Map();
  const b = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((f) => commit + ":" + f).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  for (const file of files) {
    const e = b.indexOf(10, offset),
      h = b.subarray(offset, e).toString();
    assert.match(h, /^[a-f0-9]+ blob \d+$/);
    const n = Number(h.split(" ")[2]);
    result.set(file, b.subarray(e + 1, e + 1 + n));
    offset = e + n + 2;
  }
  assert.equal(offset, b.length);
  return result;
}
const digests = (commit, files) =>
  [...blobs(commit, files)].map(([file, bytes]) => ({
    file,
    sha256: hash(bytes),
  }));
const [mode, kind, expected, destination] = process.argv.slice(2);
assert(["prepare", "verify", "export"].includes(mode));
const fileFor = (k) => directory + k + "-package.json";
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit source/evidence first",
  );
  assert.equal(git("branch", "--show-current").toString().trim(), branch);
  const sourceCommit = git("rev-parse", "HEAD").toString().trim();
  const all = git("ls-tree", "-r", "--name-only", sourceCommit)
    .toString()
    .trim()
    .split("\n");
  const files = all
    .filter(
      (f) =>
        roots.has(f.split("/")[0]) || f === "scripts/guard-hosted-build.mjs",
    )
    .sort();
  const changed = git("diff", "--name-only", baseline, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  assert(
    !changed.some((f) => f.startsWith("android/") || f.startsWith("supabase/")),
    "No native or SQL/Edge source changes",
  );
  assert.equal(
    JSON.parse(git("show", sourceCommit + ":vercel.json")).git
      .deploymentEnabled[branch],
    false,
  );
  const allowed = new Set([
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/components/paid-launch-home.tsx",
    "config/launch-policy-content.json",
    "config/operations/paid-launch-final.json",
    "config/operations/production-phone-one-attempt.json",
    "vercel.json",
  ]);
  assert(
    changed.filter((f) => files.includes(f)).every((f) => allowed.has(f)),
    "Unexpected application/config bytes",
  );
  const edgeFiles = all
    .filter((f) => f.startsWith("supabase/functions/docked-auth-email/"))
    .sort();
  assert.equal(edgeFiles.length, 4);
  const operatorFiles = all
    .filter((f) =>
      /^scripts\/(paid-launch-|production-phone-|lib\/(paid-launch-|production-phone-|supabase-management-read))/.test(
        f,
      ),
    )
    .sort();
  const evidenceFiles = all
    .filter(
      (f) =>
        f.startsWith(directory) &&
        !/(?:preparation|launch)-package\.json|APPROVAL\.txt|HANDOVER\.txt/.test(
          f,
        ),
    )
    .sort();
  const verification = JSON.parse(
    fs.readFileSync(directory + "verification.json"),
  );
  assert.equal(verification.passed, true);
  for (const f of [
    "activation-rehearsal.json",
    "phone-session-rehearsal.json",
    "local-browser.json",
    "provider-readonly.json",
  ])
    assert.equal(JSON.parse(fs.readFileSync(directory + f)).passed, true);
  const common = {
    version: "docked-paid-launch-20261118",
    sourceCommit,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    branch,
    baselineSource: baseline,
    baselineDeployment: "dpl_5tqAzCqmiUQxVRvJ2iaTeULNPjFE",
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    databaseProject: "pojoymtniryarxxunyvz",
    sourceFiles: digests(sourceCommit, files),
    edgeFiles: digests(sourceCommit, edgeFiles),
    operatorFiles: digests(sourceCommit, operatorFiles),
    reviewedFiles: digests(sourceCommit, [...evidenceFiles, ".gitattributes"]),
    changedRuntimeFiles: changed.filter((f) => files.includes(f)),
    migrations: [],
    alreadyInstalledMigrationsDoNotReapply: digests(sourceCommit, [
      "supabase/migrations/20261116215032_public_sms_budget_guard.sql",
      "supabase/migrations/20261117091440_public_owner_support.sql",
    ]),
    accountOperations: [],
    evidenceIndexCommit: "cb1ee482d86a085af5e46678d13b0027870b188f",
    approvalMaximumHours: 24,
    freshBackupMaximumMinutes: 60,
    preflightMaximumMinutes: 10,
    policyProposalSha256:
      "73b22a8593586868e35704e6d9ec9dadadf9690cd609bcd0226b727cf4f1696b",
    eligibilityDigest:
      "1956d1715dcd2ef494dad469f8b272951853d5d76773fe9ae39f5537996e6830",
    automaticGitDeploymentDisabled: true,
  };
  const prep = {
    ...common,
    scope:
      "EXECUTION.txt Part A only: closed notice/application staging/promotion, exact email-function deployment with public mail OFF, Production SMS configuration and ONE attended Founder attempt <=A$1/2h, mandatory closure; requires explicit separate approval",
    configuration: JSON.parse(
      fs.readFileSync("config/operations/production-phone-one-attempt.json"),
    ),
    finalGoRequired: true,
    excludes: [
      "public signup",
      "public SMS window",
      "credit sales",
      "paid issuance",
      "inventory approval/import",
      "Google publication",
      "optional features",
      "account changes",
      "key rotation",
    ],
  };
  const prepBytes = Buffer.from(JSON.stringify(prep, null, 2) + "\n");
  fs.writeFileSync(fileFor("preparation"), prepBytes, { flag: "wx" });
  const launch = {
    ...common,
    scope:
      "EXECUTION.txt Part B only after successful preparation/actual signed-Auth-hook acceptance and final explicit coordinated GO",
    configuration: JSON.parse(
      fs.readFileSync("config/operations/paid-launch-final.json"),
    ),
    requiredPreparationPackageSha256: hash(prepBytes),
    status: "PREPARED_NOT_GO_READY",
    requiredCompletionEvidence: [
      "actual preparation deployment/source/runtime postflight",
      "one actual Production Auth signed-hook-to-budget verification accepted, including persistence and closure",
      "fresh exact final private configuration/authority plan and backup/preflight",
      "Google ready-to-publish readback",
    ],
    excludes: [
      "marketplace/swaps/offers",
      "NBA",
      "real scoring/competitions/prizes",
      "withdrawals",
      "new inventory imports",
      "beta benefits",
      "repeating accepted payment tests",
      "new Android artifact",
      "automatic budget renewal/funding",
      "key rotation",
    ],
  };
  fs.writeFileSync(fileFor("launch"), JSON.stringify(launch, null, 2) + "\n", {
    flag: "wx",
  });
  for (const k of ["preparation", "launch"])
    console.log(
      k + " " + hash(fs.readFileSync(fileFor(k))) + " source " + sourceCommit,
    );
} else {
  assert(["preparation", "launch"].includes(kind));
  assert.match(expected ?? "", /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(fileFor(kind));
  assert.equal(hash(bytes), expected);
  const p = JSON.parse(bytes);
  assert.equal(
    git("rev-parse", p.sourceCommit + "^{tree}")
      .toString()
      .trim(),
    p.sourceTree,
  );
  const groups = [p.sourceFiles, p.edgeFiles, p.operatorFiles, p.reviewedFiles];
  for (const entries of groups)
    assert.deepEqual(
      digests(
        p.sourceCommit,
        entries.map((x) => x.file),
      ),
      entries,
    );
  if (mode === "export") {
    assert(
      destination && !fs.existsSync(destination),
      "New empty destination required",
    );
    const dir = path.resolve(destination);
    fs.mkdirSync(dir, { recursive: true });
    const files = [...new Set(groups.flat().map((x) => x.file))];
    for (const [file, b] of blobs(p.sourceCommit, files)) {
      const out = path.resolve(dir, file);
      assert(out.startsWith(dir + path.sep));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, b, { flag: "wx" });
    }
  }
  console.log(
    JSON.stringify({
      verified: true,
      package: kind,
      source: p.sourceCommit,
      sha256: expected,
      exported: mode === "export",
      networkRequests: 0,
    }),
  );
}
