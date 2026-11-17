/** Local evidence collation only; no tests or provider operations. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const dir = "docs/qa/paid-launch-final-20261118/";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 16e6 });
const canonical = (b) => Buffer.from(b.toString().replaceAll("\r\n", "\n"));
const original = JSON.parse(
  fs.readFileSync(
    "docs/qa/final-launch-evidence-20261117/source-comparison.json",
  ),
);
const comparisons = original.files.map((r) => {
  const base = git(
      "show",
      "78482f713fd93b6677f85b43c5c49cfa00acccde:" + r.file,
    ),
    current = canonical(fs.readFileSync(r.file));
  return {
    file: r.file,
    productionSha256: hash(base),
    candidateSha256: hash(current),
    unchanged: base.equals(current),
  };
});
assert(
  comparisons.every((x) => x.unchanged),
  "Accepted financial/phone contracts changed",
);
const mail = ["index.ts", "mail.mjs", "router.mjs", "queue.mjs"].map((name) => {
  const local = canonical(
    fs.readFileSync("supabase/functions/docked-auth-email/" + name),
  );
  const deployed = canonical(
    fs.readFileSync(
      "private-data/paid-launch-final-20261118/deployed-email/" + name,
    ),
  );
  return {
    file: name,
    candidateSha256: hash(local),
    savedDeployedCopySha256: hash(deployed),
    equivalentIgnoringTrailingWhitespace:
      local.toString().trimEnd() === deployed.toString().trimEnd(),
  };
});
const report = {
  recordedAt: new Date().toISOString(),
  evidenceIndex: "cb1ee482d86a085af5e46678d13b0027870b188f",
  productionSource: "78482f713fd93b6677f85b43c5c49cfa00acccde",
  method:
    "Git blob bytes versus LF-normalized candidate; no real billing/SMS/pack tests repeated",
  comparisons,
  authMail: {
    deployedVersion: 47,
    deployedProviderBundleSha256:
      "cc8cc7c6ecce565857064e0857b8fa77247102ae98380568cb7aa8ef1d1c197c",
    files: mail,
    note: "Saved deployed copies have an additional trailing newline. Meaningful source comparison excludes trailing whitespace. The public-recipient branch and two public-authority environment bindings are not yet deployed; router and queue are equivalent. Candidate also contains existing isolated-preview helpers, not enabled by Production router.",
  },
  nativeChanged: false,
  newSqlMigrations: 0,
};
fs.writeFileSync(
  dir + "source-evidence-delta.json",
  JSON.stringify(report, null, 2) + "\n",
);
const provider = JSON.parse(fs.readFileSync(dir + "provider-readonly.json"));
delete provider.twilio.autoRechargeUnchanged;
provider.twilio.providerSettingsWritten = 0;
provider.twilio.noAutomaticRechargeEvidence =
  "Reuse accepted 17-Nov SMS_DECISION; no new recharge-setting inspection claimed";
fs.writeFileSync(
  dir + "provider-readonly.json",
  JSON.stringify(provider, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    unchangedAcceptedContracts: comparisons.length,
    mailFilesReviewed: mail.length,
    providerCalls: 0,
  }),
);
