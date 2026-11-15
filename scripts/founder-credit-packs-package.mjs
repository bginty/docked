/** Read-only exact-byte verifier / local approval-packet writer. Never deploys. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const dir = "docs/qa/founder-credit-packs-20261115/";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const mode = process.argv[2];
assert(["prepare", "verify"].includes(mode));
const proposal = read(dir + "proposal.json");
const privateFiles = [
  {
    file: "private-data/founder-credit-packs-20261115/adoption-plan.private.json",
    sha256: proposal.planSha256,
  },
  {
    file: "private-data/founder-credit-packs-20261115/adopt.private.sql",
    sha256: proposal.adoptionSha256,
  },
];
for (const f of privateFiles)
  assert.equal(hash(readFileSync(f.file)), f.sha256, f.file);
// Use one Git batch process; no shell interpolation or text/newline conversion.
function digests(commit, files) {
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((f) => commit + ":" + f).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  const result = files.map((file) => {
    const end = bytes.indexOf(10, offset),
      header = bytes.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const size = Number(header.split(" ")[2]),
      b = bytes.subarray(end + 1, end + 1 + size);
    offset = end + 2 + size;
    return { file, sha256: hash(b) };
  });
  assert.equal(offset, bytes.length);
  return result;
}
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit reviewed source and evidence first",
  );
  const commit = git("rev-parse", "HEAD").toString().trim();
  const all = git("ls-tree", "-r", "--name-only", commit)
    .toString()
    .trim()
    .split("\n");
  const old = read("docs/qa/season-catalogue-20261115/production-package.json");
  const roots = new Set(old.sourceFiles.map((f) => f.file.split("/")[0]));
  const app = all.filter(
    (f) => roots.has(f.split("/")[0]) && !f.startsWith("scripts/"),
  );
  for (const f of [
    "scripts/guard-hosted-build.mjs",
    ".vercelignore",
    "next-env.d.ts",
  ])
    if (all.includes(f) && !app.includes(f)) app.push(f);
  const reviewed = all.filter(
    (f) =>
      f.startsWith(dir) ||
      /scripts\/founder-credit-pack/.test(f) ||
      f === "scripts/commercial-production-restore-drill.ts" ||
      f ===
        "supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql",
  );
  const runtime = read(dir + "runtime-review.json"),
    rehearsal = read(dir + "restored-rehearsal.json");
  assert.equal(
    rehearsal.sourceBackup,
    "3a17b94a424da7e0ba36c3fd681836dc78146ea61e33f924d174777df545ee30",
  );
  assert.equal(rehearsal.protectedRowsAndCustodyUnchanged, true);
  assert.equal(
    rehearsal.migrationSha256,
    hash(
      git(
        "show",
        commit +
          ":supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql",
      ),
    ),
  );
  assert.equal(rehearsal.adoptionSha256, proposal.adoptionSha256);
  assert.equal(
    hash(
      readFileSync(
        "private-data/season-catalogue-20261115/runtime-deployment.private.json",
      ),
    ),
    runtime.baselineRecipeFileSha256,
  );
  const packet = {
    version: "founder-free-credit-private-packs-v1",
    sourceCommit: commit,
    sourceTree: git("rev-parse", commit + "^{tree}")
      .toString()
      .trim(),
    baseCommit: runtime.baselineCommit,
    baselineDeployment: runtime.baselineDeployment,
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    databaseProject: "pojoymtniryarxxunyvz",
    sourceFiles: digests(commit, app.sort()),
    reviewedFiles: digests(commit, reviewed.sort()),
    privateFiles,
    runtime,
    scope: {
      members: 4,
      players: 1210,
      definitions: 6050,
      originalLimitedCopies: 888,
      products: 18,
      founderChoosesGrants: true,
      campaignCreditLimit: 100000,
      permanentSupplyConsumption: true,
      publicRegistration: false,
      creditPurchases: false,
      commercialPayments: false,
      trading: false,
      googlePlayPublication: false,
      sms: false,
      nba: false,
      prizes: false,
      withdrawals: false,
    },
    productionMigrations: [
      "20261115043326_founder_credit_pack_lifetime_bridge.sql",
    ],
    approvalRequired: true,
    approvalDurationHours: 24,
    recovery:
      "Pause private issuance/grants and retain compatible reader; forward recovery after adoption. Never reverse legitimate credits/cards or lifetime supply.",
  };
  const bytes = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(dir + "production-package.json", bytes, { flag: "wx" });
  console.log(
    JSON.stringify({
      sourceCommit: commit,
      packageSha256: hash(bytes),
      files: app.length,
    }),
  );
} else {
  const bytes = readFileSync(dir + "production-package.json"),
    packet = JSON.parse(bytes);
  assert.equal(
    git("rev-parse", packet.sourceCommit + "^{tree}")
      .toString()
      .trim(),
    packet.sourceTree,
  );
  const files = [...packet.sourceFiles, ...packet.reviewedFiles];
  assert.deepEqual(
    digests(
      packet.sourceCommit,
      files.map((f) => f.file),
    ),
    files,
  );
  assert.deepEqual(packet.privateFiles, privateFiles);
  console.log(
    JSON.stringify({
      verified: true,
      sourceCommit: packet.sourceCommit,
      packageSha256: hash(bytes),
      files: files.length,
      productionWrites: 0,
    }),
  );
}
