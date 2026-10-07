import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
const known = await loadKnownSecrets();
const accounts = JSON.parse(
  await readFile("private-data/fantasy/testers.json", "utf8"),
).accounts;
const secrets = [
  ...known.values,
  ...accounts.flatMap((a) => [a.password, a.totpSecret].filter(Boolean)),
];
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", windowsHide: true },
)
  .split("\0")
  .filter(Boolean);
// Test fixtures intentionally contain credential-shaped examples; scan deployable sources,
// delivery evidence and all browser bundles with both signatures and actual private values.
const targets = files.filter((f) =>
  /^(src\/|public\/|docs\/qa\/fantasy\/|docs\/FANTASY-CARDS-|docs\/BRAND-INTEGRATION)/.test(f),
);
targets.push(".next/static");
const report = await auditPreviewTargets(targets, secrets);
await writeFile(
  "docs/qa/fantasy/secret-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
if (report.findings.length || report.errors.length) process.exitCode = 1;
