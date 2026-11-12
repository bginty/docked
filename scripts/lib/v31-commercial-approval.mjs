import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
export const root =
  "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au";
export const evidence = root + "/docs/qa/v31-commercial-execution-20261113";
export const privateDir =
  root + "/private-data/v31-commercial-execution-20261113";
mkdirSync(privateDir, { recursive: true });
mkdirSync(evidence, { recursive: true });
export const sourceCommit = "260fe3399f1eacf03915c227216a1bab10d7b4d9";
export const packageSha256 =
  "56cf519359e3accae8300d7d904dbf637db0a8654a3752b1f21a0b99eb01a1c1";
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, windowsHide: true, maxBuffer: 128e6 });
export const blob = (file) => git("show", sourceCommit + ":" + file);
export function packet() {
  const bytes = readFileSync(
    root + "/docs/qa/v31-revenue-launch-20261113/closed-gate-package.json",
    "utf8",
  ).replaceAll("\r\n", "\n");
  assert.equal(hash(bytes), packageSha256, "Approval package bytes changed");
  const p = JSON.parse(bytes);
  assert.equal(p.sourceCommit, sourceCommit);
  assert.equal(
    git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    p.sourceTree,
  );
  for (const entry of [
    ...p.productionMigrations,
    p.dormantRoleProposal,
    p.rollback,
    ...p.reviewDocuments,
  ])
    assert.equal(
      hash(blob(entry.file)),
      entry.sha256,
      "Reviewed bytes changed: " + entry.file,
    );
  return p;
}
export function authority(scope) {
  const a = readJson(
    root +
      "/private-data/v31-revenue-launch-20261113/closed-gate-founder-approved.private.json",
  );
  assert.equal(a.approved, true);
  assert.equal(a.sourceCommit, sourceCommit);
  assert.equal(a.packageSha256, packageSha256);
  assert(a.scopes.includes(scope), "Scope not approved");
  const start = Date.parse(a.approvedAt),
    end = Date.parse(a.expiresAt);
  assert(
    start <= Date.now() && end > Date.now() && end - start <= 86400000,
    "Approval expired",
  );
  for (const key of [
    "sms",
    "paymentTests",
    "registration",
    "inventoryImport",
    "issuance",
    "commercialActivation",
    "playPublication",
    "liveKeyCustodyTransfer",
    "authConfigurationChanges",
  ])
    assert.equal(a[key], false, "Unexpected scope");
  return packet();
}
export function writeEvidence(name, value) {
  assert.match(name, /^[a-z0-9-]+\.json$/);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(evidence + "/" + name, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
}
export function writePrivate(name, value) {
  assert.match(name, /^[a-z0-9.-]+$/);
  mkdirSync(privateDir, { recursive: true });
  writeFileSync(privateDir + "/" + name, JSON.stringify(value), {
    flag: "wx",
    mode: 0o600,
  });
}
