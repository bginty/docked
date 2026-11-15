import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
export const root = process.cwd();
export const evidence = root + "/docs/qa/season-catalogue-20261115";
export const privateDir = root + "/private-data/season-catalogue-20261115";
mkdirSync(privateDir, { recursive: true });
export const hash = (b) => createHash("sha256").update(b).digest("hex");
export const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, windowsHide: true, maxBuffer: 128e6 });
const bytes = readFileSync(evidence + "/production-package.json");
export const packageSha256 = hash(bytes);
const p = JSON.parse(bytes);
export const sourceCommit = p.sourceCommit;
export const blob = (f) => git("show", sourceCommit + ":" + f);
export function packet() {
  assert.equal(
    git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    p.sourceTree,
  );
  for (const f of [...p.productionMigrations, p.adoption, ...p.reviewedFiles])
    assert.equal(hash(blob(f.file)), f.sha256, f.file);
  return p;
}
export function authority(scope) {
  const a = readJson(privateDir + "/founder-authority.private.json");
  assert.equal(a.instruction, "push to production when done");
  assert.equal(a.scope, "completed stable season-catalogue correction only");
  assert.equal(a.sourceCommit, sourceCommit);
  assert.equal(a.packageSha256, packageSha256);
  assert(a.scopes.includes(scope));
  assert(
    Date.now() >= Date.parse(a.recordedAt) &&
      Date.now() < Date.parse(a.expiresAt),
  );
  assert.equal(a.publicOrCommercialActivation, false);
  return packet();
}
export function writeEvidence(name, v) {
  assert.match(name, /^[a-z0-9-]+\.json$/);
  writeFileSync(evidence + "/" + name, JSON.stringify(v, null, 2) + "\n", {
    flag: "wx",
  });
}
export function writePrivate(name, v) {
  assert.match(name, /^[a-z0-9.-]+$/);
  writeFileSync(privateDir + "/" + name, JSON.stringify(v), {
    flag: "wx",
    mode: 0o600,
  });
}
