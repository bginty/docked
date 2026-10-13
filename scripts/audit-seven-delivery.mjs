import { readFileSync, writeFileSync } from "node:fs";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
import { resolve, sep } from "node:path";
const known = await loadKnownSecrets();
const runtime = JSON.parse(
  readFileSync("private-data/production/beta-runtime-connection.json"),
);
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
const values = [
  ...known.values,
  runtime.databaseUrl,
  decodeURIComponent(new URL(runtime.databaseUrl).password),
  qa.password,
];
const targets = [
  "src",
  "public",
  "config",
  ".next/static",
  "docs/qa/economy-v2",
  "docs/qa/rarity-round",
  "docs/qa/seven-round",
  "docs/qa/android-v22",
];
if (process.argv[2]) {
  const extra = resolve(process.argv[2]);
  if (!extra.startsWith(resolve("private-data") + sep))
    throw Error("Only the isolated APK extraction directory is allowed");
  targets.push(extra);
}
const report = await auditPreviewTargets(targets, values);
writeFileSync(
  "docs/qa/seven-round/known-secret-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (report.findings.length || report.errors.length) process.exitCode = 1;
