// Offline review manifest; never deploys, connects to a database or grants approval.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 64e6 });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const base = "17b38c1290fd37c05487b332e5c0db440da6805b";
const source = git("rev-parse", "HEAD").toString().trim();
assert.deepEqual(process.argv.slice(2), ["--package"]);
assert(
  !git(
    "diff",
    "HEAD",
    "--name-only",
    "--",
    "src",
    "config",
    "public",
    "scripts",
    "supabase",
    "package.json",
    "package-lock.json",
    "vercel.json",
  )
    .toString()
    .trim(),
  "Commit source before freezing review bytes",
);
assert(
  !git("diff", "--name-only", base, source, "--", "android").toString().trim(),
  "Approved Android artifact must remain unchanged",
);
const paths = git("ls-tree", "-r", "--name-only", source)
  .toString()
  .trim()
  .split(/\r?\n/);
const deploymentPaths = paths.filter(
  (p) =>
    /^(src|config|public|certs)\//.test(p) ||
    /^(package(?:-lock)?\.json|vercel\.json|next\.config\.ts|tsconfig\.json|postcss\.config\.mjs|scripts\/guard-hosted-build\.mjs)$/.test(
      p,
    ),
);
const changes = git(
  "diff",
  "--name-only",
  base,
  source,
  "--",
  "src",
  "config",
  "public",
  "vercel.json",
  "package.json",
  "package-lock.json",
)
  .toString()
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const documentFiles = [
  "COMMERCIAL_CONFIGURATION_PROPOSAL.txt",
  "COORDINATED_REVENUE_RUNBOOK.txt",
  "HOSTED_ACCEPTANCE_SESSION.txt",
  "INVENTORY_ELIGIBILITY_DELTA.txt",
];
const migrationFiles = [
  "supabase/migrations/20261113002000_preserved_commercial_collection_read.sql",
  "supabase/migrations/20261113003000_commercial_market_request_guards.sql",
];
const requiredPaths = [
  ...new Set([
    ...deploymentPaths,
    ...changes,
    ...migrationFiles,
    "supabase/proposals/20261113_dormant_commercial_runtime_role.NOT-APPROVED.sql",
    "docs/qa/v31-revenue-launch-20261113/revenue-repairs-v2-rollback.sql",
    ...documentFiles.map((p) => "docs/qa/v31-revenue-launch-20261113/" + p),
  ]),
];
const batch = execFileSync("git", ["cat-file", "--batch"], {
  windowsHide: true,
  maxBuffer: 128e6,
  input: requiredPaths.map((p) => source + ":" + p).join("\n") + "\n",
});
const blobs = new Map();
let offset = 0;
for (const file of requiredPaths) {
  const end = batch.indexOf(10, offset);
  assert(end >= offset);
  const header = batch.subarray(offset, end).toString("utf8");
  const match = /^[a-f0-9]{40} blob ([0-9]+)$/.exec(header);
  assert(match, "Committed blob required: " + file);
  const size = Number(match[1]);
  offset = end + 1;
  blobs.set(file, batch.subarray(offset, offset + size));
  offset += size;
  assert.equal(batch[offset++], 10);
}
assert.equal(offset, batch.length);
const bytesOf = (p) => {
  assert(blobs.has(p));
  return blobs.get(p);
};
const entries = (ps) =>
  ps.map((file) => ({ file, sha256: hash(bytesOf(file)) }));
const baseline = JSON.parse(
  readFileSync(
    "docs/qa/v31-revenue-launch-20261113/production-live-readiness-final.json",
    "utf8",
  ),
);
const manifest = {
  version: "v31-revenue-closed-gate-review-v1",
  status: "PREPARED_NOT_APPROVED_NOT_DEPLOYED",
  sourceCommit: source,
  sourceTree: git("rev-parse", source + "^{tree}")
    .toString()
    .trim(),
  baseCommit: base,
  baselineDeployment: "dpl_8WTycjDUx7VvEQm4pm5jW6B9WHEB",
  projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
  databaseProject: "pojoymtniryarxxunyvz",
  previewProject: "bckkllmndoxzpzdqrevb",
  approvalValidityHours: 24,
  baselineRuntimeSettings: 89,
  baselineRuntimeRecipeSha256: baseline.runtimeRecipeSha256,
  baselineProductionSchema: baseline.database.schema,
  sourceFiles: entries(deploymentPaths),
  changedApplicationFiles: entries(changes),
  productionMigrations: entries(migrationFiles),
  dormantRoleProposal: entries([
    "supabase/proposals/20261113_dormant_commercial_runtime_role.NOT-APPROVED.sql",
  ])[0],
  rollback: entries([
    "docs/qa/v31-revenue-launch-20261113/revenue-repairs-v2-rollback.sql",
  ])[0],
  reviewDocuments: entries(
    documentFiles.map((p) => "docs/qa/v31-revenue-launch-20261113/" + p),
  ),
  scope: [
    "Stage exact candidate with all public/commercial gates closed, verify, promote only after passing checks",
    "Apply ONLY the two listed new Production migrations; preserve original five and outbox",
    "Provision the named inactive restricted commercial login and initial server secrets under the exact configuration proposal; no existing-key rotation or vault transfer",
    "Apply the four rollback-rehearsed dependencies to existing Preview and stage same candidate with provider/signup/commerce closed",
    "Conditional app-only rollback to current 17b38c1 or exact schema rollback while no new commercial records exist",
  ],
  exclusions: [
    "Original five migrations or repeat inventory import",
    "SMS or Google TEST orders, phone/provider enablement",
    "New inventory issuance/eligibility approval, wallet/balance/ownership changes",
    "Public-mode or registration activation, live payments/trading, prizes/withdrawals",
    "Google Play publication, policy publication, declaration submission",
    "Operational email automation/deletion schedules",
    "Live-key transfer/rotation or broader IAM",
  ],
  preflight: [
    "Fresh live source/deployment and all 89 baseline runtime settings; stop on changed bytes",
    "Corrected v2 schema fingerprint and exact grants/roles; no unexplained drift",
    "Authenticated full encrypted backup <=1h and isolated restore evidence",
    "6540 dormant definitions/888 lifetime copies/906 custody; no accounts/receipts",
    "Five existing migrations/outbox present, all controls and Auth provider/signup closed",
  ],
  postflight: [
    "Changed schema/function/index/trigger and RLS/ACL proofs; zero financial/ownership changes",
    "Exact deployed source and runtime recipe; restricted login no activation or direct outbox rights",
    "Closed endpoints, founder MFA, original collection parity and Android v31 bridge",
    "Preview separate-project binding; no sender enabled or TEST/live purchase",
  ],
  downtime:
    "No planned public downtime; use a quiet 5-10 minute database window. Two new migrations took 420/388ms locally; hosted locks are not guaranteed. lock_timeout 3s / statement_timeout 60s; abort on contention.",
  hashConvention:
    "SHA-256 of Git blob bytes; package SHA-256 of UTF-8 LF JSON including final newline. New secret values are generated/installed privately after exact authority, recorded by hash only; never embedded here.",
};
const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(
  "docs/qa/v31-revenue-launch-20261113/closed-gate-package.json",
  bytes,
  { flag: "wx" },
);
writeFileSync(
  "docs/qa/v31-revenue-launch-20261113/closed-gate-package.sha256.txt",
  hash(bytes) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    sourceCommit: source,
    packageSha256: hash(bytes),
    productionMigrations: manifest.productionMigrations,
    preparedOnly: true,
  }),
);
