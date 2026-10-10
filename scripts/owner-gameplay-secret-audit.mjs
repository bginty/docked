import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
import { writeFile, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
const known = await loadKnownSecrets();
const runtime = JSON.parse(
  await readFile(
    "private-data/production/beta-runtime-connection.json",
    "utf8",
  ),
);
const values = [
  ...known.values,
  runtime.databaseUrl,
  decodeURIComponent(new URL(runtime.databaseUrl).password),
];
const targets = [
  "src",
  "public",
  "config",
  "docs/qa/owner-gameplay",
  "docs/qa/fantasy-ux",
  ".next/static",
];
if (process.argv[2]) {
  const extra = resolve(process.argv[2]);
  if (!extra.startsWith(resolve("private-data") + sep))
    throw Error("Only the isolated APK extraction directory is allowed");
  targets.push(extra);
}
const report = await auditPreviewTargets(targets, values);
await writeFile(
  "docs/qa/fantasy-ux/secret-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (report.errors.length || report.findings.length) process.exitCode = 1;
