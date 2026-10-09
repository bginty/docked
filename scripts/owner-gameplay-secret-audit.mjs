import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
import { writeFile } from "node:fs/promises";
const known = await loadKnownSecrets();
const report = await auditPreviewTargets(
  ["src", "public", "config", "docs/qa/owner-gameplay", ".next/static"],
  known.values,
);
await writeFile(
  "docs/qa/owner-gameplay/secret-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (report.errors.length || report.findings.length) process.exitCode = 1;
