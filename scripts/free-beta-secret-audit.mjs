import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
import { readFile, writeFile } from "node:fs/promises";
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
const report = await auditPreviewTargets(
  ["src", "public", "config", ".next/static", "docs/qa/free-beta-data", "docs/qa/postgame"],
  values,
);
await writeFile(
  "docs/qa/free-beta-data/known-secret-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (report.errors.length || report.findings.length) process.exitCode = 1;
