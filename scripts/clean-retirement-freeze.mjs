/** Freeze an operator-only package; never authorises or executes account writes. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const dir = "docs/qa/clean-retirement-attestation-20261117/";
const source = process.argv[2],
  deployed = "9e57c094cb7b4af02277e191a2e64fa2e6b22c6b";
assert.match(source ?? "", /^[a-f0-9]{40}$/);
const git = (...args) => execFileSync("git", args, { windowsHide: true });
assert.equal(git("rev-parse", `${source}^{commit}`).toString().trim(), source);
assert.equal(
  git(
    "diff",
    "--name-only",
    deployed,
    source,
    "--",
    "src",
    "config",
    "supabase/migrations",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "vercel.json",
  )
    .toString()
    .trim(),
  "",
  "Application/schema dependencies changed; this is operator-only authority",
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const exact = (path) => {
  const bytes = readFileSync(path);
  assert(
    bytes.equals(git("show", `${source}:${path}`)),
    `Unfrozen bytes: ${path}`,
  );
  return { path, sha256: sha(bytes) };
};
const manifest = JSON.parse(
  readFileSync("private-data/clean-transition-20261117/manifest.private.json"),
);
const manifestSha = sha(JSON.stringify(manifest));
assert.equal(
  manifestSha,
  "9ae298d2b6c16c48c2901b021db443df48f160d819ab361bf02487d5a45823c7",
);
const communication = exact(dir + "FOUNDER_ATTESTATION.json");
const evidence = JSON.parse(readFileSync(communication.path));
assert.equal(evidence.accountManifestSha256, manifestSha);
const notice = exact("docs/qa/clean-transition-20261117/CUSTOMER_NOTICE.txt");
const migration = exact(
  "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
);
const declarations = exact(
  "config/operations/clean-commercial-transition.prepared.sql",
);
assert.equal(
  migration.sha256,
  "74d8a48be8897435e8ef53734117861c9072495a0fb5d069027bdcefbdf33aa4",
);
assert.equal(
  declarations.sha256,
  "857ee8823c3b2b0d48bcc5ad419feefc8f81d089ed34242c4fdbd6a28ff0b111",
);
const pkg = {
  kind: "clean-commercial-account-transition",
  schemaVersion: 2,
  source,
  tree: git("rev-parse", `${source}^{tree}`).toString().trim(),
  project: "pojoymtniryarxxunyvz",
  deployedApplicationSource: deployed,
  deployedApplication: "dpl_ZNUTkFD88udQGYcdnJ8eJaUZ5QBq",
  maximumApprovalHours: 24,
  backupMaximumAgeSeconds: 3600,
  preflightMaximumAgeSeconds: 600,
  accountManifestSha256: manifestSha,
  noticeSha256: notice.sha256,
  noticeHashMeaning:
    "Reviewed text provenance only; not delivery or customer acceptance",
  communicationRequirement: "founder-attested-prior-direct-communication",
  communicationEvidence: communication,
  newNotificationEmailsAuthorised: false,
  scheduledNoticeDelay: null,
  requiredAuthVersion: "v2.198.0",
  scope: "contain-and-soft-retire-three-beta-customers-retain-two-owners",
  retainedOwners: 2,
  softRetiredCustomers: 3,
  preservedSystemIdentities: 1,
  replacementAccountsCreated: 0,
  migrationsToApply: [],
  applicationDeployment: false,
  installedDependencies: [migration, declarations],
  files: [
    migration,
    declarations,
    notice,
    communication,
    ...[
      "scripts/clean-commercial-transition.ts",
      "scripts/clean-transition-authority.ts",
      "src/core/account-retirement.ts",
      dir + "RECOVERY.txt",
      dir + "EXECUTION.txt",
      dir + "TERMS_REVIEW.txt",
    ].map(exact),
  ],
  evidence: [
    "restored-database-tests.json",
    "containment-helper-tests.json",
    "production-readonly-audit.json",
    "verification.json",
  ].map((n) => exact(dir + n)),
  previousAccountPackage:
    "c569dcfeea5f0e8fbebcab7b14dc03674aca7ffbd6c8581d4d3287a5108f2855",
  unresolvedProtectedClaimsPermitted: false,
  financialAndLifetimeSupplyReset: false,
  sharesExternalPermissions: false,
  enablesAnyLaunchGate: false,
  publicLaunch: false,
};
const bytes = JSON.stringify(pkg, null, 2) + "\n",
  digest = sha(bytes);
writeFileSync(dir + "account-retirement-package.json", bytes);
writeFileSync(
  dir + "ACCOUNT_RETIREMENT_APPROVAL.txt",
  `EXACT REVISED ACCOUNT RETIREMENT — NOT YET APPROVED

Operator source: ${source}
Package SHA-256: ${digest}
Private six-account manifest digest: ${manifestSha}
Founder communication attestation SHA-256: ${communication.sha256}

Approve this account-only package for a maximum of 24 hours, following fresh
encrypted backup/isolated restore and preflight. No application deployment or
migration is needed: Production stays at ${deployed}.
The previous account-package hash cannot authorise these changed operator bytes.

Communication: accept the founder's recorded attestation that the three customers
were already directly informed. No new emails, email receipts, communication
dates, noticeDelivered flag or 19 November waiting condition. The reviewed notice
hash remains a text reference only. New commercial consent is not fabricated.

Exact cohort:
- Founder 623d1e69... retains original Auth identity, Owner and individual MFA.
- Barry ef641248... retains original Auth identity/MFA; existing Admin becomes
  equivalent in-app Full Owner, audited under his own identity.
- Luke 9fa5cdbb..., Brenton d6ab4838... and invited customer eea25d64... have beta
  access contained, followed by supported Auth soft retirement. Existing email/
  phone can be used only through later genuine registration with NEW UUIDs and
  fresh verification/consent. Brenton remains subject to Australian eligibility.
- QA e56880e0... is preserved historically and excluded from commercial use.

All commercial credits/cards/packs/lineups and inherited beta benefits start at
zero usable. Original journals, TEST receipts/refunds, recovery holds, card
serials, ownership provenance and lifetime issuance remain preserved. No inventory
is imported, reset or reclaimed. No replacement customer accounts are created.

Sequence: atomic containment plus immutable communication-evidence event; then
supported per-customer soft deletion with durable attempt/readback checkpoints;
then complete and verify. Appended attestation is idempotent and never claims
email delivery. Account deletion is IRREVERSIBLE. Partial failure remains contained;
forward recovery only, never hard-delete or restore old data over later activity.

Prerequisites: exact current identities/roles/MFA and deployed SQL; GoTrue v2.198.0;
backup <=1 hour and preflight <=10 minutes; no unexpected material drift or actual
unresolved protected claim; empty commercial runtime and closed launch controls.
No requirement to send a notice email or wait until a suggested later date.

No external IAM/vault access, key changes, new SQL, application deployment,
registration, SMS, live payments, commercial issuance, marketplace, prizes,
withdrawals, real scoring, deletion schedules or Play publication is authorised.
NBA stays hidden, six competitions disabled Practice, managed publishing unchanged.
See EXECUTION.txt and RECOVERY.txt. Public launch remains NO-GO.
`,
);
console.log(
  JSON.stringify({
    source,
    packageSha256: digest,
    communicationEvidenceSha256: communication.sha256,
    productionWrites: 0,
  }),
);
