import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "./audit-preview-secrets.mjs";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
const known = await loadKnownSecrets();
const runtime = JSON.parse(
  readFileSync("private-data/production/beta-runtime-connection.json", "utf8"),
);
const worker = JSON.parse(
  readFileSync("private-data/nfl-worker/secrets.json", "utf8"),
);
const targets = [
  "src",
  "public",
  "config",
  ...readdirSync("scripts")
    .filter((f) =>
      /^(nfl-|test-nfl-|build-nfl-|provision-nfl-|schedule-nfl-|apply-nfl-|api-football-|prepare-owner-qa-android|android-debug)/.test(
        f,
      ),
    )
    .map((f) => "scripts/" + f),
  "supabase/functions/nfl-postgame",
  ".next/static",
  "docs/qa/nfl-member",
];
if (process.argv[2]) {
  const p = resolve(process.argv[2]);
  if (!p.startsWith(resolve("private-data") + sep))
    throw Error("Private extracted APK directory required");
  targets.push(p);
}
const report = await auditPreviewTargets(targets, [
  ...known.values,
  runtime.databaseUrl,
  decodeURIComponent(new URL(runtime.databaseUrl).password),
  ...Object.values(worker),
]);
writeFileSync(
  "docs/qa/nfl-member/secret-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    filesScanned: report.filesScanned,
    findings: report.findings.length,
    errors: report.errors.length,
  }),
);
if (report.findings.length || report.errors.length) process.exitCode = 1;
