// Read-only comparison against this beta's actual credentials. Never print values.
import { readFile, writeFile } from "node:fs/promises";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "../audit-preview-secrets.mjs";

async function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) throw new Error("Explicit artifacts required");
  const fixture = JSON.parse(
    await readFile("private-data/phase45-beta/acceptance.json", "utf8"),
  );
  if (
    fixture.projectRef !== "bckkllmndoxzpzdqrevb" ||
    fixture.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
    fixture.accounts?.length !== 4
  )
    throw new Error("Exact Docked beta fixture required");
  const { values } = await loadKnownSecrets();
  for (const account of fixture.accounts) {
    for (const key of ["password", "invitationCode"]) {
      if (typeof account[key] !== "string" || account[key].length < 32)
        throw new Error("Run credential audit before fixture redaction");
      values.push(account[key]);
    }
  }
  const owner = await readFile(
    "private-data/android-preview/tester-credentials.txt",
    "utf8",
  );
  const ownerPassword = owner.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!ownerPassword || ownerPassword.length < 16)
    throw new Error("Owner credential comparison unavailable");
  values.push(ownerPassword);
  const cli = JSON.parse(
    await readFile("private-data/vercel-cli/auth.json", "utf8"),
  );
  if (typeof cli.token !== "string" || cli.token.length < 16)
    throw new Error("Deployment credential comparison unavailable");
  values.push(cli.token);
  const result = await auditPreviewTargets(targets, [...new Set(values)]);
  const report = {
    ...result,
    checkedAt: new Date().toISOString(),
    scope:
      "Actual database/service credentials, owner password, four beta passwords and invitation codes, deployment token; values withheld",
  };
  await writeFile(
    "docs/qa/phase45/actual-secret-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: result.status,
      filesScanned: result.filesScanned,
      findings: result.findings.length,
      errors: result.errors.length,
    }),
  );
  if (result.status !== "PASS") process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "Actual-secret audit failed closed; raw errors and credentials withheld.",
  );
  process.exitCode = 1;
});
