/** Freeze already rehearsed synthetic Preview SQL, separately from Production. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { packAcceptanceSchemas } from "../src/server/pack-acceptance-sql";
const dir = "docs/qa/batch1-hosted-20261116",
  priv = "private-data/batch1-hosted-20261116";
const hash = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
const files = [
  "namespace-schema.sql",
  "namespace-permissions.sql",
  "fixtures.sql",
].map((name) => ({
  path: priv + "/" + name,
  sha256: hash(readFileSync(priv + "/" + name)),
}));
const archive = gzipSync(
  JSON.stringify(
    files.map((f) => ({ path: f.path, text: readFileSync(f.path, "utf8") })),
  ),
);
writeFileSync(dir + "/preview-payloads.json.gz", archive);
const manifest = {
  version: 2,
  projectRef: "bckkllmndoxzpzdqrevb",
  vercelProject: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  schemas: ["b1_acceptance", ...packAcceptanceSchemas.map((s) => "b1_" + s)],
  roles: ["docked_pack_acceptance", "docked_pack_acceptance_owner"],
  runtimeHours: 24,
  syntheticAccounts: 2,
  syntheticPlayers: 2479,
  syntheticDefinitions: 6540,
  initialSyntheticLimitedCopies: 0,
  syntheticCreditsPerAccount: 1000000,
  maxTestPurchases: 200,
  files,
  payloadArchive: {
    path: dir + "/preview-payloads.json.gz",
    sha256: hash(archive),
  },
  operatorSha256: hash(readFileSync("scripts/batch1-preview-operator.ts")),
  productionChanges: false,
  existingPreviewAccountsChanged: false,
  providerSettingsChanged: false,
};
writeFileSync(
  dir + "/preview-package.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
const digest = hash(readFileSync(dir + "/preview-package.json"));
const report = `DOCKED — DISPOSABLE PREVIEW DEPENDENCY APPROVAL\n\nPackage SHA-256: ${digest}\nTarget only: existing Supabase Preview bckkllmndoxzpzdqrevb.\nApplication target: protected docked-preview Vercel project ${manifest.vercelProject}.\n\nCreate 12 disposable b1_* namespaces, 152 dependency tables plus 2 acceptance-control\ntables, copied schema-only functions/views/constraints, and two dedicated roles.\nThe dependency closure follows the real pack, admission, receipt and Weekly Core\nfunctions; it does not replay Production migration history or copy customer rows.\nThe three original Batch 1 SQL files remain byte-for-byte unchanged. Their seven\nfinal functions were checked before namespace conversion in disconnected rehearsal.\nThe named California tester constant is replaced with an uninvited synthetic sentinel.\n\nRuntime role: LOGIN, no superuser, no BYPASSRLS, no role/database creation,\nNOINHERIT, no privileged membership, 12 connections, password valid 24 hours.\nOwner role: NOLOGIN, no privileged membership; owns only disposable namespaces.\n104 existing runtime grants are reproduced only within the new namespaces.\nNo grants to anon/authenticated/service_role. No existing schema ACL changes.\nAuth access uses fixed-member filtered views for the two newly created synthetic\naccounts. Identical claim-reader helpers are copied to the namespace so no shared\nAuth schema grants are needed. Write guards require a real active AAL2 session,\nverified factor, correct server metadata and a valid 24-hour window.\nNo customer Auth accounts, sessions, passwords or provider credentials are copied.\nThe isolated collection/Weekly reader checks Preview mode and its genuine project\nreference, with Production context empty; all account/consent checks remain.\nCollection and four-card Weekly Core/retry checks passed for both accounts in all\nthree sports using stale fictional source snapshots.\n\nSynthetic fixtures: 2,479 fictional players (1,308 eligible synthetic identities),\n6,540 synthetic definitions, zero initial limited copies, 1,000,000 nonredeemable\nfixture credits per account across ten separately capped 100,000-credit campaigns.\nAll fixture source evidence is explicitly fictional, never a real rights approval.\nAt most 200 synthetic purchases (at most 1,800 test cards); no external payments.\n\nRehearsal: all 18 NFL/AFL/NRL Standard/Premium 1/3/9-card offers purchased,\nopened and retried through the restricted role. One debit, the exact card count and\nunchanged cross-account denial verified. Twelve isolation/MFA/expiry checks passed.\nGenuine Preview password and TOTP authentication already passed for both accounts.\nThese local pack results are NOT hosted latency or physical Android acceptance.\n\nApplication: atomic creation after hashes, absence and target checks. If any\nprerequisite fails, transaction rolls back. If response is interrupted, inspect\nthe recorded operation and schemas before retrying; do not duplicate it.\nRecovery: stop the dedicated deployment, close the window/revoke runtime LOGIN,\nterminate only its connections, remove only listed disposable schemas and roles\nafter confirming no outside ownership/dependency. No shared schema rollback.\nNo changes to existing Preview accounts/Phone settings, Production, real balances,\nreal cards, public gates, Play or managed publishing. No new paid infrastructure.\n\nThis separate approval is required by your instruction to obtain approval before\nchanging persistent shared Preview infrastructure. It does not authorise Production.\n\nExact SQL hashes:\n${files.map((f) => f.path + "\n  " + f.sha256).join("\n")}\nOperator: scripts/batch1-preview-operator.ts\n  ${manifest.operatorSha256}\nReadable SQL is in the listed local files. The identical frozen payload is retained\nin preview-payloads.json.gz, with its checksum in preview-package.json.\n`;
writeFileSync(dir + "/PREVIEW_APPROVAL.txt", report);
console.log(
  JSON.stringify({ packageSha256: digest, archiveBytes: archive.length }),
);
