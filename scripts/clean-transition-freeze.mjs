/** Deterministic, local-only approval manifests. Does not grant approval. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const git = (...args) => execFileSync("git", args, { windowsHide: true });
const source = process.argv[2];
assert.match(source ?? "", /^[a-f0-9]{40}$/);
assert.equal(git("rev-parse", `${source}^{commit}`).toString().trim(), source);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const dir = "docs/qa/clean-transition-20261117/";
const file = (path) => ({ path, sha256: sha(readFileSync(path)) });
const exact = (path) => {
  const bytes = readFileSync(path);
  assert(
    bytes.equals(git("show", `${source}:${path}`)),
    `Non-frozen bytes: ${path}`,
  );
  return file(path);
};
const migration = exact(
  "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
);
const operator = exact(
  "config/operations/clean-commercial-transition.prepared.sql",
);
const notice = exact(dir + "CUSTOMER_NOTICE.txt");
const recovery = exact(dir + "RECOVERY.txt");
const previousProduction = "76df44ba1adef012c5ec2119563cbc05ff9e3c0b";
const changes = git(
  "diff",
  "--name-only",
  previousProduction,
  source,
  "--",
  "src",
  "config",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "vercel.json",
)
  .toString()
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => ({
    path,
    gitBlobSha256: sha(git("show", `${source}:${path}`)),
  }));
const common = {
  source,
  tree: git("rev-parse", `${source}^{tree}`).toString().trim(),
  project: "pojoymtniryarxxunyvz",
  maximumApprovalHours: 24,
  noticeSha256: notice.sha256,
  publicLaunch: false,
  backupMaximumAgeSeconds: 3600,
  preflightMaximumAgeSeconds: 600,
  financialAndLifetimeSupplyReset: false,
};
const deployment = {
  kind: "clean-commercial-schema-application",
  ...common,
  previousProduction,
  previousDeployment: "dpl_Fnb75vUFUaDd4WL6pnkQDttKoQoh",
  migrations: [migration],
  operatorDeclarationsOnly: operator,
  notice,
  recovery,
  applicationChanges: changes,
  changesAccountRows: false,
  callsAuthAdmin: false,
  appliesPendingSmsBudgetMigration: false,
  changesRuntimeSettings: false,
  publishesReviewedPolicyWording: true,
  activeBetaAccessPreservedUntilSeparateContainment: true,
  evidence: [
    "restored-database-tests.json",
    "owner-surface-tests.json",
    "auth-lifecycle-tests.json",
    "auth-checkpoint-tests.json",
    "supply-census.json",
    "verification.json",
  ].map((p) => file(dir + p)),
};
const privateManifest = JSON.parse(
  readFileSync(
    "private-data/clean-transition-20261117/manifest.private.json",
    "utf8",
  ),
);
const account = {
  kind: "clean-commercial-account-transition",
  ...common,
  accountManifestSha256: sha(JSON.stringify(privateManifest)),
  files: [
    migration,
    operator,
    notice,
    recovery,
    exact("scripts/clean-commercial-transition.ts"),
    exact("src/core/account-retirement.ts"),
  ],
  scope: "contain-and-soft-retire-three-beta-customers-retain-two-owners",
  requiredAuthVersion: "v2.198.0",
  retainedOwners: 2,
  softRetiredCustomers: 3,
  preservedSystemIdentities: 1,
  replacementAccountsCreated: 0,
  noticeDeliveryRequired: true,
  unresolvedProtectedClaimsPermitted: false,
  sharesExternalPermissions: false,
  enablesAnyLaunchGate: false,
};
const save = (name, value) => {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(dir + name, bytes);
  return sha(bytes);
};
const deployHash = save("deployment-package.json", deployment),
  accountHash = save("account-retirement-package.json", account);
writeFileSync(
  dir + "DEPLOYMENT_APPROVAL.txt",
  `EXACT CLOSED-GATE SCHEMA / APPLICATION APPROVAL REQUEST — NOT YET APPROVED

Source: ${source}
Package SHA-256: ${deployHash}
Manifest: deployment-package.json (raw UTF-8 bytes, LF)
Previous independently verified Production: ${previousProduction}
Vercel: dpl_Fnb75vUFUaDd4WL6pnkQDttKoQoh

Proposed authority: maximum24h, exact source/package only. Install this ONE SQL
migration and operator function declarations atomically, record migration history,
protected staging/promotion, reviewed notice publication and postflight. NO account
containment, Owner role changes, Auth deletion, identifier release or launch.

Migration: ${migration.path}
SHA-256: ${migration.sha256}
Operator declarations: ${operator.path}
SHA-256: ${operator.sha256}
The declarations create functions only; do not call prepare/retire/complete.
No previous migrations are reapplied. The inactive SMS-budget migration is EXCLUDED.

SQL impact: private/RLS launch_transition registry, immutable history triggers,
session/phone/registration/Owner checks, restricted historical-card projection,
beta-grant/signup closure conditional on later containment, incident actor guards,
restrictive authenticated policies. No added customer permissive grant. No existing
Auth/profile/role/financial/card row changes during installation.

Application diff against actual Production is fully enumerated in the manifest.
It includes inherited approved-Preview origin validation, accurate 4900-credit /
5000-credit Premium disclosure and the INACTIVE SMS hook from prior preparation.
No hook window, secret, Phone setting or provider registration is enabled here.
New transition/Owner form guards and privacy v5/commercial notice are included.
Pricing, probabilities, native Android/billing code and Batch1 performance stay.

Required before execution: RECOVERY.txt plus exact hashes; fresh encrypted backup
<=1h and verified isolated restore; fresh drift <=10m; all current financial,
custody, lifetime, RLS, MFA and runtime settings verified; protected hosted staging;
Owner/beta access, receipt recovery and all closed-gate checks pass. Compare actual
Production source/settings again; unexpected changes require review, not reset.
Record the migration transaction and Vercel deployment ID. Promote only after all
staging gates pass, then repeat postflight. Runtime secrets/config stay unchanged.

Recovery: atomic SQL rollback on error; before containment only, conditional safe
app-only rollback to the fresh verified previous deployment. Leave additive schema
if safe. After containment there is no automatic app/account rollback.
Expected interruption: short DDL locks; 5s lock timeout/120s statement limit, abort
on unexpected contention. No public downtime because public launch stays closed.

Approving this package publishes only its reviewed policy wording. Customer-notice
delivery is a separate prerequisite for the account package; no messages are sent
by this deployment. Registration, SMS, live payments, commercial issuance, trading,
prizes, withdrawals, cleanup, NBA, competitions and Play publication remain closed.
Google managed publishing stays ON. Final paid launch requires separate approval.
`,
);
writeFileSync(
  dir + "ACCOUNT_RETIREMENT_APPROVAL.txt",
  `EXACT ACCOUNT TRANSITION APPROVAL REQUEST — NOT YET APPROVED

Source: ${source}
Package SHA-256: ${accountHash}
Manifest: account-retirement-package.json (raw UTF-8 bytes, LF)
Private six-account manifest digest: ${account.accountManifestSha256}
Customer notice SHA-256: ${notice.sha256}

Separate authority, maximum24h: AFTER successful schema/application deployment,
approved notice delivery and fresh backup/preflight, contain the exact beta cohort
and use supported GoTrue v2.198.0 soft deletion for THREE customers only.

Retain Founder623d1e69… exact UUID/MFA/Owner.
Retain Barryef641248… exact UUID/MFA; Admin -> existing Full Owner role.
Retire Luke9fa5cdbb…, Brentond6ab4838…, other invited customereea25d64….
Preserve internal QAe56880e0… Auth/history separately; no public participation.
Exact full identifiers/email hashes are in the private reviewed manifest, never
chosen by display name. Any mismatch/new/unidentified Auth account aborts.

Atomic containment copies only the two Owners' profiles/historical consent and
preferences, records role changes, blocks beta assets and ordinary invitations.
No new commercial consent or assets are fabricated. Then individually record an
attempt, call deleteUser(id,true), independently verify and checkpoint. Complete
only when all three soft deletions and both Owner identities/MFA pass.

ZERO commercial credits/cards/packs/lineups for retained/new customer participation.
No old balance/ledger/card/custody/supply/receipt/hold is reset or deleted. The
three sealed beta packs remain archived. Historical card serials remain consumed.
No new account, message, purchase, pack opening, mint, live key access or external
Owner permission is authorised. Replacement accounts register themselves normally
with NEW UUIDs, email/phone verification and explicit commercial consent.

The old credentials/sessions will stop working and email/phone identifiers become
reusable. This soft deletion is IRREVERSIBLE. Recovery is forward-only, retaining
tombstones/audits; never hard-delete, recreate an old UUID or restore the entire
old database over later activity. See RECOVERY.txt and EXECUTION.txt.

Mandatory prerequisites: approved notice delivered, no unresolved specific
protected-entitlement claim, exactly reviewed identities/roles, individually
verified Owner MFA, unchanged Auth version, encrypted restored backup<=1h,
preflight<=10m and closed empty commercial runtime. No automated access restoration
on partial failure. Brenton's California exception does not become AU eligibility.

This request does NOT approve public registration, SMS delivery, sales/issuance,
trading, competitions, prizes/withdrawals, deletion schedules or Google publication.
`,
);
console.log(
  JSON.stringify({
    source,
    deploymentPackage: deployHash,
    accountRetirementPackage: accountHash,
    migration: migration.sha256,
  }),
);
