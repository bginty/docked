/** Freeze already rehearsed synthetic Preview SQL, separately from Production. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { packAcceptanceSchemas } from "../src/server/pack-acceptance-sql";
import {
  acceptanceDocs,
  acceptancePrivate,
  packOnly,
} from "./lib/batch1-acceptance-profile";
if (!packOnly)
  throw Error("Larger Preview proposal withdrawn; freeze only --pack-only");
const dir = acceptanceDocs,
  priv = acceptancePrivate;
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
  version: 3,
  projectRef: "bckkllmndoxzpzdqrevb",
  vercelProject: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  schemas: ["b1_acceptance", ...packAcceptanceSchemas.map((s) => "b1_" + s)],
  roles: ["docked_pack_acceptance", "docked_pack_acceptance_owner"],
  runtimeHours: 24,
  syntheticAccounts: 2,
  syntheticPlayers: 108,
  syntheticDefinitions: 540,
  initialSyntheticLimitedCopies: 0,
  syntheticCreditsPerAccount: 100000,
  maxTestPurchases: 24,
  files,
  payloadArchive: {
    path: dir + "/preview-payloads.json.gz",
    sha256: hash(archive),
  },
  operatorSha256: hash(readFileSync("scripts/batch1-preview-operator.ts")),
  operatorDependencies: [
    {
      path: "scripts/lib/batch1-acceptance-profile.ts",
      sha256: hash(readFileSync("scripts/lib/batch1-acceptance-profile.ts")),
    },
  ],
  productionChanges: false,
  existingPreviewAccountsChanged: false,
  providerSettingsChanged: false,
};
writeFileSync(
  dir + "/preview-package.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
const digest = hash(readFileSync(dir + "/preview-package.json"));
const report =
  "DOCKED — MINIMUM HOSTED PACK PREREQUISITE\n\nPackage SHA-256: PACKAGE_DIGEST\nTarget: existing Supabase Preview bckkllmndoxzpzdqrevb.\nApplication: existing protected docked-preview Vercel project.\n\nSeparate approval requested for a 24-hour synthetic pack-only window.\nReplaces withdrawn 0a00bd9c..., 9fb07649... and f5f83aed... proposals. No Production deployment.\n\nCreate 12 temporary namespaces containing 143 dependency tables and two access\ncontrol tables. Keep the existing financial, ownership, source and supply guards.\nNine collection/Weekly reader tables and their hosted routes are excluded.\nTwo restricted roles: NOLOGIN owner; runtime with no privileged membership or\nBYPASSRLS; exactly the existing two synthetic accounts with genuine Auth/AAL2,\nfiltered Auth views, maximum 24-hour expiry and protected deployment access.\nNo existing Preview account, Phone setting or shared schema permission changes.\nNon-superuser setup is rehearsed: temporary object-owner CREATE/SET/INHERIT\naccess ends before commit; creator administration remains only for scoped cleanup.\nThe local operator retains SELECT on three synthetic reconciliation tables.\nThese operator permissions never enter the web runtime.\n\nSmall fictional fixture: 108 players, 540 definitions, zero starting limited\ncards and 100,000 nonredeemable synthetic credits per account. No customer rows.\nSource evidence is explicitly fictional, never a real source-rights assertion.\n20 planned unique purchases; hard operator allowance maximum 24 purchases\n(at most 216 synthetic cards). No automatic top-ups or provider transactions.\nHTTP: 18 offers, nine-card allocation, saved receipts, opening, duplicates,\ninterruption, account/MFA denial and Auth/database timing. No load benchmark.\nFull UI, Android and real performance acceptance use the Production private beta\nAFTER its separately approved deployment and authorised tester participation.\n\nRehearsed locally through actual pack handlers and all guard chains. Local Auth\nis simulated only in disconnected rehearsal; hosted Auth must be genuine.\nExisting Production-sized isolated evidence remains subject to fresh drift.\nHosted results are still pending. No new paid infrastructure or new testing service.\n\nApply once, atomically, after exact bytes, target, absence and permissions checks.\nOn failure/interruption inspect actual state before retry; never duplicate setup.\nRecovery: stop the dedicated deployment, close its window/revoke its runtime\nLOGIN, terminate only its sessions and remove only its listed namespaces/roles\nonce outside dependencies have been checked and non-secret evidence preserved.\nNo public registration, SMS, paid credits, trading, prizes, withdrawals or Play\npublication. No Production data, customer cards, balances or runtime changes.\n\nSeparate approval is required by your instruction for shared Preview changes.\nA later exact Production package will be requested only after hosted checks pass.\n\nSQL_HASHES\nOperator SHA-256: OPERATOR_DIGEST\nHelper hashes and frozen archive checksum: preview-package.json.\n"
    .replace("PACKAGE_DIGEST", digest)
    .replace(
      "SQL_HASHES",
      files.map((f) => f.path + "\n  " + f.sha256).join("\n"),
    )
    .replace("OPERATOR_DIGEST", manifest.operatorSha256);
writeFileSync(dir + "/PREVIEW_APPROVAL.txt", report);
console.log(
  JSON.stringify({ packageSha256: digest, archiveBytes: archive.length }),
);
