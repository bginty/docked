// Read-only source/client/APK comparison. Private values and raw errors are never printed.
import { readFile, writeFile, mkdir, lstat, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  auditPreviewTargets,
  inspectSecretBytes,
  loadKnownSecrets,
} from "../audit-preview-secrets.mjs";

const reportPath = "docs/qa/phase5a/actual-secret-audit.json";
const extractionPath = "docs/qa/phase5a/apk-extraction.json";
const apkPath = "artifacts/android/Docked-Preview-S24-v5-App-Entry.apk";
const projectRef = "bckkllmndoxzpzdqrevb";

async function privateFile(relative) {
  const info = await lstat(relative);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024)
    throw Error("PRIVATE_SOURCE_INVALID");
  return readFile(relative, "utf8");
}
function requiredValue(value, minimum) {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.startsWith("[")
  )
    throw Error("PRIVATE_SOURCE_INCOMPLETE");
  return value;
}
async function comparisonValues() {
  const connection = JSON.parse(
    await privateFile("private-data/hosted-preview/connection.json"),
  );
  if (connection.projectRef !== projectRef)
    throw Error("PRIVATE_SOURCE_IDENTITY_MISMATCH");
  const known = await loadKnownSecrets();
  const cli = JSON.parse(
    await privateFile("private-data/vercel-cli/auth.json"),
  );
  const retained = await privateFile(
    "private-data/android-preview/tester-credentials.txt",
  );
  const ownerPassword = retained.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  const operator = JSON.parse(
    await privateFile("private-data/phase5a/operator.json"),
  );
  if (
    operator.erased ||
    !/^[a-f0-9-]{36}$/.test(operator.runId ?? "") ||
    operator.email !==
      `docked-phase5a-operator-${operator.runId}@example.invalid`
  )
    throw Error("OPERATOR_COMPARISON_UNAVAILABLE");
  const token = requiredValue(operator.accessToken, 32);
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  );
  if (
    payload.iss !== `https://${projectRef}.supabase.co/auth/v1` ||
    payload.sub !== operator.id
  )
    throw Error("OPERATOR_COMPARISON_IDENTITY_MISMATCH");
  return {
    values: [
      ...new Set([
        ...known.values,
        requiredValue(cli.token, 16),
        requiredValue(ownerPassword, 16),
        requiredValue(operator.password, 32),
        token,
        requiredValue(operator.totpSecret, 16),
        requiredValue(operator.operatorToken, 32),
      ]),
    ],
    knownSourceFiles: known.filesLoaded + 3,
    operatorCredentialFieldsCompared: 4,
  };
}
function safeFilename(file, values) {
  const counts = inspectSecretBytes(Buffer.from(file), values);
  return counts.exactMatches || counts.patternMatches
    ? `[redacted-path-${createHash("sha256").update(file).digest("hex").slice(0, 12)}]`
    : file;
}
async function sourceAudit(values) {
  const files = [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        {
          encoding: "utf8",
          windowsHide: true,
        },
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const findings = [],
    errors = [];
  let bytesScanned = 0,
    filesScanned = 0;
  for (const file of files) {
    const label = safeFilename(file, values);
    try {
      const info = await lstat(file);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 128 * 1024 * 1024
      )
        throw Error("SOURCE_UNREADABLE");
      const bytes = await readFile(file);
      const { exactMatches } = inspectSecretBytes(bytes, values);
      filesScanned++;
      bytesScanned += bytes.length;
      if (exactMatches) findings.push({ file: label, exactMatches });
    } catch {
      errors.push({ file: label, code: "SOURCE_UNREADABLE" });
    }
  }
  return {
    status:
      filesScanned && !findings.length && !errors.length ? "PASS" : "FAIL",
    filesScanned,
    bytesScanned,
    findings,
    errors,
  };
}
async function verifyApkExtraction(target) {
  const [manifest, proof] = await Promise.all([
    readFile("artifacts/android/manifest-v5.json", "utf8").then(JSON.parse),
    readFile(extractionPath, "utf8").then((s) =>
      JSON.parse(s.replace(/^\uFEFF/, "")),
    ),
  ]);
  const bytes = await readFile(apkPath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (
    manifest.sha256 !== hash ||
    proof.status !== "PASS" ||
    proof.apkSha256 !== hash
  )
    throw Error("APK_PROOF_MISMATCH");
  const entries = await readdir(target, { withFileTypes: true });
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink())
      throw Error("APK_EXTRACTION_INVALID");
    totalBytes += (await lstat(path.join(target, entry.name))).size;
  }
  if (
    !entries.length ||
    entries.length !== proof.filesExtracted ||
    totalBytes !== proof.uncompressedBytes
  )
    throw Error("APK_EXTRACTION_INCOMPLETE");
  return {
    artifact: apkPath,
    sha256: hash,
    archiveEntries: proof.archiveEntries,
    filesExtracted: entries.length,
    uncompressedBytes: totalBytes,
  };
}
async function save(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
async function main() {
  const targets = process.argv
    .slice(2)
    .map((p) =>
      path.relative(process.cwd(), path.resolve(p)).replaceAll("\\", "/"),
    );
  if (targets.length === 1 && targets[0] === "--help") {
    console.log(
      "Usage: node scripts/hosted-preview/phase5a-secrets.mjs .next/static private-data/android-https-preview-extracted-<id> [private-data/phase5a/hosted-rendered]. Extract the v5 APK first with scripts/extract-android-apk.ps1 and report docs/qa/phase5a/apk-extraction.json. Run before operator cleanup. No network access.",
    );
    return;
  }
  const apkTarget = targets.find((t) =>
    /^private-data\/android-https-preview-extracted-[a-f0-9]{32}$/.test(t),
  );
  if (
    !targets.includes(".next/static") ||
    !apkTarget ||
    targets.some(
      (t) =>
        t !== ".next/static" &&
        t !== apkTarget &&
        t !== "private-data/phase5a/hosted-rendered",
    )
  )
    throw Error("EXACT_ARTIFACT_TARGETS_REQUIRED");
  const known = await comparisonValues();
  const apk = await verifyApkExtraction(apkTarget);
  const [artifacts, source] = await Promise.all([
    auditPreviewTargets(targets, known.values),
    sourceAudit(known.values),
  ]);
  const report = {
    checkedAt: new Date().toISOString(),
    status:
      artifacts.status === "PASS" && source.status === "PASS" ? "PASS" : "FAIL",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    knownSourceFiles: known.knownSourceFiles,
    operatorCredentialFieldsCompared: known.operatorCredentialFieldsCompared,
    source,
    artifacts,
    apk,
    hostedRenderedIncluded: targets.includes(
      "private-data/phase5a/hosted-rendered",
    ),
    scope:
      "Tracked/unignored source: actual-secret comparisons. Explicit client/APK/optional rendered artifacts: actual values plus generic secret signatures and build canaries. Literal, escaped, URL, HTML, Unicode, base64 and UTF-16 variants; no values/snippets emitted. APK entries are fully extracted without Windows case collisions.",
    comparisonSources:
      "Exact local Preview DB/service/environment credentials, retained tester password, CLI token, and four Phase5A operator credential fields. Previous erased QA credentials are not read or claimed as compared.",
    limitations: [
      "The Odds API key stored as a sensitive Vercel value was not retrieved and cannot be compared by its actual value. Signature/canary scanning and separately reviewed server-only imports do not prove exact-value absence for an unknown key.",
      "Source generic heuristics are a separate check because authored fixture tokens/credentialed URLs exist in tests; this source audit does not suppress any actual-value finding.",
      "This is a local artifact audit, not verification of an uncollected hosted response or a new Android build.",
    ],
  };
  await save(report);
  console.log(
    JSON.stringify({
      status: report.status,
      sourceFiles: source.filesScanned,
      artifactFiles: artifacts.filesScanned,
      findings: source.findings.length + artifacts.findings.length,
      errors: source.errors.length + artifacts.errors.length,
      hostedRenderedIncluded: report.hostedRenderedIncluded,
    }),
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
void main().catch(async () => {
  await save({
    checkedAt: new Date().toISOString(),
    status: "FAIL",
    code: "PHASE5A_AUDIT_INCOMPLETE",
    details:
      "Read, identity, extraction or comparison validation failed closed. Private errors and credentials withheld.",
  }).catch(() => {});
  console.error(
    "Phase5A actual-secret audit failed closed; raw errors and credentials withheld.",
  );
  process.exitCode = 1;
});
