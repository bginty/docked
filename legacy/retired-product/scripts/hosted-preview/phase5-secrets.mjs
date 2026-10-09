// Compare artifacts/source with actual private values without printing credentials.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  auditPreviewTargets,
  loadKnownSecrets,
} from "../audit-preview-secrets.mjs";

async function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) throw Error("Explicit built artifact targets required");
  const { values } = await loadKnownSecrets();
  const cli = JSON.parse(
    await readFile("private-data/vercel-cli/auth.json", "utf8"),
  );
  if (typeof cli.token !== "string" || cli.token.length < 16)
    throw Error("CLI comparison unavailable");
  values.push(cli.token);
  const owner = await readFile(
    "private-data/android-preview/tester-credentials.txt",
    "utf8",
  );
  const password = owner.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!password || password.length < 16)
    throw Error("Retained tester comparison unavailable");
  values.push(password);
  let qaCredentials = 0;
  try {
    const j = JSON.parse(
      await readFile("private-data/phase5/acceptance.json", "utf8"),
    );
    if (
      j.projectRef !== "bckkllmndoxzpzdqrevb" ||
      j.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      !["ready", "prepared"].includes(j.state) ||
      j.accounts.length !== 5
    )
      throw Error("Run before QA erasure");
    for (const a of j.accounts) {
      if (typeof a.password !== "string" || a.password.length < 32)
        throw Error("QA comparison incomplete");
      values.push(a.password);
      qaCredentials++;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const result = await auditPreviewTargets(targets, [...new Set(values)]);
  const needles = [
    ...new Set(
      values.flatMap((v) => [
        v,
        encodeURIComponent(v),
        Buffer.from(v).toString("base64"),
      ]),
    ),
  ].map((v) => Buffer.from(v));
  const files = [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { encoding: "utf8", windowsHide: true },
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const matches = [];
  for (const file of files) {
    const bytes = await readFile(file);
    if (needles.some((v) => bytes.includes(v))) matches.push(file);
  }
  const report = {
    ...result,
    status: result.status === "PASS" && matches.length === 0 ? "PASS" : "FAIL",
    checkedAt: new Date().toISOString(),
    sourceFilesChecked: files.length,
    sourceMatches: matches,
    qaCredentialsCompared: qaCredentials,
    scope:
      "Actual preview DB/service, retained tester, CLI and available disposable QA credentials; raw, URL and base64 encodings; values withheld. Built artifact signatures separately checked.",
  };
  await writeFile(
    "docs/qa/phase5/actual-secret-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: report.status,
      sourceFilesChecked: files.length,
      artifactFiles: result.filesScanned,
      findings: result.findings.length + matches.length,
      errors: result.errors.length,
      qaCredentialsCompared: qaCredentials,
    }),
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "Phase 5 secret audit failed closed; raw errors and credentials withheld.",
  );
  process.exitCode = 1;
});
